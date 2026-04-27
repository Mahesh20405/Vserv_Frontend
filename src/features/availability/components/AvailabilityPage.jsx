import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminLayout } from '../../../layouts/AppShell'
import { AdminPageHero, PageContent } from '../../../components/common/PageElements'
import { PageSpinner } from '../../../components/ui/Spinner'
import { ActionIconButton } from '../../../components/ui/ActionIconButton'
import { PillStat } from '../../../components/ui/PillStat'
import { PillStatRow } from '../../../components/ui/PillStatRow'
import { useToast } from '../../../components/ui/Toast'
import { formatDate } from '../../../utils/formatters'
import { validateAvailabilitySlotForm } from '../../../utils/adminValidation'
import { useNavigationGuard } from '../../../hooks/useNavigationGuard'
import '../../../styles/features/availability/AvailabilityPage.css'
import { availabilityService } from '../services/availabilityService'
import { TIME_SLOTS } from '../../../config/constants'

const STATUS_META = {
  available: { label: 'Available', color: '#16a34a', light: '#dcfce7', text: '#15803d' },
  low: { label: 'Low', color: '#d97706', light: '#fef3c7', text: '#92400e' },
  full: { label: 'Full', color: '#dc2626', light: '#fee2e2', text: '#b91c1c' },
  closed: { label: 'Closed', color: '#9ca3af', light: '#f3f4f6', text: '#6b7280' },
}
const EMPTY_ADD = { serviceDate: '', timeSlot: '', maxBookings: 5 }
const EMPTY_EDIT = { maxBookings: 5, isAvailable: true }
const EMPTY_BULK = { from: '', to: '', slots: [], maxBookings: 5 }
const dateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const todayKey = () => dateKey()
const safeFutureDate = (value) => (value && value >= todayKey() ? value : todayKey())
const slotStart = (slot = '') => { const m = slot.split('-')[0]?.trim().match(/^(\d{1,2}):(\d{2})$/); return m ? (Number(m[1]) * 60) + Number(m[2]) : null }
const pastSlot = (date, slot, now = new Date()) => { const today = dateKey(now); if (date < today) return true; if (date > today) return false; const start = slotStart(slot); return start == null ? false : ((now.getHours() * 60) + now.getMinutes()) >= start }
const openSlotsForDate = (date, now = new Date()) => TIME_SLOTS.filter((timeSlot) => !pastSlot(date, timeSlot, now))
const normalize = (slot) => ({ availabilityId: slot.availabilityId ?? slot.id, serviceDate: slot.serviceDate ?? slot.date, timeSlot: slot.timeSlot, maxBookings: Number(slot.maxBookings || 0), currentBookings: Number(slot.currentBookings || 0), isAvailable: Boolean(slot.isAvailable) })
const slotStatus = (slot, now = new Date()) => pastSlot(slot.serviceDate, slot.timeSlot, now) || !slot.isAvailable ? 'closed' : (slot.currentBookings >= slot.maxBookings ? 'full' : ((slot.maxBookings - slot.currentBookings) <= 2 ? 'low' : 'available'))
const summarize = (slots, now = new Date()) => slots.reduce((acc, slot) => { acc[slotStatus(slot, now)] += 1; acc.booked += Number(slot.currentBookings || 0); acc.cap += Number(slot.maxBookings || 0); return acc }, { available: 0, low: 0, full: 0, closed: 0, booked: 0, cap: 0 })

function Modal({ title, subtitle, children, onClose, danger = false, small = false }) {
  return <div className="modal fade show d-block availability-modal-backdrop"><div className={`modal-dialog modal-dialog-centered ${small ? 'modal-sm' : ''}`}><div className="modal-content"><div className={`modal-header ${danger ? 'availability-danger-header' : 'availability-modal-header'}`}><div><h5 className="modal-title fw-semibold text-white mb-0">{title}</h5>{subtitle ? <div className="availability-modal-desc text-white-50">{subtitle}</div> : null}</div></div>{children}</div></div></div>
}

export function AvailabilityPage() {
  const toast = useToast()
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(dateKey())
  const [showAdd, setShowAdd] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showPast, setShowPast] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [addForm, setAddForm] = useState(EMPTY_ADD)
  const [bulkForm, setBulkForm] = useState(EMPTY_BULK)
  const [editForm, setEditForm] = useState(EMPTY_EDIT)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const guardNavigation = useNavigationGuard(
    Boolean(
      saving ||
      (showAdd && (Boolean(addForm.serviceDate || addForm.timeSlot) || Number(addForm.maxBookings) !== 5)) ||
      (showBulk && (Boolean(bulkForm.from || bulkForm.to || bulkForm.slots.length) || Number(bulkForm.maxBookings) !== 5)) ||
      (showEdit && editing && (Number(editForm.maxBookings) !== Number(editing.maxBookings) || Boolean(editForm.isAvailable) !== Boolean(editing.isAvailable)))
    ),
    'An availability change is still in progress. Leaving now may discard it. Continue?'
  )

  async function load(range = {}) {
    setLoading(true)
    try {
      const defaultFrom = new Date(); defaultFrom.setDate(defaultFrom.getDate() - 45)
      const defaultTo = new Date(); defaultTo.setDate(defaultTo.getDate() + 75)
      const requestFrom = range.from && range.from < dateKey(defaultFrom) ? range.from : dateKey(defaultFrom)
      const requestTo = range.to && range.to > dateKey(defaultTo) ? range.to : dateKey(defaultTo)
      const r = await availabilityService.list({ from: requestFrom, to: requestTo })
      const next = (r.data || []).map(normalize)
      setSlots(next)
      setSelectedDate((current) => next.some((slot) => slot.serviceDate === current) ? current : (next.find((slot) => slot.serviceDate >= dateKey())?.serviceDate || dateKey()))
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to load availability.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const now = new Date()
  const grouped = useMemo(() => slots.reduce((acc, slot) => { if (!acc[slot.serviceDate]) acc[slot.serviceDate] = []; acc[slot.serviceDate].push(slot); return acc }, {}), [slots])
  const active = useMemo(() => slots.filter((slot) => !pastSlot(slot.serviceDate, slot.timeSlot, now)), [slots, now])
  const futureDates = useMemo(() => Object.keys(grouped).filter((date) => (grouped[date] || []).some((slot) => !pastSlot(slot.serviceDate, slot.timeSlot, now))).sort(), [grouped, now])
  const pastDates = useMemo(() => Object.keys(grouped).filter((date) => (grouped[date] || []).every((slot) => pastSlot(slot.serviceDate, slot.timeSlot, now))).sort((a, b) => b.localeCompare(a)), [grouped, now])
  const selectedSlots = TIME_SLOTS.map((timeSlot) => (grouped[selectedDate] || []).find((slot) => slot.timeSlot === timeSlot) || { availabilityId: `${selectedDate}-${timeSlot}`, serviceDate: selectedDate, timeSlot, maxBookings: 0, currentBookings: 0, isAvailable: false, empty: true })
  const summary = summarize(active, now)
  const selectedSummary = summarize(grouped[selectedDate] || [], now)
  const addOpenSlots = TIME_SLOTS.filter((timeSlot) => !pastSlot(addForm.serviceDate || selectedDate || dateKey(), timeSlot, now))
  const bulkOpenSlots = TIME_SLOTS.filter((timeSlot) => !(bulkForm.from === dateKey() && pastSlot(dateKey(), timeSlot, now)))
  const stats = [{ label: 'Active Slots', value: active.length, tone: 'orange', icon: 'AS' }, { label: 'Open Slots', value: summary.available + summary.low, tone: 'green', icon: 'OP' }, { label: 'Full Slots', value: summary.full, tone: 'red', icon: 'FB' }, { label: 'Total Bookings', value: summary.booked, tone: 'amber', icon: 'TB' }]

  function openAdd(date = selectedDate, timeSlot = '') { const nextDate = safeFutureDate(date || dateKey()); setAddForm({ serviceDate: nextDate, timeSlot: timeSlot && !pastSlot(nextDate, timeSlot, now) ? timeSlot : '', maxBookings: 5 }); setErrors({}); setShowAdd(true) }
  function openBulk() { const base = safeFutureDate(selectedDate || dateKey()); const available = openSlotsForDate(base, now); setBulkForm({ from: base, to: base, slots: available.length ? [available[0]] : [], maxBookings: 5 }); setErrors({}); setShowBulk(true) }
  function openEdit(slot) { setEditing(slot); setEditForm({ maxBookings: slot.maxBookings, isAvailable: !!slot.isAvailable }); setErrors({}); setShowEdit(true) }
  function openDelete(slot) { setDeleting(slot); setErrors({}); setShowDelete(true) }

  async function submitAdd(event) {
    event.preventDefault()
    const nextErrors = validateAvailabilitySlotForm(addForm, 'create').errors
    if (slots.some((slot) => slot.serviceDate === addForm.serviceDate && slot.timeSlot === addForm.timeSlot)) nextErrors.timeSlot = 'A slot already exists for this date and time.'
    if (Object.keys(nextErrors).length) return setErrors(nextErrors)
    setSaving(true)
    try {
      await availabilityService.create({ serviceDate: addForm.serviceDate, timeSlot: addForm.timeSlot, maxBookings: Number(addForm.maxBookings) })
      toast('Slot added successfully.')
      setShowAdd(false)
      setSelectedDate(addForm.serviceDate)
      await load()
    } catch (error) { toast(error.response?.data?.message || 'Failed to add slot.', 'error') } finally { setSaving(false) }
  }

  async function submitBulk(event) {
    event.preventDefault()
    const nextErrors = validateAvailabilitySlotForm(bulkForm, 'bulk').errors
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      toast(Object.values(nextErrors)[0] || 'Please fix the highlighted bulk slot form errors.', 'error')
      return
    }
    setSaving(true)
    try {
      const response = await availabilityService.bulk({ from: bulkForm.from, to: bulkForm.to, slots: bulkForm.slots, maxBookings: Number(bulkForm.maxBookings) })
      const created = Number(response.data?.created || 0)
      const skipped = Number(response.data?.skipped || 0)
      if (created > 0) {
        toast(`Created ${created} slot${created === 1 ? '' : 's'} successfully.${skipped ? ` Skipped ${skipped} duplicate slot${skipped === 1 ? '' : 's'}.` : ''}`)
      } else {
        toast('No new slots were created. All selected date/time combinations already exist.', 'warning')
      }
      setShowBulk(false)
      setSelectedDate(bulkForm.from)
      await load({ from: bulkForm.from, to: bulkForm.to })
    } catch (error) { toast(error.response?.data?.message || 'Failed to bulk create slots.', 'error') } finally { setSaving(false) }
  }

  async function submitEdit(event) {
    event.preventDefault()
    const nextErrors = validateAvailabilitySlotForm(editForm, 'edit', editing).errors
    if (Object.keys(nextErrors).length) return setErrors(nextErrors)
    setSaving(true)
    try {
      await availabilityService.update(editing.availabilityId, { maxBookings: Number(editForm.maxBookings), isAvailable: editForm.isAvailable })
      toast('Slot updated.')
      setShowEdit(false)
      await load()
    } catch (error) { toast(error.response?.data?.message || 'Failed to update slot.', 'error') } finally { setSaving(false) }
  }

  async function confirmDelete() {
    setSaving(true)
    try {
      await availabilityService.delete(deleting.availabilityId)
      toast('Slot deleted.')
      setShowDelete(false)
      await load()
    } catch (error) { toast(error.response?.data?.message || 'Failed to delete slot.', 'error') } finally { setSaving(false) }
  }

  const renderDateCard = (date) => {
    const day = summarize(grouped[date] || [], now)
    const pct = day.cap ? Math.round((day.booked / day.cap) * 100) : 0
    return <button type="button" key={date} className={`availability-date-card ${selectedDate === date ? 'selected' : ''} ${date === dateKey() ? 'today' : ''}`} onClick={() => setSelectedDate(date)}><div className="availability-date-top"><span className="availability-date-dayname">{date === dateKey() ? 'Today' : new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })}</span><span className="availability-date-number">{new Date(`${date}T00:00:00`).getDate()}</span><span className="availability-date-month">{new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { month: 'short' })}</span></div><div className="availability-date-bar"><span className="availability-date-bar-fill" style={{ width: `${pct}%`, background: day.full ? '#dc2626' : day.low ? '#d97706' : '#16a34a' }} /></div><div className="availability-date-badges">{day.available > 0 ? <span className="availability-mini-badge green">{day.available} avail</span> : null}{day.low > 0 ? <span className="availability-mini-badge amber">{day.low} low</span> : null}{day.full > 0 ? <span className="availability-mini-badge red">{day.full} full</span> : null}{day.closed > 0 ? <span className="availability-mini-badge muted">{day.closed} closed</span> : null}</div><div className="availability-date-footer">{(grouped[date] || []).length} slot(s)</div></button>
  }

  return (
    <AdminLayout activeKey="availability">
      <div className="availability-page">
        <AdminPageHero
          title="Service Availability"
          subtitle="Manage time slots, booking capacity, and service scheduling."
          actions={<><button type="button" className="admin-hero-btn-outline" onClick={openBulk}>Bulk Create</button><button type="button" className="admin-hero-btn" onClick={() => openAdd(selectedDate)}>Add Slot</button></>}
        />
        <PageContent>
          <PillStatRow>{stats.map((card) => <PillStat key={card.label} label={card.label} value={card.value} color={card.tone === 'green' ? '#dcfce7' : card.tone === 'red' ? '#fee2e2' : card.tone === 'amber' ? '#fef3c7' : '#fff0e6'} />)}</PillStatRow>
          {loading ? <div className="section-card"><PageSpinner /></div> : <div className="availability-layout">
            <aside className="availability-rail"><div className="date-rail-wrap"><div className="rail-header"><div className="rail-header-title">Dates</div></div><div className="date-rail">{!futureDates.length ? <div className="text-muted small">No upcoming slots.</div> : futureDates.map(renderDateCard)}</div><div className="past-section"><div className="availability-card-title mb-2">Past Dates</div>{pastDates.slice(0, 2).map((date) => <button type="button" key={date} className="availability-past-row" onClick={() => setSelectedDate(date)}><div><div className="availability-past-date">{formatDate(date)}</div><div className="availability-past-day">{new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })}</div></div><div className="availability-past-meta">{(grouped[date] || []).length} slot(s)</div></button>)}{pastDates.length > 2 ? <button type="button" className="availability-more-btn" onClick={() => setShowPast(true)}>Load More</button> : null}</div></div></aside>
            <section className="slot-panel-wrap availability-panel"><div className="availability-panel-header panel-header"><div><div className={`availability-date-chip ${selectedDate === dateKey() ? 'today' : pastDates.includes(selectedDate) ? 'past' : ''}`}>{selectedDate === dateKey() ? 'Today' : pastDates.includes(selectedDate) ? 'Past' : 'Upcoming'}</div><div className="availability-panel-title panel-title">{new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}</div><div className="availability-panel-meta panel-meta">{selectedSummary.booked}/{selectedSummary.cap || 0} bookings - {selectedSummary.cap ? Math.round((selectedSummary.booked / selectedSummary.cap) * 100) : 0}% utilization</div></div><div className="availability-status-pills">{selectedSummary.available > 0 ? <span className="availability-status-pill green">{selectedSummary.available} Available</span> : null}{selectedSummary.low > 0 ? <span className="availability-status-pill amber">{selectedSummary.low} Low</span> : null}{selectedSummary.full > 0 ? <span className="availability-status-pill red">{selectedSummary.full} Full</span> : null}{selectedSummary.closed > 0 ? <span className="availability-status-pill muted">{selectedSummary.closed} Closed</span> : null}</div></div><div className="availability-results-bar results-bar"><small>{selectedSlots.filter((slot) => !slot.empty).length} configured slot(s)</small><div className="d-flex gap-1 flex-wrap">{pastDates.includes(selectedDate) ? <span className="filter-pill">Read only</span> : <span className="filter-pill">Editable date</span>}</div></div><div className="availability-slot-grid">{selectedSlots.map((slot) => { if (slot.empty) return <div key={slot.availabilityId} className="availability-slot empty"><div className="availability-slot-time">{slot.timeSlot}</div><div className="availability-slot-empty">No slot created</div>{!pastSlot(slot.serviceDate, slot.timeSlot, now) ? <button type="button" className="availability-empty-btn" onClick={() => openAdd(selectedDate, slot.timeSlot)}>+ Add</button> : null}</div>; const status = slotStatus(slot, now); const meta = STATUS_META[status]; const pct = slot.maxBookings ? Math.round((slot.currentBookings / slot.maxBookings) * 100) : 0; return <article key={slot.availabilityId} className={`availability-slot filled tone-${status}`}><div className="availability-slot-header"><div className="availability-slot-time">{slot.timeSlot}</div><span className="availability-slot-badge" style={{ background: meta.light, color: meta.text, borderColor: `${meta.color}33` }}><span className="availability-slot-dot" style={{ background: meta.color }} />{meta.label}{status === 'available' || status === 'low' ? ` - ${Math.max(0, slot.maxBookings - slot.currentBookings)} left` : ''}</span></div><div className="availability-slot-bar"><span className="availability-slot-bar-fill" style={{ width: `${pct}%`, background: meta.color }} /></div><div className="availability-slot-numbers"><span>{slot.currentBookings} booked</span><span>of {slot.maxBookings}</span></div><div className="availability-seat-grid">{Array.from({ length: slot.maxBookings }).map((_, i) => <span key={`${slot.availabilityId}-${i}`} className={`availability-seat ${i < slot.currentBookings ? 'filled' : ''}`} style={i < slot.currentBookings ? { background: meta.color } : undefined} />)}</div>{!pastSlot(slot.serviceDate, slot.timeSlot, now) ? <div className="availability-slot-actions"><ActionIconButton icon="edit" label="Edit slot" onClick={() => openEdit(slot)} /><ActionIconButton icon="delete" label="Delete slot" className="action-danger" onClick={() => openDelete(slot)} /></div> : <div className="availability-past-label">Past - Read only</div>}</article>})}</div></section>
            <aside className="availability-sidebar stats-sidebar"><div className="stats-card availability-card"><div className="stats-card-title availability-card-title">Quick Actions</div><button type="button" className="availability-link-btn" onClick={() => openAdd(selectedDate)}><span className="availability-link-icon orange">+</span>Add New Slot</button><button type="button" className="availability-link-btn" onClick={openBulk}><span className="availability-link-icon amber">B</span>Bulk Create Slots</button><Link to="/admin/bookings" className="availability-link-btn"><span className="availability-link-icon green">B</span>View Bookings</Link></div><div className="stats-card availability-card"><div className="stats-card-title availability-card-title">Status Distribution</div>{['available', 'low', 'full', 'closed'].map((key) => <div key={key} className="availability-legend-row"><span className="availability-legend-left"><span className="availability-slot-dot" style={{ background: STATUS_META[key].color }} />{STATUS_META[key].label}</span><span className="availability-legend-value">{summary[key]}</span></div>)}</div><div className="stats-card availability-card"><div className="stats-card-title availability-card-title">Utilization By Time</div>{TIME_SLOTS.map((timeSlot) => { const items = active.filter((slot) => slot.timeSlot === timeSlot); const booked = items.reduce((sum, slot) => sum + Number(slot.currentBookings || 0), 0); const cap = items.reduce((sum, slot) => sum + Number(slot.maxBookings || 0), 0); if (!cap) return null; const pct = Math.round((booked / cap) * 100); return <div key={timeSlot} className="availability-util-row"><div className="availability-util-label"><span>{timeSlot}</span><span>{pct}%</span></div><div className="availability-util-track"><span className="availability-util-fill" style={{ width: `${pct}%`, background: pct >= 90 ? '#dc2626' : pct >= 60 ? '#d97706' : '#16a34a' }} /></div></div>})}</div><div className="stats-card availability-card"><div className="stats-card-title availability-card-title">Next Available Slots</div>{active.filter((slot) => ['available', 'low'].includes(slotStatus(slot, now))).sort((a, b) => a.serviceDate.localeCompare(b.serviceDate) || a.timeSlot.localeCompare(b.timeSlot)).slice(0, 5).map((slot) => <button type="button" key={slot.availabilityId} className="availability-upcoming-row" onClick={() => setSelectedDate(slot.serviceDate)}><span className="availability-slot-dot" style={{ background: STATUS_META[slotStatus(slot, now)].color }} /><span className="availability-upcoming-info"><span className="availability-upcoming-time">{slot.timeSlot}</span><span className="availability-upcoming-date">{formatDate(slot.serviceDate)}</span></span><span className="availability-upcoming-left">{Math.max(0, slot.maxBookings - slot.currentBookings)} left</span></button>)}</div></aside>
          </div>}
        </PageContent>
        {showAdd ? <Modal title="Add Availability Slot" subtitle="Create a service window for bookings." onClose={() => guardNavigation(() => setShowAdd(false))}><form noValidate onSubmit={submitAdd}><div className="modal-body"><div className="mb-3"><label className="modal-form-label">Service Date</label><input type="date" className={`form-control modal-form-control ${errors.serviceDate ? 'is-invalid' : ''}`} value={addForm.serviceDate} min={dateKey()} onChange={(event) => { const nextDate = event.target.value; setAddForm((current) => ({ ...current, serviceDate: nextDate, timeSlot: current.timeSlot && pastSlot(nextDate, current.timeSlot, now) ? '' : current.timeSlot })) }} />{errors.serviceDate ? <div className="invalid-feedback d-block">{errors.serviceDate}</div> : null}</div><div className="mb-3"><label className="modal-form-label">Time Slot</label><select className={`form-select modal-form-control ${errors.timeSlot ? 'is-invalid' : ''}`} value={addForm.timeSlot} onChange={(event) => setAddForm((current) => ({ ...current, timeSlot: event.target.value }))}><option value="">Select time slot</option>{TIME_SLOTS.map((timeSlot) => <option key={timeSlot} value={timeSlot} disabled={!addOpenSlots.includes(timeSlot)}>{timeSlot}</option>)}</select>{errors.timeSlot ? <div className="invalid-feedback d-block">{errors.timeSlot}</div> : null}</div><div><label className="modal-form-label">Maximum Bookings</label><input type="number" className={`form-control modal-form-control ${errors.maxBookings ? 'is-invalid' : ''}`} value={addForm.maxBookings} min={1} max={20} onChange={(event) => setAddForm((current) => ({ ...current, maxBookings: event.target.value }))} />{errors.maxBookings ? <div className="invalid-feedback d-block">{errors.maxBookings}</div> : null}</div></div><div className="modal-footer"><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => guardNavigation(() => setShowAdd(false))}>Cancel</button><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setAddForm({ serviceDate: safeFutureDate(selectedDate || dateKey()), timeSlot: '', maxBookings: 5 })}>Reset</button><button type="submit" className="availability-add-btn" disabled={saving}>{saving ? 'Adding...' : 'Add Slot'}</button></div></form></Modal> : null}
        {showBulk ? <Modal title="Bulk Create Slots" subtitle="Create the same slots across a date range." onClose={() => guardNavigation(() => setShowBulk(false))}><form noValidate onSubmit={submitBulk}><div className="modal-body"><div className="row g-3"><div className="col-md-6"><label className="modal-form-label">From Date</label><input type="date" className={`form-control modal-form-control ${errors.from ? 'is-invalid' : ''}`} value={bulkForm.from} min={dateKey()} onChange={(event) => setBulkForm((current) => { const nextFrom = event.target.value; const nextTo = current.to && current.to < nextFrom ? nextFrom : current.to; const available = openSlotsForDate(nextFrom, now); const kept = current.slots.filter((value) => available.includes(value)); return ({ ...current, from: nextFrom, to: nextTo, slots: kept.length ? kept : (available.length ? [available[0]] : []) }) })} />{errors.from ? <div className="invalid-feedback d-block">{errors.from}</div> : null}</div><div className="col-md-6"><label className="modal-form-label">To Date</label><input type="date" className={`form-control modal-form-control ${errors.to ? 'is-invalid' : ''}`} value={bulkForm.to} min={bulkForm.from || dateKey()} onChange={(event) => setBulkForm((current) => ({ ...current, to: event.target.value }))} />{errors.to ? <div className="invalid-feedback d-block">{errors.to}</div> : null}</div></div><div className="mt-3"><label className="modal-form-label">Time Slots</label><div className="availability-bulk-grid">{TIME_SLOTS.map((timeSlot) => { const selected = bulkForm.slots.includes(timeSlot); const disabled = !bulkOpenSlots.includes(timeSlot); return <button key={timeSlot} type="button" disabled={disabled} className={`availability-bulk-chip ${selected ? 'selected' : ''}`} onClick={() => setBulkForm((current) => ({ ...current, slots: selected ? current.slots.filter((value) => value !== timeSlot) : [...current.slots, timeSlot] }))}>{timeSlot}</button> })}</div>{errors.slots ? <div className="invalid-feedback d-block">{errors.slots}</div> : null}</div><div className="mt-3"><label className="modal-form-label">Maximum Bookings</label><input type="number" className={`form-control modal-form-control ${errors.maxBookings ? 'is-invalid' : ''}`} value={bulkForm.maxBookings} min={1} max={20} onChange={(event) => setBulkForm((current) => ({ ...current, maxBookings: event.target.value }))} />{errors.maxBookings ? <div className="invalid-feedback d-block">{errors.maxBookings}</div> : null}</div></div><div className="modal-footer"><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => guardNavigation(() => setShowBulk(false))}>Cancel</button><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { const base = safeFutureDate(selectedDate || dateKey()); const available = openSlotsForDate(base, now); setBulkForm({ from: base, to: base, slots: available.length ? [available[0]] : [], maxBookings: 5 }) }}>Reset</button><button type="submit" className="availability-add-btn" disabled={saving}>{saving ? 'Creating...' : 'Create Slots'}</button></div></form></Modal> : null}
        {showEdit && editing ? <Modal title="Edit Slot" subtitle={`${formatDate(editing.serviceDate)} - ${editing.timeSlot}`} onClose={() => guardNavigation(() => setShowEdit(false))}><form onSubmit={submitEdit}><div className="modal-body"><div className="mb-3"><label className="modal-form-label">Maximum Bookings</label><input type="number" className={`form-control modal-form-control ${errors.maxBookings ? 'is-invalid' : ''}`} value={editForm.maxBookings} min={1} max={20} onChange={(event) => setEditForm((current) => ({ ...current, maxBookings: event.target.value }))} />{errors.maxBookings ? <div className="invalid-feedback d-block">{errors.maxBookings}</div> : null}<div className="small text-muted mt-2">Current bookings: {editing.currentBookings}</div></div><div><label className="modal-form-label">Availability Status</label><select className="form-select modal-form-control" value={String(editForm.isAvailable)} onChange={(event) => setEditForm((current) => ({ ...current, isAvailable: event.target.value === 'true' }))}><option value="true">Available (Open for booking)</option><option value="false">Closed</option></select></div></div><div className="modal-footer"><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => guardNavigation(() => setShowEdit(false))}>Cancel</button><button type="submit" className="availability-add-btn" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button></div></form></Modal> : null}
        {showDelete && deleting ? <Modal title="Delete Slot" subtitle={`${formatDate(deleting.serviceDate)} - ${deleting.timeSlot}`} onClose={() => setShowDelete(false)} danger small><div className="modal-body">{deleting.currentBookings > 0 ? <div className="alert alert-warning small py-2">This slot already has {deleting.currentBookings} booking(s).</div> : null}<p className="mb-0 small text-muted">This action cannot be undone.</p></div><div className="modal-footer"><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowDelete(false)}>Cancel</button><button type="button" className="btn btn-sm btn-danger" onClick={confirmDelete} disabled={saving}>{saving ? 'Deleting...' : 'Delete'}</button></div></Modal> : null}
        {showPast ? <Modal title="Past Dates" subtitle="Recently closed availability dates." onClose={() => setShowPast(false)}><div className="modal-body">{pastDates.map((date) => <button type="button" key={date} className="availability-past-modal-row" onClick={() => { setSelectedDate(date); setShowPast(false) }}><div><div className="availability-past-date">{formatDate(date)}</div><div className="availability-past-day">{new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long' })}</div></div><div className="availability-past-modal-meta"><span>{(grouped[date] || []).length} slot(s)</span><span>{summarize(grouped[date] || [], now).booked}/{summarize(grouped[date] || [], now).cap} booked</span></div></button>)}</div><div className="modal-footer"><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowPast(false)}>Close</button></div></Modal> : null}
      </div>
    </AdminLayout>
  )
}



import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminLayout } from '../../../layouts/AppShell'
import { PageSpinner } from '../../../components/ui/Spinner'
import { StatusBadge } from '../../../components/ui/Badge'
import { ActionIconButton } from '../../../components/ui/ActionIconButton'
import { useToast } from '../../../components/ui/Toast'
import { formatCurrency, formatDate, formatDateTime } from '../../../utils/formatters'
import { validateBookingAdminAction } from '../../../utils/adminValidation'
import { PaginationControls } from '../../../components/ui/PaginationControls'
import { PillStat } from '../../../components/ui/PillStat'
import { PillStatRow } from '../../../components/ui/PillStatRow'
import { useNavigationGuard } from '../../../hooks/useNavigationGuard'
import { readPaginatedData } from '../../../services/pagination'
import '../../../styles/features/bookings/BookingsAdminPage.css'
import { advisorService } from '../../advisors/services/advisorService'
import { availabilityService } from '../../availability/services/availabilityService'
import { bookingService } from '../services/bookingService'

const KPI_ITEMS = [
  { key: '', label: 'All Bookings', icon: 'BK', bg: '#fff0e6', cls: 'kpi-blue' },
  { key: 'PENDING', label: 'Pending', icon: 'PD', bg: '#fef3c7', cls: 'kpi-amber' },
  { key: 'CONFIRMED', label: 'Confirmed', icon: 'CF', bg: '#dbeafe', cls: 'kpi-blue' },
  { key: 'RESCHEDULED', label: 'Rescheduled', icon: 'RS', bg: '#ede9fe', cls: 'kpi-blue' },
  { key: 'COMPLETED', label: 'Completed', icon: 'CP', bg: '#dcfce7', cls: 'kpi-green' },
  { key: 'CANCELLED', label: 'Cancelled', icon: 'CX', bg: '#fee2e2', cls: 'kpi-red' },
]
const STATUS_OPTIONS = ['', 'PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'RESCHEDULED']
const STATUS_ORDER = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'RESCHEDULED']
const TRACKER_STEPS = ['Booking Received', 'Advisor Assigned', 'Service In Progress', 'Completed']
const PAGE_SIZE = 8
const bookingPaymentStatus = (booking) => {
  if (booking?.paymentStatus) return booking.paymentStatus
  // bookingChargeAmount being present (even 0) means an invoice was created
  // — customer has paid the booking charge → always PARTIALLY_PAID
  if (booking?.bookingChargeAmount != null) return 'PARTIALLY_PAID'
  if (
    booking?.bookingChargePaidAt ||
    booking?.bookingChargeTransactionReference ||
    booking?.bookingChargePaymentMethod
  ) {
    return 'PARTIALLY_PAID'
  }
  return ''
}
const renderPaymentStatus = (booking) => {
  const status = bookingPaymentStatus(booking)
  return status ? <StatusBadge status={status} /> : 'N/A'
}

const bookingNumber = (id) => id ? `BK-${new Date().getFullYear()}-${String(id).padStart(4, '0')}` : 'Booking'
const actionLabel = (type) => ({ CONFIRMED: 'Confirmed', CANCELLED: 'Cancelled', RESCHEDULED: 'Rescheduled', CREATED: 'Created' }[type] || type || 'Updated')
const trackerState = (status) => status === 'COMPLETED' ? [1, 1, 1, 1] : status === 'IN_PROGRESS' ? [1, 1, 1, 0] : status === 'CONFIRMED' ? [1, 1, 0, 0] : status === 'RESCHEDULED' ? [1, 0, 0, 0] : [1, 0, 0, 0]
const canModify = (booking) => Boolean(booking) && !['CANCELLED', 'COMPLETED', 'IN_PROGRESS'].includes(booking.bookingStatus)
const hasAssignedAdvisor = (booking) => Boolean(booking?.advisorId || booking?.advisorName)
const canCancel = (booking) => canModify(booking) && !hasAssignedAdvisor(booking)
const canAdminReassignAdvisor = (booking) => canModify(booking)
const canAdminReschedule = (booking) => canModify(booking)
const isVisibleAdvisor = (advisor) => advisor && !advisor.isDeleted && (advisor.userStatus || 'ACTIVE') === 'ACTIVE'
const canReceiveAssignment = (advisor) => isVisibleAdvisor(advisor) && !['ON_LEAVE', 'RESIGNED'].includes(advisor.availabilityStatus) && !(advisor.availabilityStatus === 'ASSIGNED' && Number(advisor.currentLoad || 0) >= 5)

export function BookingsAdminPage() {
  const toast = useToast()
  const [allBookings, setAllBookings] = useState([])
  const [totalBookings, setTotalBookings] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [advisors, setAdvisors] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [viewing, setViewing] = useState(null)
  const [history, setHistory] = useState([])
  const [assigningBooking, setAssigningBooking] = useState(null)
  const [reschedulingBooking, setReschedulingBooking] = useState(null)
  const [cancellingBooking, setCancellingBooking] = useState(null)
  const [advisorId, setAdvisorId] = useState('')
  const [rescheduleForm, setRescheduleForm] = useState({ newDate: '', newSlot: '', reason: '' })
  const [cancelReason, setCancelReason] = useState('')
  const [slots, setSlots] = useState([])
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(1)
  const guardNavigation = useNavigationGuard(
    Boolean(
      saving ||
      (assigningBooking && advisorId) ||
      (reschedulingBooking && (rescheduleForm.newDate || rescheduleForm.newSlot || rescheduleForm.reason)) ||
      (cancellingBooking && cancelReason)
    ),
    'A booking management flow is still in progress. Leaving now may discard it. Continue?'
  )

  async function loadData() {
    setLoading(true)
    try {
      const [bookingsResponse, advisorsResponse] = await Promise.all([
        bookingService.list({
          page,
          size: PAGE_SIZE,
          status: statusFilter || undefined,
          q: search.trim() || undefined,
          dateFrom: dateFrom || undefined,
          sort: sortBy,
        }),
        advisorService.list(),
      ])
      const bookingPage = readPaginatedData(bookingsResponse.data, { page, size: PAGE_SIZE })
      setAllBookings(bookingPage.content || [])
      setTotalBookings(bookingPage.totalElements)
      setTotalPages(bookingPage.totalPages)
      setAdvisors((advisorsResponse.data || []).filter(isVisibleAdvisor))
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to load bookings.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [page, search, statusFilter, dateFrom, sortBy])

  async function openViewModal(booking) {
    try {
      const [bookingResponse, historyResponse] = await Promise.all([
        bookingService.getById(booking.bookingId),
        bookingService.getHistory(booking.bookingId),
      ])
      setViewing(bookingResponse.data || booking)
      setHistory(historyResponse.data || [])
    } catch {
      setViewing(booking)
      setHistory([])
    }
  }

  async function loadSlots(date) {
    if (!date) return setSlots([])
    try {
      const response = await availabilityService.bookable({ from: date, to: date })
      setSlots(response.data || [])
    } catch {
      setSlots([])
    }
  }

  const activeBookings = useMemo(() => allBookings, [allBookings])

  const counts = useMemo(() => ({
    total: totalBookings,
    PENDING: allBookings.filter((booking) => booking.bookingStatus === 'PENDING').length,
    CONFIRMED: allBookings.filter((booking) => booking.bookingStatus === 'CONFIRMED').length,
    RESCHEDULED: allBookings.filter((booking) => booking.bookingStatus === 'RESCHEDULED').length,
    COMPLETED: allBookings.filter((booking) => booking.bookingStatus === 'COMPLETED').length,
    CANCELLED: allBookings.filter((booking) => booking.bookingStatus === 'CANCELLED').length,
  }), [allBookings])

  const advisorWorkload = useMemo(() => [...advisors].filter((advisor) => Number(advisor.currentLoad || 0) > 0).sort((a, b) => Number(b.currentLoad || 0) - Number(a.currentLoad || 0)).slice(0, 6), [advisors])
  const upcomingBookings = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const nextWeek = new Date(today)
    nextWeek.setDate(nextWeek.getDate() + 7)
    return allBookings.filter((booking) => !['CANCELLED', 'COMPLETED'].includes(booking.bookingStatus)).filter((booking) => {
      const serviceDate = new Date(booking.serviceDate)
      return serviceDate >= today && serviceDate <= nextWeek
    }).sort((a, b) => new Date(a.serviceDate) - new Date(b.serviceDate)).slice(0, 6)
  }, [allBookings])

  const activePills = []
  if (statusFilter) activePills.push(statusFilter.replace('_', ' '))
  if (dateFrom) activePills.push(`From ${formatDate(dateFrom)}`)
  if (search.trim()) activePills.push(`"${search.trim()}"`)
  const pagedBookings = activeBookings

  const assignableAdvisors = advisors.filter((advisor) => canReceiveAssignment(advisor) && (!assigningBooking?.advisorId || advisor.advisorId !== assigningBooking.advisorId))

  function resetFilters() { setSearch(''); setStatusFilter(''); setDateFrom(''); setSortBy('newest'); setPage(1) }
  function openAssignModal(booking) { setAssigningBooking(booking); setAdvisorId(''); setErrors({}) }
  function openRescheduleModal(booking) { setReschedulingBooking(booking); setRescheduleForm({ newDate: booking.serviceDate || '', newSlot: booking.timeSlot || '', reason: '' }); setErrors({}); loadSlots(booking.serviceDate) }
  function openCancelModal(booking) { setCancellingBooking(booking); setCancelReason(''); setErrors({}) }

  useEffect(() => { setPage(1) }, [search, statusFilter, dateFrom, sortBy])
  useEffect(() => { setPage((current) => Math.min(current, totalPages)) }, [totalPages])

  async function handleAssign() {
    const mode = assigningBooking?.advisorId ? 'reassign' : 'confirm'
    const { errors: nextErrors, isValid } = validateBookingAdminAction(mode, { advisorId }, advisors)
    if (!isValid) return setErrors(nextErrors)
    setSaving(true)
    try {
      if (assigningBooking?.advisorId) await bookingService.reassignAdvisor(assigningBooking.bookingId, { advisorId: Number(advisorId) })
      else await bookingService.confirm(assigningBooking.bookingId, { advisorId: Number(advisorId), bookingChargePaid: false })
      if (assigningBooking?.advisorId) toast('Advisor reassigned successfully.')
      else if (assigningBooking?.bookingStatus === 'RESCHEDULED') toast('Booking reconfirmed and advisor assigned successfully.')
      else toast('Advisor assigned successfully.')
      setAssigningBooking(null)
      await loadData()
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to save advisor assignment.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleReschedule() {
    const { errors: nextErrors, isValid } = validateBookingAdminAction('reschedule', rescheduleForm)
    if (!isValid) return setErrors(nextErrors)
    setSaving(true)
    try {
      await bookingService.reschedule(reschedulingBooking.bookingId, { ...rescheduleForm, reason: rescheduleForm.reason.trim() })
      toast(reschedulingBooking?.advisorId
        ? 'Booking rescheduled. Existing advisor assignment was cleared and reconfirmation is required.'
        : 'Booking rescheduled successfully.')
      setReschedulingBooking(null)
      await loadData()
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to reschedule booking.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel() {
    const { errors: nextErrors, isValid } = validateBookingAdminAction('cancel', { reason: cancelReason })
    if (!isValid) return setErrors(nextErrors)
    setSaving(true)
    try {
      await bookingService.cancel(cancellingBooking.bookingId, { reason: cancelReason.trim() })
      toast('Booking cancelled successfully.')
      setCancellingBooking(null)
      await loadData()
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to cancel booking.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminLayout activeKey="bookings">
      <div className="bookings-page">
        <section className="page-header bookings-hero"><div className="container-fluid px-4"><div className="d-flex justify-content-between align-items-center flex-wrap gap-3"><div><h2 className="text-white mb-0">Bookings Management</h2><p className="mb-0 page-subtitle">View, assign, reschedule, and manage service bookings.</p></div><Link to="/admin/book-service" className="bookings-add-btn">New Booking</Link></div></div></section>
        <div className="container-fluid px-4 py-3">
          <PillStatRow>{KPI_ITEMS.map((item) => <PillStat key={item.label} label={item.label} value={item.key ? counts[item.key] : counts.total} color={item.bg} onClick={() => setStatusFilter(item.key)} />)}</PillStatRow>
          <div className="toolbar-card bookings-toolbar-card"><div className="row g-2 align-items-end"><div className="col-md-4"><label className="toolbar-label">Search</label><div className="input-group input-group-sm"><span className="input-group-text bg-white border-end-0 bookings-toolbar-icon">Find</span><input type="text" className="form-control border-start-0" placeholder="Booking #, customer, vehicle..." value={search} onChange={(e) => setSearch(e.target.value)} /></div></div><div className="col-md-2"><label className="toolbar-label">Status</label><select className="form-select form-select-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All Statuses</option>{STATUS_OPTIONS.filter(Boolean).map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}</select></div><div className="col-md-2"><label className="toolbar-label">Date From</label><input type="date" className="form-control form-control-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div><div className="col-md-2"><label className="toolbar-label">Sort</label><select className="form-select form-select-sm" value={sortBy} onChange={(e) => setSortBy(e.target.value)}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="date-asc">Date ↑</option><option value="date-desc">Date ↓</option></select></div><div className="col-md-2"><button type="button" className="btn-reset w-100" onClick={resetFilters}>Reset</button></div></div></div>
          <div className="bookings-layout">
            <div>
              <div className="results-bar"><div className="d-flex align-items-center gap-2 flex-wrap"><span className="legend-item"><span className="legend-dot legend-pending" />Pending</span><span className="legend-item"><span className="legend-dot legend-confirmed" />Confirmed</span><span className="legend-item"><span className="legend-dot legend-rescheduled" />Needs Reconfirm</span><span className="legend-item"><span className="legend-dot legend-progress" />In Progress</span><span className="legend-item"><span className="legend-dot legend-completed" />Completed</span><span className="legend-item"><span className="legend-dot legend-cancelled" />Cancelled</span></div><small className="text-muted">{totalBookings ? `Showing ${((page - 1) * PAGE_SIZE) + 1}-${Math.min(page * PAGE_SIZE, totalBookings)} of ${totalBookings} bookings` : '0 bookings'}</small></div>
              <div className="d-flex gap-1 flex-wrap mb-2">{activePills.map((pill) => <span key={pill} className="filter-pill">{pill}</span>)}</div>
              {loading ? <div className="section-card"><PageSpinner /></div> : !activeBookings.length ? <div className="bookings-empty-state"><h6 className="mb-1">No bookings found</h6><p className="mb-3">Try adjusting your filters.</p><button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetFilters}>Clear Filters</button></div> : <div className="bookings-list">{pagedBookings.map((booking) => <article key={booking.bookingId} className="booking-card"><div className={`booking-accent booking-accent-${booking.bookingStatus?.toLowerCase() || 'pending'}`} /><div className="booking-body"><div className="booking-row-top"><StatusBadge status={booking.bookingStatus} /><span className="booking-number">{bookingNumber(booking.bookingId)}</span><span className="booking-sep">•</span><span className="booking-service">{booking.serviceName || 'Service'}</span></div><div className="booking-row-bottom"><div className="booking-vehicle"><div className="booking-vehicle-main">{booking.vehicleInfo || 'Vehicle not available'}</div><div className="booking-vehicle-sub">Owner: {booking.ownerName || 'Unknown customer'}</div></div><div className="booking-date-block"><div className="booking-date-label">Service Date</div><div className="booking-date-value">{formatDate(booking.serviceDate)}</div><div className="booking-slot">{booking.timeSlot || '—'}</div></div><div className="booking-advisor"><div className="booking-date-label">Advisor</div><div className="booking-advisor-value">{booking.advisorName || (booking.bookingStatus === 'RESCHEDULED' ? 'Awaiting reconfirmation' : 'Unassigned')}</div></div><div className="booking-actions"><ActionIconButton icon="view" label="View booking" onClick={() => openViewModal(booking)} /><ActionIconButton icon={booking.advisorId ? 'reassign' : 'confirm'} label={booking.advisorId ? 'Reassign advisor' : booking.bookingStatus === 'RESCHEDULED' ? 'Reconfirm & assign advisor' : 'Assign advisor'} onClick={() => openAssignModal(booking)} disabled={!canModify(booking)} /><ActionIconButton icon="reschedule" label="Reschedule booking" onClick={() => openRescheduleModal(booking)} disabled={!canModify(booking)} /><ActionIconButton icon="cancel" label="Cancel booking" className="action-danger" onClick={() => openCancelModal(booking)} disabled={!canCancel(booking)} /></div></div></div></article>)}</div>}
              <PaginationControls page={page} totalItems={totalBookings} pageSize={PAGE_SIZE} totalPages={totalPages} onPageChange={setPage} />
            </div>
            <aside className="bookings-sidebar">
              <div className="sidebar-card"><div className="sidebar-title">Status Breakdown</div><div className="d-flex flex-column gap-3">{STATUS_ORDER.map((status) => { const count = activeBookings.filter((booking) => booking.bookingStatus === status).length; const total = activeBookings.length || 1; return <div key={status}><div className="d-flex justify-content-between small fw-semibold mb-1"><span>{status === 'RESCHEDULED' ? 'Needs Reconfirm' : status.replace('_', ' ')}</span><span>{count}</span></div><div className="bookings-progress-track"><div className={`bookings-progress-fill bookings-progress-${status.toLowerCase()}`} style={{ width: `${Math.round((count / total) * 100)}%` }} /></div></div> })}</div></div>
              <div className="sidebar-card"><div className="sidebar-title">Advisor Workload</div>{!advisorWorkload.length ? <p className="text-muted small text-center mb-0">No active assignments</p> : <div className="d-flex flex-column gap-3">{advisorWorkload.map((advisor) => <div key={advisor.advisorId} className="advisor-load-row"><div className="advisor-load-avatar">{advisor.fullName?.charAt(0)?.toUpperCase() || 'A'}</div><div className="flex-grow-1 min-w-0"><div className="advisor-load-name">{advisor.fullName}</div><div className="advisor-load-meta">{advisor.specialization || 'General'}</div></div><div className="advisor-load-count">{advisor.currentLoad} active</div></div>)}</div>}</div>
              <div className="sidebar-card"><div className="sidebar-title">Upcoming (Next 7 Days)</div>{!upcomingBookings.length ? <p className="text-muted small text-center mb-0">No upcoming bookings</p> : <div className="d-flex flex-column gap-3">{upcomingBookings.map((booking) => <div key={booking.bookingId} className="upcoming-booking-row"><span className={`upcoming-booking-dot upcoming-booking-dot-${booking.bookingStatus?.toLowerCase() || 'pending'}`} /><div className="flex-grow-1 min-w-0"><div className="upcoming-booking-number">{bookingNumber(booking.bookingId)}</div><div className="upcoming-booking-meta">{booking.vehicleInfo || 'Vehicle not available'}</div></div><span className="upcoming-booking-date">{formatDate(booking.serviceDate)}</span></div>)}</div>}</div>
            </aside>
          </div>
          {viewing ? <BookingViewModal booking={viewing} history={history} onClose={() => setViewing(null)} /> : null}
          {assigningBooking ? <AssignModal booking={assigningBooking} advisors={assignableAdvisors} advisorId={advisorId} errors={errors} saving={saving} onClose={() => guardNavigation(() => setAssigningBooking(null))} onChange={setAdvisorId} onSave={handleAssign} /> : null}
          {reschedulingBooking ? <RescheduleModal booking={reschedulingBooking} form={rescheduleForm} slots={slots} errors={errors} saving={saving} onClose={() => guardNavigation(() => setReschedulingBooking(null))} onDateChange={(value) => { setRescheduleForm((p) => ({ ...p, newDate: value, newSlot: '' })); loadSlots(value) }} onFieldChange={(key, value) => setRescheduleForm((p) => ({ ...p, [key]: value }))} onSave={handleReschedule} /> : null}
          {cancellingBooking ? <CancelModal booking={cancellingBooking} value={cancelReason} errors={errors} saving={saving} onClose={() => guardNavigation(() => setCancellingBooking(null))} onChange={setCancelReason} onSave={handleCancel} /> : null}
        </div>
      </div>
    </AdminLayout>
  )
}

function BookingViewModal({ booking, history, onClose }) {
  return <div className="modal fade show d-block bookings-modal-backdrop"><div className="modal-dialog modal-dialog-centered modal-lg"><div className="modal-content"><div className="modal-header bookings-modal-header"><h5 className="modal-title text-white">{bookingNumber(booking.bookingId)}</h5><button type="button" className="btn-close btn-close-white" onClick={onClose} /></div><div className="modal-body"><div className="detail-grid mb-4">{[['Booking #', bookingNumber(booking.bookingId)], ['Status', <StatusBadge key="status" status={booking.bookingStatus} />], ['Customer', booking.ownerName || 'Unknown customer'], ['Vehicle', booking.vehicleInfo || 'Vehicle not available'], ['Service', booking.serviceName || 'Service'], ['Booking Charge', booking.bookingChargeAmount != null ? formatCurrency(booking.bookingChargeAmount) : '-'], ['Date', formatDate(booking.serviceDate)], ['Time Slot', booking.timeSlot || '—'], ['Advisor', booking.advisorName || (booking.bookingStatus === 'RESCHEDULED' ? 'Awaiting reconfirmation' : 'Unassigned')], ['Payment Method', booking.bookingChargePaymentMethod || '-'], ['Payment Ref', booking.bookingChargeTransactionReference || '-'], ['Paid At', formatDateTime(booking.bookingChargePaidAt)], ['Booked On', formatDateTime(booking.createdAt)], ['Notes', booking.bookingNotes || '—']].map(([label, value]) => <div key={label} className="detail-cell"><div className="detail-label">{label}</div><div className="detail-value">{value}</div></div>)}</div><div className="bookings-section-heading mb-2">Service Progress</div><div className="tracking-steps mb-4">{TRACKER_STEPS.map((step, index) => { const state = trackerState(booking.bookingStatus); return <div key={step} className="tracking-step"><div className={`tracking-bar ${state[index] ? 'done' : ''}`} /><div className={`tracking-label ${state[index] ? 'done' : ''}`}>{step}</div></div> })}</div>{booking.bookingStatus === 'RESCHEDULED' ? <div className="alert alert-warning small py-2">This booking is waiting for advisor reconfirmation on the new slot.</div> : null}<div className="bookings-section-heading mb-2">History</div>{!history.length ? <p className="text-muted small mb-0">No history available for this booking.</p> : <div className="d-flex flex-column gap-3">{history.map((entry) => <div key={entry.historyId} className="booking-history-row"><div className="booking-history-dot" /><div><div className="booking-history-title">{actionLabel(entry.actionType)}{entry.reason ? <span className="text-muted"> • {entry.reason}</span> : null}</div><div className="booking-history-meta">{entry.actionByName || 'System'} • {formatDateTime(entry.actionDate)}</div></div></div>)}</div>}</div><div className="modal-footer"><button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Close</button></div></div></div></div>
}

function AssignModal({ booking, advisors, advisorId, errors, saving, onClose, onChange, onSave }) {
  const isReconfirm = booking.bookingStatus === 'RESCHEDULED' && !booking.advisorId
  return <div className="modal fade show d-block bookings-modal-backdrop"><div className="modal-dialog modal-dialog-centered"><div className="modal-content"><div className="modal-header bookings-modal-header"><h5 className="modal-title text-white">{booking.advisorId ? 'Reassign Service Advisor' : isReconfirm ? 'Reconfirm Booking With Advisor' : 'Assign Service Advisor'}</h5><button type="button" className="btn-close btn-close-white" onClick={onClose} /></div><div className="modal-body"><p className="bookings-modal-desc">{booking.advisorId ? 'Choose a different advisor for' : isReconfirm ? 'Select an advisor to reconfirm' : 'Assign an advisor to'} <strong>{bookingNumber(booking.bookingId)}</strong>.</p>{isReconfirm ? <div className="alert alert-warning small py-2">This booking is rescheduled and will return to confirmed once an advisor is assigned for the new slot.</div> : null}<label className="bookings-modal-label">Select Advisor</label><select className={`form-select ${errors.advisorId ? 'is-invalid' : ''}`} value={advisorId} onChange={(e) => onChange(e.target.value)}><option value="">{advisors.length ? 'Select advisor' : 'No advisors available'}</option>{advisors.map((advisor) => <option key={advisor.advisorId} value={advisor.advisorId}>{advisor.fullName} - {advisor.specialization || 'General'} ({advisor.availabilityStatus}, load {advisor.currentLoad || 0}/5)</option>)}</select>{errors.advisorId ? <div className="invalid-feedback d-block">{errors.advisorId}</div> : null}</div><div className="modal-footer"><button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button><button type="button" className="bookings-save-btn" disabled={saving} onClick={onSave}>{saving ? 'Saving...' : booking.advisorId ? 'Reassign' : isReconfirm ? 'Reconfirm & Assign' : 'Assign'}</button></div></div></div></div>
}

function RescheduleModal({ booking, form, slots, errors, saving, onClose, onDateChange, onFieldChange, onSave }) {
  return <div className="modal fade show d-block bookings-modal-backdrop"><div className="modal-dialog modal-dialog-centered"><div className="modal-content"><div className="modal-header bookings-modal-header"><h5 className="modal-title text-white">Reschedule Booking</h5><button type="button" className="btn-close btn-close-white" onClick={onClose} /></div><div className="modal-body"><p className="bookings-modal-desc">Rescheduling <strong>{bookingNumber(booking.bookingId)}</strong></p>{booking.advisorId ? <div className="alert alert-warning small py-2">The current advisor assignment will be cleared and this booking will need reconfirmation for the new slot.</div> : null}<div className="mb-3"><label className="bookings-modal-label">New Service Date</label><input type="date" className={`form-control ${errors.newDate ? 'is-invalid' : ''}`} value={form.newDate} min={new Date().toISOString().split('T')[0]} onChange={(e) => onDateChange(e.target.value)} />{errors.newDate ? <div className="invalid-feedback">{errors.newDate}</div> : null}</div><div className="mb-3"><label className="bookings-modal-label">New Time Slot</label><select className={`form-select ${errors.newSlot ? 'is-invalid' : ''}`} value={form.newSlot} onChange={(e) => onFieldChange('newSlot', e.target.value)}><option value="">{slots.length ? 'Select time slot' : 'Select a date first'}</option>{slots.map((slot) => <option key={slot.availabilityId} value={slot.timeSlot}>{slot.timeSlot}</option>)}</select>{errors.newSlot ? <div className="invalid-feedback">{errors.newSlot}</div> : null}</div><div><label className="bookings-modal-label">Reason</label><textarea className={`form-control ${errors.reason ? 'is-invalid' : ''}`} rows={3} value={form.reason} onChange={(e) => onFieldChange('reason', e.target.value)} />{errors.reason ? <div className="invalid-feedback">{errors.reason}</div> : null}</div></div><div className="modal-footer"><button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button><button type="button" className="bookings-save-btn" disabled={saving} onClick={onSave}>{saving ? 'Saving...' : 'Reschedule'}</button></div></div></div></div>
}

function CancelModal({ booking, value, errors, saving, onClose, onChange, onSave }) {
  return <div className="modal fade show d-block bookings-modal-backdrop"><div className="modal-dialog modal-dialog-centered"><div className="modal-content"><div className="modal-header bookings-danger-header"><h5 className="modal-title text-white">Cancel Booking</h5><button type="button" className="btn-close btn-close-white" onClick={onClose} /></div><div className="modal-body"><p className="bookings-modal-desc">{bookingNumber(booking.bookingId)} • {booking.vehicleInfo || 'Vehicle not available'} • {formatDate(booking.serviceDate)}</p><label className="bookings-modal-label">Cancellation Reason</label><textarea className={`form-control ${errors.reason ? 'is-invalid' : ''}`} rows={3} value={value} onChange={(e) => onChange(e.target.value)} />{errors.reason ? <div className="invalid-feedback">{errors.reason}</div> : null}</div><div className="modal-footer"><button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Keep Booking</button><button type="button" className="btn btn-danger btn-sm" disabled={saving} onClick={onSave}>{saving ? 'Cancelling...' : 'Cancel Booking'}</button></div></div></div></div>
}



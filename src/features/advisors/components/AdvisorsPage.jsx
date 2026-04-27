import { useEffect, useMemo, useState } from 'react'
import { AdminLayout } from '../../../layouts/AppShell'
import { AdminPageHero, PageContent } from '../../../components/common/PageElements'
import { PageSpinner } from '../../../components/ui/Spinner'
import { StatusBadge } from '../../../components/ui/Badge'
import { ActionIconButton } from '../../../components/ui/ActionIconButton'
import { useToast } from '../../../components/ui/Toast'
import { formatCurrency, formatDate, formatDateTime } from '../../../utils/formatters'
import { validateAdvisorForm, validateBookingAdminAction } from '../../../utils/adminValidation'
import { PaginationControls } from '../../../components/ui/PaginationControls'
import { PillStat } from '../../../components/ui/PillStat'
import { PillStatRow } from '../../../components/ui/PillStatRow'
import { Modal } from '../../../components/ui/Modal'
import { useNavigationGuard } from '../../../hooks/useNavigationGuard'
import { ADVISOR_STATUSES, BOOKING_STATUSES } from '../../../config/constants'
import '../../../styles/features/advisors/AdvisorsPage.css'
import { advisorService } from '../services/advisorService'
import { bookingService } from '../../bookings/services/bookingService'

const OPEN_BOOKING_STATUSES = BOOKING_STATUSES.filter((status) => ['PENDING', 'CONFIRMED', 'RESCHEDULED'].includes(status))
const MAX_LOAD = 5
const ADVISOR_PAGE_SIZE = 6
const BOOKING_PAGE_SIZE = 6

const STATUS_LABELS = {
  AVAILABLE: 'Available',
  ASSIGNED: 'Assigned',
  ON_LEAVE: 'On Leave',
  RESIGNED: 'Resigned',
}

const STATUS_META = {
  AVAILABLE: { accent: '#16a34a', soft: '#dcfce7', icon: 'AV' },
  ASSIGNED: { accent: '#d97706', soft: '#fef3c7', icon: 'AS' },
  ON_LEAVE: { accent: '#64748b', soft: '#e2e8f0', icon: 'OL' },
  RESIGNED: { accent: '#dc2626', soft: '#fee2e2', icon: 'RS' },
}

const BOOKING_META = {
  PENDING: { accent: '#d97706', soft: '#fef3c7' },
  CONFIRMED: { accent: '#16a34a', soft: '#dcfce7' },
  RESCHEDULED: { accent: '#2563eb', soft: '#dbeafe' },
}

const EMPTY_FORM = { specialization: '', overtimeRate: '', availabilityStatus: 'AVAILABLE' }

const isVisibleAdvisor = (advisor) => advisor && !advisor.isDeleted
const bookingLabel = (booking) => booking?.bookingNumber || 'Booking'
const loadTone = (load) => (load >= MAX_LOAD ? '#dc2626' : load >= 3 ? '#d97706' : '#16a34a')
const loadState = (load) => (load >= MAX_LOAD ? 'At Capacity' : load >= 3 ? 'High Load' : load > 0 ? 'Active' : 'No Active Orders')

function normalizeBooking(booking) {
  return {
    ...booking,
    bookingStatus: booking.bookingStatus || 'PENDING',
    serviceDate: booking.serviceDate || '',
    bookingNumber: booking.bookingNumber || '',
    vehicleInfo: booking.vehicleInfo || '',
    serviceName: booking.serviceName || '',
  }
}

function bookingSortValue(booking = {}) {
  return new Date(booking.createdAt || booking.updatedAt || 0).getTime() || 0
}

function advisorSortValue(advisor = {}) {
  return new Date(advisor.lastAssignedAt || advisor.updatedAt || advisor.createdAt || 0).getTime() || 0
}

function canAssignAdvisor(advisor) {
  if (!advisor || !isVisibleAdvisor(advisor) || (advisor.userStatus || 'ACTIVE') !== 'ACTIVE') return false
  if (['ON_LEAVE', 'RESIGNED'].includes(advisor.availabilityStatus)) return false
  if (advisor.availabilityStatus === 'ASSIGNED' && Number(advisor.currentLoad || 0) >= MAX_LOAD) return false
  return true
}

function pendingAssignmentFilter(booking) {
  const normalized = normalizeBooking(booking)
  return !normalized.advisorId && !normalized.advisorName && !['COMPLETED', 'CANCELLED', 'IN_PROGRESS'].includes(normalized.bookingStatus)
}

function warningForStatusChange(advisor, newStatus) {
  const load = Number(advisor?.currentLoad || 0)
  if (newStatus === 'AVAILABLE' && load > 0) {
    return { type: 'warning', message: `${advisor.fullName} still has ${load} active assignment${load === 1 ? '' : 's'}.` }
  }
  if ((newStatus === 'ON_LEAVE' || newStatus === 'RESIGNED') && load > 0) {
    return { type: 'error', message: `Cannot move this advisor to ${STATUS_LABELS[newStatus]} while ${load} active assignment${load === 1 ? '' : 's'} remain.` }
  }
  return null
}

function AdvisorModal({ title, subtitle, children, onClose }) {
  return (
    <Modal
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      open
    >
      {children}
    </Modal>
  )
}

export function AdvisorsPage() {
  const toast = useToast()
  const [advisors, setAdvisors] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [advisorQuery, setAdvisorQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [specializationFilter, setSpecializationFilter] = useState('')
  const [bookingQuery, setBookingQuery] = useState('')
  const [bookingStatusFilter, setBookingStatusFilter] = useState('')
  const [editingAdvisor, setEditingAdvisor] = useState(null)
  const [statusAdvisor, setStatusAdvisor] = useState(null)
  const [assigningBooking, setAssigningBooking] = useState(null)
  const [preferredAdvisorId, setPreferredAdvisorId] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [selectedAdvisorId, setSelectedAdvisorId] = useState('')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [advisorPage, setAdvisorPage] = useState(1)
  const [bookingPage, setBookingPage] = useState(1)
  const guardNavigation = useNavigationGuard(
    Boolean(
      saving ||
      (editingAdvisor && (
        form.specialization !== (editingAdvisor.specialization || '') ||
        String(form.overtimeRate) !== String(editingAdvisor.overtimeRate ?? '')
      )) ||
      (statusAdvisor && form.availabilityStatus !== (statusAdvisor.availabilityStatus || 'AVAILABLE')) ||
      (assigningBooking && selectedAdvisorId)
    ),
    'An advisor management flow is still in progress. Leaving now may discard it. Continue?'
  )

  async function loadData() {
    setLoading(true)
    try {
      const [advisorsResponse, bookingsResponse] = await Promise.all([advisorService.list(), bookingService.list()])
      setAdvisors((advisorsResponse.data || []).filter(isVisibleAdvisor))
      setBookings((bookingsResponse.data || []).map(normalizeBooking))
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to load advisor data.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const specializations = useMemo(() => [...new Set(advisors.map((advisor) => advisor.specialization).filter(Boolean))].sort((left, right) => left.localeCompare(right)), [advisors])

  const filteredAdvisors = useMemo(() => {
    const q = advisorQuery.trim().toLowerCase()
    return advisors
      .filter((advisor) => {
        if (statusFilter && advisor.availabilityStatus !== statusFilter) return false
        if (specializationFilter && advisor.specialization !== specializationFilter) return false
        if (!q) return true
        return [advisor.fullName, advisor.email, advisor.specialization].filter(Boolean).join(' ').toLowerCase().includes(q)
      })
      .sort((left, right) => (
        Number(right.currentLoad || 0) - Number(left.currentLoad || 0) ||
        advisorSortValue(right) - advisorSortValue(left) ||
        Number(right.advisorId || 0) - Number(left.advisorId || 0)
      ))
  }, [advisors, advisorQuery, statusFilter, specializationFilter])

  const pendingBookings = useMemo(() => bookings.filter(pendingAssignmentFilter), [bookings])

  const filteredPendingBookings = useMemo(() => {
    const q = bookingQuery.trim().toLowerCase()
    return pendingBookings
      .filter((booking) => {
        if (bookingStatusFilter && booking.bookingStatus !== bookingStatusFilter) return false
        if (!q) return true
        return [bookingLabel(booking), booking.vehicleInfo, booking.serviceName, booking.ownerName].filter(Boolean).join(' ').toLowerCase().includes(q)
      })
      .sort((left, right) => (
        bookingSortValue(right) - bookingSortValue(left) ||
        Number(right.bookingId || 0) - Number(left.bookingId || 0)
      ))
  }, [pendingBookings, bookingQuery, bookingStatusFilter])

  const counts = useMemo(() => ({
    total: advisors.length,
    available: advisors.filter((advisor) => advisor.availabilityStatus === 'AVAILABLE').length,
    assigned: advisors.filter((advisor) => advisor.availabilityStatus === 'ASSIGNED').length,
    totalLoad: advisors.reduce((sum, advisor) => sum + Number(advisor.currentLoad || 0), 0),
    pendingBookings: pendingBookings.length,
  }), [advisors, pendingBookings])

  const advisorPills = []
  if (statusFilter) advisorPills.push(STATUS_LABELS[statusFilter] || statusFilter)
  if (specializationFilter) advisorPills.push(specializationFilter)
  if (advisorQuery.trim()) advisorPills.push(`"${advisorQuery.trim()}"`)

  const bookingPills = []
  if (bookingStatusFilter) bookingPills.push(bookingStatusFilter)
  if (bookingQuery.trim()) bookingPills.push(`"${bookingQuery.trim()}"`)

  const availableForAssignment = useMemo(() => advisors.filter(canAssignAdvisor), [advisors])
  const assignOptions = useMemo(() => {
    if (!assigningBooking) return []
    return availableForAssignment
      .filter((advisor) => !preferredAdvisorId || String(advisor.advisorId) === String(preferredAdvisorId) || canAssignAdvisor(advisor))
      .sort((left, right) => Number(left.currentLoad || 0) - Number(right.currentLoad || 0))
  }, [availableForAssignment, assigningBooking, preferredAdvisorId])

  const availabilityBreakdown = useMemo(() => ADVISOR_STATUSES.map((status) => ({
    status,
    count: advisors.filter((advisor) => advisor.availabilityStatus === status).length,
  })), [advisors])

  const workloadBuckets = useMemo(() => {
    const buckets = [
      { label: 'No Load (0)', count: 0, accent: '#16a34a' },
      { label: 'Low (1-2)', count: 0, accent: '#0f766e' },
      { label: 'Medium (3-4)', count: 0, accent: '#d97706' },
      { label: 'Full (5)', count: 0, accent: '#dc2626' },
    ]
    advisors.forEach((advisor) => {
      const load = Number(advisor.currentLoad || 0)
      if (load === 0) buckets[0].count += 1
      else if (load <= 2) buckets[1].count += 1
      else if (load <= 4) buckets[2].count += 1
      else buckets[3].count += 1
    })
    return buckets
  }, [advisors])

  const topLoadedAdvisors = useMemo(() => [...advisors].filter((advisor) => Number(advisor.currentLoad || 0) > 0).sort((left, right) => Number(right.currentLoad || 0) - Number(left.currentLoad || 0)).slice(0, 6), [advisors])
  const specializationBreakdown = useMemo(() => {
    const countsMap = new Map()
    advisors.forEach((advisor) => {
      const key = advisor.specialization || 'General'
      countsMap.set(key, (countsMap.get(key) || 0) + 1)
    })
    return [...countsMap.entries()].sort((left, right) => right[1] - left[1]).slice(0, 6)
  }, [advisors])
  const advisorTotalPages = Math.max(1, Math.ceil(filteredAdvisors.length / ADVISOR_PAGE_SIZE))
  const pagedAdvisors = filteredAdvisors.slice((advisorPage - 1) * ADVISOR_PAGE_SIZE, advisorPage * ADVISOR_PAGE_SIZE)
  const bookingTotalPages = Math.max(1, Math.ceil(filteredPendingBookings.length / BOOKING_PAGE_SIZE))
  const pagedPendingBookings = filteredPendingBookings.slice((bookingPage - 1) * BOOKING_PAGE_SIZE, bookingPage * BOOKING_PAGE_SIZE)

  function resetAdvisorFilters() {
    setAdvisorQuery('')
    setStatusFilter('')
    setSpecializationFilter('')
  }

  function resetBookingFilters() {
    setBookingQuery('')
    setBookingStatusFilter('')
  }

  useEffect(() => { setAdvisorPage(1) }, [advisorQuery, statusFilter, specializationFilter])
  useEffect(() => { setBookingPage(1) }, [bookingQuery, bookingStatusFilter])
  useEffect(() => { setAdvisorPage((current) => Math.min(current, advisorTotalPages)) }, [advisorTotalPages])
  useEffect(() => { setBookingPage((current) => Math.min(current, bookingTotalPages)) }, [bookingTotalPages])

  function openEdit(advisor) {
    setEditingAdvisor(advisor)
    setStatusAdvisor(null)
    setForm({
      specialization: advisor.specialization || '',
      overtimeRate: advisor.overtimeRate ?? '',
      availabilityStatus: advisor.availabilityStatus || 'AVAILABLE',
    })
    setErrors({})
  }

  function openStatusEditor(advisor) {
    setStatusAdvisor(advisor)
    setEditingAdvisor(null)
    setForm({
      specialization: advisor.specialization || '',
      overtimeRate: advisor.overtimeRate ?? '',
      availabilityStatus: advisor.availabilityStatus || 'AVAILABLE',
    })
    setErrors({})
  }

  function openAssignModal(booking, advisorId = '') {
    if (!booking) return
    setAssigningBooking(booking)
    setPreferredAdvisorId(advisorId ? String(advisorId) : '')
    setSelectedAdvisorId(advisorId ? String(advisorId) : '')
    setErrors({})
  }

  async function saveAdvisor(event) {
    event.preventDefault()
    const { errors: nextErrors, isValid } = validateAdvisorForm(form)
    if (!isValid) {
      setErrors(nextErrors)
      return
    }
    setSaving(true)
    try {
      await advisorService.update(editingAdvisor.advisorId, {
        specialization: form.specialization.trim(),
        overtimeRate: form.overtimeRate === '' ? null : Number(form.overtimeRate),
        availabilityStatus: form.availabilityStatus,
      })
      toast('Advisor details updated successfully.')
      setEditingAdvisor(null)
      await loadData()
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to update advisor.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function saveAdvisorStatus(event) {
    event.preventDefault()
    const warning = warningForStatusChange(statusAdvisor, form.availabilityStatus)
    if (warning?.type === 'error') {
      setErrors({ availabilityStatus: warning.message })
      return
    }
    const { errors: nextErrors, isValid } = validateAdvisorForm(form)
    if (!isValid) {
      setErrors(nextErrors)
      return
    }
    setSaving(true)
    try {
      await advisorService.update(statusAdvisor.advisorId, {
        specialization: statusAdvisor.specialization || '',
        overtimeRate: statusAdvisor.overtimeRate ?? null,
        availabilityStatus: form.availabilityStatus,
      })
      toast(`Advisor status updated to ${STATUS_LABELS[form.availabilityStatus] || form.availabilityStatus}.`)
      setStatusAdvisor(null)
      await loadData()
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to update advisor status.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function assignBooking() {
    const { errors: nextErrors, isValid } = validateBookingAdminAction('confirm', { advisorId: selectedAdvisorId }, advisors)
    if (!isValid) {
      setErrors(nextErrors)
      return
    }
    setSaving(true)
    try {
      await bookingService.confirm(assigningBooking.bookingId, { advisorId: Number(selectedAdvisorId), bookingChargePaid: false })
      const assigned = advisors.find((advisor) => String(advisor.advisorId) === String(selectedAdvisorId))
      toast(`Booking assigned to ${assigned?.fullName || 'advisor'} successfully.`)
      setAssigningBooking(null)
      setPreferredAdvisorId('')
      setSelectedAdvisorId('')
      await loadData()
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to assign booking.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminLayout activeKey="advisors">
      <div className="advisors-page">
        <AdminPageHero
          title="Service Advisors"
          subtitle="Manage advisor workloads, availability, and pending booking assignments."
          actions={<button type="button" className="admin-hero-btn" onClick={() => openAssignModal(filteredPendingBookings[0] || pendingBookings[0] || null)} disabled={!pendingBookings.length}>Assign Pending Booking</button>}
        />
        <PageContent>
          <PillStatRow>
            {[
              { label: 'Total Advisors', value: counts.total, icon: 'TA', bg: '#fff0e6' },
              { label: 'Available', value: counts.available, icon: 'AV', bg: '#dcfce7' },
              { label: 'Assigned', value: counts.assigned, icon: 'AS', bg: '#fef3c7' },
              { label: 'Work Orders', value: counts.totalLoad, icon: 'WO', bg: '#dbeafe' },
              { label: 'Unassigned Bookings', value: counts.pendingBookings, icon: 'UB', bg: '#fee2e2' },
            ].map((item) => <PillStat key={item.label} label={item.label} value={item.value} color={item.bg} />)}
          </PillStatRow>

          <div className="advisors-layout">
            <div className="advisors-main">
              <section className="toolbar-card advisors-toolbar-card">
                <div className="row g-2 align-items-end">
                  <div className="col-md-5">
                    <label className="toolbar-label">Search Advisors</label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text bg-white border-end-0 advisors-toolbar-icon">Find</span>
                      <input type="text" className="form-control border-start-0 toolbar-input" placeholder="Name, email, specialization..." value={advisorQuery} onChange={(event) => setAdvisorQuery(event.target.value)} />
                    </div>
                  </div>
                  <div className="col-md-3">
                    <label className="toolbar-label">Availability</label>
                    <select className="form-select form-select-sm toolbar-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                      <option value="">All Statuses</option>
                      {ADVISOR_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status] || status}</option>)}
                    </select>
                  </div>
                  <div className="col-md-2">
                    <label className="toolbar-label">Specialization</label>
                    <select className="form-select form-select-sm toolbar-select" value={specializationFilter} onChange={(event) => setSpecializationFilter(event.target.value)}>
                      <option value="">All Specializations</option>
                      {specializations.map((specialization) => <option key={specialization} value={specialization}>{specialization}</option>)}
                    </select>
                  </div>
                  <div className="col-md-2">
                    <button type="button" className="btn-reset w-100" onClick={resetAdvisorFilters}>Reset</button>
                  </div>
                </div>
              </section>

              <div className="results-bar">
                <small className="text-muted">{filteredAdvisors.length ? `Showing ${((advisorPage - 1) * ADVISOR_PAGE_SIZE) + 1}-${Math.min(advisorPage * ADVISOR_PAGE_SIZE, filteredAdvisors.length)} of ${filteredAdvisors.length} advisors` : '0 advisors'}</small>
                <div className="d-flex gap-1 flex-wrap">{advisorPills.map((pill) => <span key={pill} className="filter-pill">{pill}</span>)}</div>
              </div>

              {loading ? <div className="section-card"><PageSpinner /></div> : !filteredAdvisors.length ? <div className="advisors-empty-state"><h6 className="mb-1">No advisors found</h6><p className="mb-3">Try adjusting your filters.</p><button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetAdvisorFilters}>Clear Filters</button></div> : <div className="advisors-grid">{pagedAdvisors.map((advisor) => {
                const meta = STATUS_META[advisor.availabilityStatus] || STATUS_META.AVAILABLE
                const initials = (advisor.fullName || 'A').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
                const load = Number(advisor.currentLoad || 0)
                return <article key={advisor.advisorId} className="advisor-card"><div className="advisor-card-top"><div className="advisor-avatar" style={{ background: meta.accent }}>{initials}</div><div className="advisor-profile"><div className="advisor-name">{advisor.fullName}</div><div className="advisor-email">{advisor.email}</div><div className="advisor-spec">{advisor.specialization || 'General'}</div></div><div className="advisor-badges"><StatusBadge status={advisor.userStatus || 'ACTIVE'} /><span className="advisor-status-pill" style={{ background: meta.soft, color: meta.accent }}>{STATUS_LABELS[advisor.availabilityStatus] || advisor.availabilityStatus}</span></div></div><div className="advisor-card-body"><div className="advisor-metrics"><div><div className="advisor-metric-label">Overtime Rate</div><div className="advisor-metric-value">{advisor.overtimeRate != null ? `${formatCurrency(advisor.overtimeRate)}/hr` : '-'}</div></div><div><div className="advisor-metric-label">Current Load</div><div className="advisor-metric-value">{load}/{MAX_LOAD}</div></div><div><div className="advisor-metric-label">Last Assigned</div><div className="advisor-metric-value">{advisor.lastAssignedAt ? formatDateTime(advisor.lastAssignedAt) : '-'}</div></div></div><div className="advisor-load-heading"><span>Workload</span><span style={{ color: loadTone(load) }}>{loadState(load)}</span></div><div className="advisor-load-track"><div className="advisor-load-fill" style={{ width: `${Math.min((load / MAX_LOAD) * 100, 100)}%`, background: loadTone(load) }} /></div><div className="advisor-actions"><ActionIconButton icon="edit" label="Edit advisor" onClick={() => openEdit(advisor)} /><ActionIconButton icon="toggle" label="Update advisor status" className="action-warning" onClick={() => openStatusEditor(advisor)} /><ActionIconButton icon="confirm" label="Assign pending booking" onClick={() => openAssignModal(filteredPendingBookings[0] || pendingBookings[0] || null, advisor.advisorId)} disabled={!pendingBookings.length || !canAssignAdvisor(advisor)} /></div></div></article>
              })}</div>}
              <PaginationControls page={advisorPage} totalItems={filteredAdvisors.length} pageSize={ADVISOR_PAGE_SIZE} totalPages={advisorTotalPages} onPageChange={setAdvisorPage} />

              <section className="toolbar-card advisors-toolbar-card mt-3">
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                  <div>
                    <h6 className="mb-0">Pending Assignments</h6>
                    <div className="text-muted small">Bookings without an advisor mirror the reference assignment queue.</div>
                  </div>
                  <div className="d-flex gap-1 flex-wrap">{bookingPills.map((pill) => <span key={pill} className="filter-pill">{pill}</span>)}</div>
                </div>
                <div className="row g-2 align-items-end">
                  <div className="col-md-5">
                    <label className="toolbar-label">Search Bookings</label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text bg-white border-end-0 advisors-toolbar-icon">Find</span>
                      <input type="text" className="form-control border-start-0 toolbar-input" placeholder="Booking, vehicle, service..." value={bookingQuery} onChange={(event) => setBookingQuery(event.target.value)} />
                    </div>
                  </div>
                  <div className="col-md-3">
                    <label className="toolbar-label">Status</label>
                    <select className="form-select form-select-sm toolbar-select" value={bookingStatusFilter} onChange={(event) => setBookingStatusFilter(event.target.value)}>
                      <option value="">All Pending Types</option>
                      {OPEN_BOOKING_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </div>
                  <div className="col-md-2">
                    <div className="advisors-pending-count">{filteredPendingBookings.length} open</div>
                  </div>
                  <div className="col-md-2">
                    <button type="button" className="btn-reset w-100" onClick={resetBookingFilters}>Reset</button>
                  </div>
                </div>
              </section>

              {loading ? null : !filteredPendingBookings.length ? <div className="advisors-empty-state compact"><h6 className="mb-1">No pending bookings</h6><p className="mb-0">Everything is assigned right now.</p></div> : <div className="advisor-bookings-list">{pagedPendingBookings.map((booking) => {
                const meta = BOOKING_META[booking.bookingStatus] || BOOKING_META.PENDING
                return <article key={booking.bookingId} className="advisor-booking-card"><div className="advisor-booking-main"><div className="advisor-booking-top"><span className="advisor-booking-number">{bookingLabel(booking)}</span><span className="advisor-booking-pill" style={{ background: meta.soft, color: meta.accent }}>{booking.bookingStatus}</span></div><div className="advisor-booking-service">{booking.serviceName || 'Service'}</div><div className="advisor-booking-vehicle">{booking.vehicleInfo || 'Vehicle information not available'}</div><div className="advisor-booking-meta">{booking.ownerName || 'Unknown customer'} | {formatDate(booking.serviceDate)} | {booking.timeSlot || 'No slot selected'}</div></div><div className="advisor-booking-actions"><button type="button" className="advisor-assign-btn" onClick={() => openAssignModal(booking)}>Assign</button></div></article>
              })}</div>}
              <PaginationControls page={bookingPage} totalItems={filteredPendingBookings.length} pageSize={BOOKING_PAGE_SIZE} totalPages={bookingTotalPages} onPageChange={setBookingPage} />
            </div>

            <aside className="advisors-sidebar">
              <div className="sidebar-card">
                <div className="sidebar-title">Availability Breakdown</div>
                <div className="d-flex flex-column gap-3">
                  {availabilityBreakdown.map(({ status, count }) => {
                    const total = advisors.length || 1
                    const meta = STATUS_META[status]
                    return <div key={status}><div className="d-flex justify-content-between small fw-semibold mb-1"><span>{STATUS_LABELS[status] || status}</span><span>{count}</span></div><div className="advisors-progress-track"><div className="advisors-progress-fill" style={{ width: `${Math.round((count / total) * 100)}%`, background: meta?.accent || '#94a3b8' }} /></div></div>
                  })}
                </div>
              </div>

              <div className="sidebar-card">
                <div className="sidebar-title">Workload Mix</div>
                <div className="d-flex flex-column gap-3">
                  {workloadBuckets.map((bucket) => {
                    const total = advisors.length || 1
                    return <div key={bucket.label}><div className="d-flex justify-content-between small fw-semibold mb-1"><span>{bucket.label}</span><span>{bucket.count}</span></div><div className="advisors-progress-track"><div className="advisors-progress-fill" style={{ width: `${Math.round((bucket.count / total) * 100)}%`, background: bucket.accent }} /></div></div>
                  })}
                </div>
              </div>

              <div className="sidebar-card">
                <div className="sidebar-title">Top Loaded Advisors</div>
                {!topLoadedAdvisors.length ? <p className="text-muted small text-center mb-0">No active assignments</p> : <div className="d-flex flex-column gap-3">{topLoadedAdvisors.map((advisor) => <div key={advisor.advisorId} className="advisor-sidebar-row"><div className="advisor-sidebar-avatar">{advisor.fullName?.charAt(0)?.toUpperCase() || 'A'}</div><div className="flex-grow-1 min-w-0"><div className="advisor-sidebar-name">{advisor.fullName}</div><div className="advisor-sidebar-meta">{advisor.specialization || 'General'}</div></div><div className="advisor-sidebar-count">{advisor.currentLoad || 0}/{MAX_LOAD}</div></div>)}</div>}
              </div>

              <div className="sidebar-card">
                <div className="sidebar-title">Specializations</div>
                {!specializationBreakdown.length ? <p className="text-muted small text-center mb-0">No specialization data</p> : <div className="d-flex flex-column gap-3">{specializationBreakdown.map(([label, count]) => { const total = advisors.length || 1; return <div key={label}><div className="d-flex justify-content-between small fw-semibold mb-1"><span>{label}</span><span>{count}</span></div><div className="advisors-progress-track"><div className="advisors-progress-fill" style={{ width: `${Math.round((count / total) * 100)}%`, background: '#f97316' }} /></div></div> })}</div>}
              </div>
            </aside>
          </div>

          {editingAdvisor ? <AdvisorModal title={`Edit ${editingAdvisor.fullName}`} subtitle="Update specialization and overtime rate. Use the separate status action to change advisor availability." onClose={() => guardNavigation(() => setEditingAdvisor(null))}><form onSubmit={saveAdvisor}><div className="modal-body"><div className="row g-3"><div className="col-12"><label className="modal-form-label">Specialization</label><input className={`form-control modal-form-control ${errors.specialization ? 'is-invalid' : ''}`} value={form.specialization} onChange={(event) => { setForm((previous) => ({ ...previous, specialization: event.target.value })); setErrors((previous) => ({ ...previous, specialization: undefined })) }} />{errors.specialization ? <div className="invalid-feedback d-block">{errors.specialization}</div> : null}</div><div className="col-md-6"><label className="modal-form-label">Overtime Rate (INR / hour)</label><input type="number" min={0} className={`form-control modal-form-control ${errors.overtimeRate ? 'is-invalid' : ''}`} value={form.overtimeRate} onChange={(event) => { setForm((previous) => ({ ...previous, overtimeRate: event.target.value })); setErrors((previous) => ({ ...previous, overtimeRate: undefined })) }} />{errors.overtimeRate ? <div className="invalid-feedback d-block">{errors.overtimeRate}</div> : null}</div><div className="col-md-6"><label className="modal-form-label">Current Availability</label><input className="form-control modal-form-control" value={STATUS_LABELS[editingAdvisor.availabilityStatus] || editingAdvisor.availabilityStatus || 'AVAILABLE'} disabled /></div></div></div><div className="modal-footer"><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => guardNavigation(() => setEditingAdvisor(null))}>Cancel</button><button type="submit" className="advisors-save-btn" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button></div></form></AdvisorModal> : null}

          {statusAdvisor ? <AdvisorModal title="Update Advisor Status" subtitle={statusAdvisor.fullName} onClose={() => guardNavigation(() => setStatusAdvisor(null))}><form onSubmit={saveAdvisorStatus}><div className="modal-body"><div className="d-grid gap-2">{ADVISOR_STATUSES.map((status) => <button key={status} type="button" className={`btn btn-sm ${form.availabilityStatus === status ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => { setForm((previous) => ({ ...previous, availabilityStatus: status })); setErrors((previous) => ({ ...previous, availabilityStatus: undefined })) }}>{STATUS_LABELS[status] || status}</button>)}</div>{warningForStatusChange(statusAdvisor, form.availabilityStatus) ? <div className={`alert mt-3 mb-0 small ${warningForStatusChange(statusAdvisor, form.availabilityStatus).type === 'error' ? 'alert-danger' : 'alert-warning'}`}>{warningForStatusChange(statusAdvisor, form.availabilityStatus).message}</div> : null}{errors.availabilityStatus ? <div className="text-danger small mt-2">{errors.availabilityStatus}</div> : null}<div className="small text-muted mt-3">Use user management for account activation. This dialog changes advisor availability only.</div></div><div className="modal-footer"><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => guardNavigation(() => setStatusAdvisor(null))}>Cancel</button><button type="submit" className="advisors-save-btn" disabled={saving || warningForStatusChange(statusAdvisor, form.availabilityStatus)?.type === 'error'}>{saving ? 'Saving...' : 'Save Status'}</button></div></form></AdvisorModal> : null}

          {assigningBooking ? <AdvisorModal title="Assign Booking" subtitle={`${bookingLabel(assigningBooking)} | ${assigningBooking.vehicleInfo || 'Vehicle info unavailable'}`} onClose={() => guardNavigation(() => { setAssigningBooking(null); setPreferredAdvisorId(''); setSelectedAdvisorId('') })}><div className="modal-body"><div className="advisor-assignment-summary"><div><div className="advisor-metric-label">Service</div><div className="advisor-metric-value">{assigningBooking.serviceName || 'Service'}</div></div><div><div className="advisor-metric-label">Date & Slot</div><div className="advisor-metric-value">{formatDate(assigningBooking.serviceDate)} | {assigningBooking.timeSlot || 'No slot selected'}</div></div><div><div className="advisor-metric-label">Customer</div><div className="advisor-metric-value">{assigningBooking.ownerName || 'Unknown customer'}</div></div></div><label className="modal-form-label">Select Advisor</label><select className={`form-select modal-form-control ${errors.advisorId ? 'is-invalid' : ''}`} value={selectedAdvisorId} onChange={(event) => { setSelectedAdvisorId(event.target.value); setErrors((previous) => ({ ...previous, advisorId: undefined })) }}><option value="">{assignOptions.length ? 'Choose an advisor' : 'No eligible advisors available'}</option>{assignOptions.map((advisor) => <option key={advisor.advisorId} value={advisor.advisorId}>{advisor.fullName} - {advisor.specialization || 'General'} ({advisor.availabilityStatus}, load {advisor.currentLoad || 0}/{MAX_LOAD})</option>)}</select>{errors.advisorId ? <div className="invalid-feedback d-block">{errors.advisorId}</div> : null}{preferredAdvisorId ? <div className="advisor-preferred-hint">Preselected from advisor card. You can still choose another eligible advisor if needed.</div> : null}</div><div className="modal-footer"><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => guardNavigation(() => { setAssigningBooking(null); setPreferredAdvisorId(''); setSelectedAdvisorId('') })}>Cancel</button><button type="button" className="advisors-save-btn" disabled={saving || !assignOptions.length} onClick={assignBooking}>{saving ? 'Assigning...' : 'Confirm Assignment'}</button></div></AdvisorModal> : null}
        </PageContent>
      </div>
    </AdminLayout>
  )
}

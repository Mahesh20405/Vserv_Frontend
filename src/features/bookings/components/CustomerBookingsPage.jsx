import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CustomerLayout } from '../../../layouts/AppShell'
import { CustomerPageHero, PageContent } from '../../../components/common/PageElements'
import { PageSpinner } from '../../../components/ui/Spinner'
import { StatusBadge } from '../../../components/ui/Badge'
import { PillStat } from '../../../components/ui/PillStat'
import { PillStatRow } from '../../../components/ui/PillStatRow'
import { useToast } from '../../../components/ui/Toast'
import { formatCurrency, formatDate, formatDateTime, SERVICE_ICONS } from '../../../utils/formatters'
import { PaginationControls } from '../../../components/ui/PaginationControls'
import { ActionIconButton } from '../../../components/ui/ActionIconButton'
import { useNavigationGuard } from '../../../hooks/useNavigationGuard'
import { readPaginatedData } from '../../../services/pagination'
import { availabilityService } from '../../availability/services/availabilityService'
import { bookingService } from '../services/bookingService'

const TRACKER_STEPS = ['Booked', 'Assigned', 'In Service', 'Completed']
const PAGE_SIZE = 8
const UPCOMING_STATUSES = ['PENDING', 'CONFIRMED', 'RESCHEDULED', 'PENDING_PAYMENT']
const SLOT_PATTERN = /^\d{2}:\d{2}-\d{2}:\d{2}$/
const BOOKING_STATUS_PRIORITY = {
  PENDING: 0,
  CONFIRMED: 1,
  RESCHEDULED: 2,
  PENDING_PAYMENT: 3,
  IN_PROGRESS: 4,
  COMPLETED: 5,
  CANCELLED: 6,
}

function bookingPaymentStatus(booking) {
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

function renderPaymentStatus(booking) {
  const status = bookingPaymentStatus(booking)
  return status ? <StatusBadge status={status} /> : 'N/A'
}

function bookingNumber(booking) {
  return booking.bookingNumber || `BK-${String(booking.bookingId).padStart(4, '0')}`
}

function bookingIcon(booking) {
  return SERVICE_ICONS[booking.serviceType] || SERVICE_ICONS.default || 'SRV'
}

function bookingSortValue(booking = {}) {
  return new Date(booking.serviceDate || booking.createdAt || 0).getTime() || 0
}

function hasAssignedAdvisor(booking) {
  return Boolean(booking?.advisorId || booking?.advisorName)
}

export function CustomerBookingsPage() {
  const toast = useToast()
  const [allBookings, setAllBookings] = useState([])
  const [totalBookings, setTotalBookings] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState('priority')
  const [selected, setSelected] = useState(null)
  const [showViewModal, setShowViewModal] = useState(false)
  const [history, setHistory] = useState([])
  const [showReschedule, setShowReschedule] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [rescheduleForm, setRescheduleForm] = useState({ newDate: '', newSlot: '', reason: '' })
  const [cancelReason, setCancelReason] = useState('')
  const [slots, setSlots] = useState([])
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [page, setPage] = useState(1)
  const guardNavigation = useNavigationGuard(
    Boolean(showReschedule || showCancel || saving),
    'A booking update is still in progress. Leaving now may discard the current changes. Continue?'
  )

  const load = async () => {
    setLoading(true)
    try {
      const response = await bookingService.list({
        page,
        size: PAGE_SIZE,
        status: statusFilter === 'completed' ? 'COMPLETED' : statusFilter === 'cancelled' ? 'CANCELLED' : undefined,
        q: search.trim() || undefined,
        sort: sortBy === 'oldest' ? 'oldest' : 'newest',
      })
      const pageData = readPaginatedData(response.data, { page, size: PAGE_SIZE })
      setAllBookings(pageData.content || [])
      setTotalBookings(pageData.totalElements)
      setTotalPages(pageData.totalPages)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [page, search, sortBy, statusFilter])

  async function selectBooking(booking) {
    try {
      const [bookingResponse, historyResponse] = await Promise.all([
        bookingService.getById(booking.bookingId),
        bookingService.getHistory(booking.bookingId),
      ])
      setSelected(bookingResponse.data || booking)
      setHistory(historyResponse.data || [])
      setShowViewModal(true)
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to load booking details.', 'error')
    }
  }

  async function loadSlots(date) {
    if (!date) {
      setSlots([])
      return
    }
    const response = await availabilityService.bookable({ from: date, to: date })
    setSlots(response.data || [])
  }

  function openRescheduleModal(booking) {
    setSelected(booking)
    setErrors({})
    setSlots([])
    setRescheduleForm({ newDate: '', newSlot: '', reason: '' })
    setShowReschedule(true)
  }

  function openCancelModal(booking) {
    setSelected(booking)
    setErrors({})
    setCancelReason('')
    setShowCancel(true)
  }

  async function doCancel() {
    const reason = cancelReason.trim()
    if (!reason) {
      setErrors({ cancelReason: 'Reason for cancellation is required.' })
      return
    }

    setSaving(true)
    try {
      await bookingService.cancel(selected.bookingId, { reason })
      toast('Booking cancelled.')
      setShowCancel(false)
      setSelected(null)
      setCancelReason('')
      setErrors({})
      await load()
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to cancel booking.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function doReschedule() {
    const nextErrors = {}
    const today = new Date().toISOString().split('T')[0]

    if (!rescheduleForm.newDate) nextErrors.newDate = 'Please select a date.'
    else if (rescheduleForm.newDate < today) nextErrors.newDate = 'Cannot reschedule to a past date.'
    if (!rescheduleForm.newSlot) nextErrors.newSlot = 'Please select a time slot.'
    else if (!SLOT_PATTERN.test(rescheduleForm.newSlot)) nextErrors.newSlot = 'Invalid time slot format.'
    if (!rescheduleForm.reason.trim()) nextErrors.reason = 'Please provide a reason.'

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }

    setSaving(true)
    try {
      await bookingService.reschedule(selected.bookingId, {
        newDate: rescheduleForm.newDate,
        newSlot: rescheduleForm.newSlot,
        reason: rescheduleForm.reason.trim(),
      })
      toast(selected?.advisorId
        ? 'Booking rescheduled. Advisor confirmation will follow for the new slot.'
        : 'Booking rescheduled successfully.')
      setShowReschedule(false)
      setErrors({})
      await load()
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to reschedule booking.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const bookings = useMemo(() => allBookings
    .filter((booking) => (statusFilter === 'upcoming' ? UPCOMING_STATUSES.includes(booking.bookingStatus) : true))
    .slice()
    .sort((left, right) => {
      const leftTime = bookingSortValue(left)
      const rightTime = bookingSortValue(right)
      if (sortBy === 'priority') {
        const leftPriority = BOOKING_STATUS_PRIORITY[left.bookingStatus] ?? 99
        const rightPriority = BOOKING_STATUS_PRIORITY[right.bookingStatus] ?? 99
        return leftPriority - rightPriority || rightTime - leftTime || Number(right.bookingId || 0) - Number(left.bookingId || 0)
      }
      return sortBy === 'oldest' ? leftTime - rightTime : rightTime - leftTime
    }), [allBookings, sortBy, statusFilter])

  const pagedBookings = bookings

  const counts = {
    all: allBookings.length,
    upcoming: allBookings.filter((booking) => UPCOMING_STATUSES.includes(booking.bookingStatus)).length,
    completed: allBookings.filter((booking) => booking.bookingStatus === 'COMPLETED').length,
    cancelled: allBookings.filter((booking) => booking.bookingStatus === 'CANCELLED').length,
  }

  const upcomingBookings = useMemo(() => allBookings
    .filter((booking) => UPCOMING_STATUSES.includes(booking.bookingStatus))
    .slice()
    .sort((left, right) => new Date(left.serviceDate || 0).getTime() - new Date(right.serviceDate || 0).getTime())
    .slice(0, 4), [allBookings])

  const trackerStep = (status) => {
    if (status === 'COMPLETED') return [1, 1, 1, 1]
    if (status === 'IN_PROGRESS') return [1, 1, 1, 0]
    if (status === 'CONFIRMED') return [1, 1, 0, 0]
    if (status === 'RESCHEDULED') return [1, 0, 0, 0]
    return [1, 0, 0, 0]
  }

  const canEdit = (status) => ['PENDING', 'CONFIRMED', 'RESCHEDULED'].includes(status)
  const canCancel = (booking) => canEdit(booking?.bookingStatus) && !hasAssignedAdvisor(booking)

  useEffect(() => {
    setPage(1)
  }, [search, sortBy, statusFilter])

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages))
  }, [totalPages])

  return (
    <CustomerLayout activeKey="bookings">
      <div className="customer-bookings-page">
        <CustomerPageHero
          title="My Bookings"
          subtitle="Track, reschedule, and manage your service appointments."
          actions={<Link to="/customer/book-service" className="customer-hero-btn">Book Service</Link>}
        />
        <PageContent>
          <PillStatRow>
            {[
              { icon: 'ALL', label: 'All', value: counts.all, bg: '#dbeafe' },
              { icon: 'UP', label: 'Upcoming', value: counts.upcoming, bg: '#dcfce7' },
              { icon: 'OK', label: 'Completed', value: counts.completed, bg: '#fef3c7' },
              { icon: 'CN', label: 'Cancelled', value: counts.cancelled, bg: '#fee2e2' },
            ].map((item) => (
              <PillStat key={item.label} label={item.label} value={item.value} color={item.bg} />
            ))}
          </PillStatRow>

          <div className="toolbar-card customer-toolbar mb-3">
            <div className="row g-2 align-items-end">
              <div className="col-md-5">
                <label className="toolbar-label">Search</label>
                <input className="form-control form-control-sm" placeholder="Service, vehicle, booking..." value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="toolbar-label">Status</label>
                <div className="d-flex gap-2 flex-wrap">
                  {[
                    { k: '', l: 'All', n: counts.all },
                    { k: 'upcoming', l: 'Upcoming', n: counts.upcoming },
                    { k: 'completed', l: 'Completed', n: counts.completed },
                    { k: 'cancelled', l: 'Cancelled', n: counts.cancelled },
                  ].map((item) => (
                    <button key={item.k} className={`btn btn-sm ${statusFilter === item.k ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setStatusFilter(item.k)}>
                      {item.l} <span className="badge bg-light text-dark ms-1">{item.n}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="col-md-2">
                <label className="toolbar-label">Sort</label>
                <select className="form-select form-select-sm" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                  <option value="priority">Status Priority</option>
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                </select>
              </div>
              <div className="col-md-2">
                <button type="button" className="btn btn-sm btn-outline-secondary w-100" onClick={() => { setSearch(''); setStatusFilter(''); setSortBy('priority') }}>
                  Reset
                </button>
              </div>
            </div>
          </div>

          <div className="row g-3">
            <div className="col-xl-8 col-lg-7">
              <div className="customer-results-bar mb-3">
                <small>{totalBookings ? `Showing ${(page - 1) * PAGE_SIZE + 1}-${Math.min(page * PAGE_SIZE, totalBookings)} of ${totalBookings} bookings` : '0 bookings'}</small>
                <div className="d-flex gap-1 flex-wrap">
                  {statusFilter ? <span className="customer-filter-pill">{statusFilter}</span> : null}
                  {search.trim() ? <span className="customer-filter-pill">{search.trim()}</span> : null}
                </div>
              </div>

              {loading ? <PageSpinner /> : pagedBookings.length ? (
                <div className="customer-booking-list">
                  {pagedBookings.map((booking) => (
                    <article
                      key={booking.bookingId}
                      className={`customer-legacy-card customer-booking-card ${selected?.bookingId === booking.bookingId && showViewModal ? 'is-active' : ''}`}
                      onClick={() => selectBooking(booking)}
                    >
                      <div className={`customer-legacy-accent booking-${String(booking.bookingStatus || 'PENDING').toLowerCase()}`} />
                      <div className="customer-booking-card-body">
                        <div className="customer-booking-icon">{bookingIcon(booking)}</div>
                        <div className="customer-booking-main">
                          <div className="customer-booking-title">{booking.serviceName || 'Service'}</div>
                          <div className="customer-booking-sub">{booking.vehicleInfo || 'Vehicle not available'}</div>
                          <div className="customer-booking-subtle">{bookingNumber(booking)}</div>
                        </div>
                        <div className="customer-booking-date">
                          <div className="customer-booking-date-value">{formatDate(booking.serviceDate)}</div>
                          <div className="customer-booking-subtle">{booking.timeSlot || 'No slot assigned'}</div>
                        </div>
                        <div className="customer-booking-advisor">
                          <div className="customer-booking-advisor-name">{booking.advisorName || 'Not assigned'}</div>
                          <div className="customer-booking-subtle">Service Advisor</div>
                        </div>
                        <div className="customer-booking-status">
                          <StatusBadge status={booking.bookingStatus} />
                        </div>
                        <div className="customer-card-actions" onClick={(event) => event.stopPropagation()}>
                          <ActionIconButton icon="view" label="View booking" onClick={() => selectBooking(booking)} />
                          <ActionIconButton icon="reschedule" label="Reschedule booking" className="action-warning" disabled={!canEdit(booking.bookingStatus)} onClick={() => openRescheduleModal(booking)} />
                          <ActionIconButton icon="cancel" label="Cancel booking" className="action-danger" disabled={!canCancel(booking)} onClick={() => openCancelModal(booking)} />
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : <div className="empty-state"><div className="empty-state-icon">Bookings</div><p>No bookings found</p></div>}
              <PaginationControls page={page} totalItems={totalBookings} pageSize={PAGE_SIZE} totalPages={totalPages} onPageChange={setPage} />
            </div>

            <div className="col-xl-4 col-lg-5">
              <div className="detail-panel">
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>Upcoming Appointments</div>
                <div className="text-muted" style={{ fontSize: '0.76rem', marginTop: 4 }}>Your next active service bookings at a glance.</div>
                <div className="mt-3 d-flex flex-column gap-2">
                  {upcomingBookings.length ? upcomingBookings.map((booking) => (
                    <button
                      key={booking.bookingId}
                      type="button"
                      className="btn btn-light text-start"
                      style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 14px' }}
                      onClick={() => selectBooking(booking)}
                    >
                      <div style={{ fontWeight: 700, fontSize: 'var(--fs-label)' }}>{booking.serviceName}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--neutral-medium)' }}>{booking.vehicleInfo}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--neutral-medium)', marginTop: 4 }}>{formatDate(booking.serviceDate)} - {booking.timeSlot}</div>
                    </button>
                  )) : <div className="empty-state"><div className="empty-state-icon">Soon</div><p>No upcoming bookings</p></div>}
                </div>
              </div>
            </div>
          </div>

          {showViewModal && selected ? (
            <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.4)' }}>
              <div className="modal-dialog modal-dialog-centered modal-lg">
                <div className="modal-content">
                  <div className="modal-header text-white" style={{ background: 'var(--primary-dark-gradient)' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem' }}>{bookingNumber(selected)}</div>
                      <StatusBadge status={selected.bookingStatus} />
                    </div>
                  </div>
                  <div className="modal-body">
                    <div className="tracker mb-3">
                      {TRACKER_STEPS.map((stepLabel, index) => {
                        const done = trackerStep(selected.bookingStatus)
                        const isDone = done[index] === 1
                        const isActive = !isDone && (index === 0 || done[index - 1] === 1)
                        return (
                          <div key={stepLabel} className={`tracker-step ${isDone ? 'done' : isActive ? 'active' : ''}`}>
                            <div className="tracker-dot">{isDone ? 'OK' : index + 1}</div>
                            <div className="tracker-label">{stepLabel}</div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="row g-2 mb-3">
                      {[
                        ['Service', selected.serviceName || '-'],
                        ['Vehicle', selected.vehicleInfo || '-'],
                        ['Booking #', bookingNumber(selected)],
                        ['Booking Status', <StatusBadge key="booking-status" status={selected.bookingStatus} />],
                        ['Booking Charge', selected.bookingChargeAmount != null ? formatCurrency(selected.bookingChargeAmount) : '-'],
                        ['Date', formatDate(selected.serviceDate)],
                        ['Slot', selected.timeSlot || '-'],
                        ['Advisor', selected.advisorName || 'Not assigned'],
                        ['Payment Method', selected.bookingChargePaymentMethod || '-'],
                        ['Payment Ref', selected.bookingChargeTransactionReference || '-'],
                        ['Paid At', formatDateTime(selected.bookingChargePaidAt)],
                        ['Created', formatDateTime(selected.createdAt)],
                        ['Notes', selected.bookingNotes || '-'],
                      ].map(([label, value]) => (
                        <div key={label} className="col-sm-6">
                          <div className="detail-label">{label}</div>
                          <div className="detail-value">{value}</div>
                        </div>
                      ))}
                    </div>

                    {history.length > 0 ? (
                      <div>
                        <div className="detail-label mb-2">History</div>
                        {history.map((item) => (
                          <div key={item.historyId} className="d-flex gap-2 mb-2">
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary-accent)', marginTop: 5, flexShrink: 0 }} />
                            <div style={{ fontSize: 'var(--fs-fine)' }}>
                              <span style={{ fontWeight: 600 }}>{item.actionType}</span>
                              {item.reason ? <span className="text-muted ms-1">- {item.reason}</span> : null}
                              {(item.oldServiceDate || item.newServiceDate || item.oldTimeSlot || item.newTimeSlot) ? (
                                <div className="text-muted">
                                  {(item.oldServiceDate || item.oldTimeSlot) ? `${formatDate(item.oldServiceDate)} ${item.oldTimeSlot || ''}`.trim() : '-'}
                                  {' -> '}
                                  {(item.newServiceDate || item.newTimeSlot) ? `${formatDate(item.newServiceDate)} ${item.newTimeSlot || ''}`.trim() : '-'}
                                </div>
                              ) : null}
                              <div className="text-muted">{formatDateTime(item.actionDate)}{item.actionByName ? ` - ${item.actionByName}` : ''}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="modal-footer">
                    <button className="btn btn-sm btn-outline-warning" disabled={!canEdit(selected.bookingStatus)} onClick={() => { setShowViewModal(false); openRescheduleModal(selected) }}>Reschedule</button>
                    <button className="btn btn-sm btn-outline-danger" disabled={!canCancel(selected)} onClick={() => { setShowViewModal(false); openCancelModal(selected) }}>Cancel</button>
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setShowViewModal(false)}>Close</button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {showReschedule ? (
            <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.4)' }}>
              <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                  <div className="modal-header text-white" style={{ background: 'var(--primary-dark-gradient)' }}>
                    <h5 className="modal-title fw-semibold">Reschedule Booking</h5>
                  </div>
                  <div className="modal-body">
                    <div className="mb-2 text-muted small">
                      {selected ? `${selected.serviceName || 'Service'} - currently on ${formatDate(selected.serviceDate)} at ${selected.timeSlot || '-'}` : null}
                    </div>
                    <div className="mb-3">
                      <label className="form-label label-sm">New Date</label>
                      <input
                        type="date"
                        className={`form-control form-control-sm ${errors.newDate ? 'is-invalid' : ''}`}
                        value={rescheduleForm.newDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={async (event) => {
                          const nextDate = event.target.value
                          setRescheduleForm((current) => ({ ...current, newDate: nextDate, newSlot: '' }))
                          await loadSlots(nextDate)
                        }}
                      />
                      {errors.newDate ? <div className="invalid-feedback">{errors.newDate}</div> : null}
                    </div>
                    <div className="mb-3">
                      <label className="form-label label-sm">Time Slot</label>
                      {rescheduleForm.newDate ? (
                        <div className="d-flex flex-wrap gap-2">
                          {slots.length ? slots.map((slot) => (
                            <button key={slot.availabilityId} type="button" className={`btn btn-sm ${rescheduleForm.newSlot === slot.timeSlot ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setRescheduleForm((current) => ({ ...current, newSlot: slot.timeSlot }))}>
                              {slot.timeSlot}
                            </button>
                          )) : <div className="text-muted small">No slots available for this date.</div>}
                        </div>
                      ) : <div className="text-muted small">Select a date first to load available slots.</div>}
                      {errors.newSlot ? <div className="text-danger small mt-2">{errors.newSlot}</div> : null}
                    </div>
                    <div>
                      <label className="form-label label-sm">Reason</label>
                      <input className={`form-control form-control-sm ${errors.reason ? 'is-invalid' : ''}`} value={rescheduleForm.reason} onChange={(event) => setRescheduleForm((current) => ({ ...current, reason: event.target.value }))} />
                      {errors.reason ? <div className="invalid-feedback">{errors.reason}</div> : null}
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setShowReschedule(false)}>Cancel</button>
                    <button className="btn btn-sm btn-warning" disabled={saving} onClick={doReschedule}>{saving ? 'Saving...' : 'Reschedule'}</button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {showCancel ? (
            <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.4)' }}>
              <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                  <div className="modal-header text-white" style={{ background: 'var(--primary-dark-gradient)' }}>
                    <h5 className="modal-title fw-semibold">Cancel {selected ? bookingNumber(selected) : 'booking'}</h5>
                  </div>
                  <div className="modal-body">
                    <div className="text-muted small mb-2">
                      {selected ? `Cancel "${selected.serviceName || 'Service'}" on ${formatDate(selected.serviceDate)} at ${selected.timeSlot || '-'}?` : null}
                    </div>
                    <label className="form-label label-sm">Reason for cancellation</label>
                    <textarea className={`form-control form-control-sm ${errors.cancelReason ? 'is-invalid' : ''}`} rows={3} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
                    {errors.cancelReason ? <div className="invalid-feedback">{errors.cancelReason}</div> : null}
                  </div>
                  <div className="modal-footer">
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setShowCancel(false)}>Back</button>
                    <button className="btn btn-sm btn-danger" disabled={saving} onClick={doCancel}>{saving ? 'Cancelling...' : 'Cancel Booking'}</button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </PageContent>
      </div>
    </CustomerLayout>
  )
}



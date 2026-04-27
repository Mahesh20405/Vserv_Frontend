import { useEffect, useMemo, useState } from 'react'
import { AdminLayout } from '../../../layouts/AppShell'
import { EmptyState } from '../../../components/ui/EmptyState'
import { PageSpinner } from '../../../components/ui/Spinner'
import { StatusBadge } from '../../../components/ui/Badge'
import { useToast } from '../../../components/ui/Toast'
import { formatDate } from '../../../utils/formatters'
import { validateBookingAdminAction } from '../../../utils/adminValidation'
import { availabilityService } from '../../availability/services/availabilityService'
import { bookingService } from '../services/bookingService'
import '../../../styles/features/bookings/BookingsAdminPage.css'

const RESCHEDULE_REASONS = [
  { value: 'ADVISOR_UNAVAILABLE', label: 'Advisor Unavailable' },
  { value: 'CUSTOMER_NO_SHOW', label: 'Customer No-Show' },
  { value: 'CUSTOMER_REQUEST', label: 'Customer Request' },
  { value: 'VEHICLE_NOT_READY', label: 'Vehicle Not Ready' },
  { value: 'ADMIN_OVERRIDE', label: 'Admin Override' },
]

const parseDateOnly = (value) => {
  if (!value) return null
  const [year, month, day] = String(value).split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

const bookingNumber = (booking) => {
  if (!booking?.bookingId) return 'Booking'
  const year = parseDateOnly(booking.createdAt?.slice?.(0, 10))?.getFullYear()
    || parseDateOnly(booking.serviceDate)?.getFullYear()
    || new Date().getFullYear()
  return `BK-${year}-${String(booking.bookingId).padStart(4, '0')}`
}

const overdueDays = (serviceDate) => {
  const target = parseDateOnly(serviceDate)
  if (!target) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24)))
}

export function OverdueBookingsPage() {
  const toast = useToast()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reschedulingBooking, setReschedulingBooking] = useState(null)
  const [rescheduleForm, setRescheduleForm] = useState({ newDate: '', newSlot: '', reason: '' })
  const [slots, setSlots] = useState([])
  const [errors, setErrors] = useState({})

  async function loadBookings() {
    setLoading(true)
    try {
      const response = await bookingService.getOverdueBookings()
      setBookings(response.data || [])
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to load overdue bookings.', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function loadSlots(date) {
    if (!date) {
      setSlots([])
      return
    }
    try {
      const response = await availabilityService.bookable({ from: date, to: date })
      setSlots(response.data || [])
    } catch {
      setSlots([])
    }
  }

  useEffect(() => { loadBookings() }, [])

  function openRescheduleModal(booking) {
    setReschedulingBooking(booking)
    setRescheduleForm({ newDate: '', newSlot: '', reason: '' })
    setSlots([])
    setErrors({})
  }

  async function handleReschedule() {
    const { errors: nextErrors, isValid } = validateBookingAdminAction('reschedule', rescheduleForm)
    if (!isValid) {
      setErrors(nextErrors)
      return
    }

    setSaving(true)
    try {
      await bookingService.reschedule(reschedulingBooking.bookingId, {
        newDate: rescheduleForm.newDate,
        newSlot: rescheduleForm.newSlot,
        reason: rescheduleForm.reason,
      })
      setBookings((current) => current.filter((booking) => booking.bookingId !== reschedulingBooking.bookingId))
      setReschedulingBooking(null)
      toast('Booking rescheduled successfully.')
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to reschedule overdue booking.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const summary = useMemo(() => {
    const total = bookings.length
    const oldest = bookings.reduce((max, booking) => Math.max(max, overdueDays(booking.serviceDate)), 0)
    return { total, oldest }
  }, [bookings])

  return (
    <AdminLayout activeKey="overdue-bookings">
      <div className="bookings-page">
        <section className="page-header bookings-hero">
          <div className="container-fluid px-4">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
              <div>
                <h2 className="text-white mb-0">Requires Action</h2>
                <p className="mb-0 page-subtitle">Confirmed bookings whose service date has passed without the service being started.</p>
              </div>
              <div className="d-flex gap-2 flex-wrap">
                <span className="filter-pill" style={{ background: '#fff7ed', color: '#9a3412' }}>{summary.total} overdue</span>
                <span className="filter-pill" style={{ background: '#fef2f2', color: '#b91c1c' }}>Oldest: {summary.oldest} day{summary.oldest === 1 ? '' : 's'}</span>
              </div>
            </div>
          </div>
        </section>

        <div className="container-fluid px-4 py-3">
          <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
            These bookings require your attention. Review each one and reschedule or investigate as needed.
          </div>

          {loading ? (
            <div className="section-card">
              <PageSpinner />
            </div>
          ) : !bookings.length ? (
            <EmptyState
              className="bookings-empty-state"
              title="No overdue bookings"
              message="Everything is on track."
            />
          ) : (
            <div className="bookings-layout">
              <div>
                <div className="results-bar">
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <span className="legend-item"><span className="legend-dot legend-cancelled" />Requires action</span>
                    <span className="legend-item"><span className="legend-dot legend-rescheduled" />Reschedule pending</span>
                  </div>
                  <small className="text-muted">{bookings.length} overdue booking{bookings.length === 1 ? '' : 's'}</small>
                </div>

                <div className="bookings-list">
                  {bookings.map((booking) => {
                    const days = overdueDays(booking.serviceDate)
                    const customerName = booking.customerName || booking.vehicleOwnerName || booking.ownerName || 'Unknown customer'
                    const daysStyle = days > 1
                      ? { background: '#fee2e2', color: '#b91c1c' }
                      : { background: '#fef3c7', color: '#92400e' }

                    return (
                      <article key={booking.bookingId} className="booking-card">
                        <div className="booking-accent booking-accent-cancelled" />
                        <div className="booking-body">
                          <div className="booking-row-top">
                            <StatusBadge status={booking.bookingStatus} />
                            <span className="booking-number">{bookingNumber(booking)}</span>
                            <span className="booking-sep">•</span>
                            <span className="booking-service">{booking.serviceName || 'Service'}</span>
                            <span className="filter-pill ms-auto" style={daysStyle}>
                              {days} day{days === 1 ? '' : 's'} overdue
                            </span>
                          </div>

                          <div className="booking-row-bottom">
                            <div className="booking-vehicle">
                              <div className="booking-vehicle-main">{booking.vehicleInfo || 'Vehicle not available'}</div>
                              <div className="booking-vehicle-sub">Customer: {customerName}</div>
                            </div>

                            <div className="booking-date-block">
                              <div className="booking-date-label">Booked Date</div>
                              <div className="booking-date-value">{formatDate(booking.serviceDate)}</div>
                              <div className="booking-slot">{booking.timeSlot || '—'}</div>
                            </div>

                            <div className="booking-advisor">
                              <div className="booking-date-label">Assigned Advisor</div>
                              <div className="booking-advisor-value">{booking.advisorName || 'Unassigned'}</div>
                            </div>

                            <div className="booking-actions">
                              <button
                                type="button"
                                className="bookings-save-btn"
                                onClick={() => openRescheduleModal(booking)}
                              >
                                Reschedule
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>

              <aside className="bookings-sidebar">
                <div className="sidebar-card">
                  <div className="sidebar-title">Attention Needed</div>
                  <div className="d-flex flex-column gap-3">
                    <div>
                      <div className="d-flex justify-content-between small fw-semibold mb-1">
                        <span>Overdue Bookings</span>
                        <span>{summary.total}</span>
                      </div>
                      <div className="bookings-progress-track">
                        <div className="bookings-progress-fill bookings-progress-cancelled" style={{ width: summary.total ? '100%' : '0%' }} />
                      </div>
                    </div>
                    <div className="small text-muted">
                      Rescheduling keeps the booking history intact while clearing the current advisor assignment for reconfirmation.
                    </div>
                  </div>
                </div>

                <div className="sidebar-card">
                  <div className="sidebar-title">Reason Codes</div>
                  <div className="d-flex flex-column gap-2">
                    {RESCHEDULE_REASONS.map((reason) => (
                      <div key={reason.value} className="small d-flex justify-content-between gap-3">
                        <span>{reason.label}</span>
                        <span className="text-muted">{reason.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          )}

          {reschedulingBooking ? (
            <RescheduleModal
              booking={reschedulingBooking}
              form={rescheduleForm}
              slots={slots}
              errors={errors}
              saving={saving}
              onClose={() => setReschedulingBooking(null)}
              onDateChange={(value) => {
                setRescheduleForm((current) => ({ ...current, newDate: value, newSlot: '' }))
                loadSlots(value)
              }}
              onFieldChange={(key, value) => {
                setRescheduleForm((current) => ({ ...current, [key]: value }))
              }}
              onSave={handleReschedule}
            />
          ) : null}
        </div>
      </div>
    </AdminLayout>
  )
}

function RescheduleModal({ booking, form, slots, errors, saving, onClose, onDateChange, onFieldChange, onSave }) {
  return (
    <div className="modal fade show d-block bookings-modal-backdrop">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header bookings-modal-header">
            <h5 className="modal-title text-white">Reschedule Booking</h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose} />
          </div>
          <div className="modal-body">
            <p className="bookings-modal-desc">
              Rescheduling <strong>{bookingNumber(booking)}</strong>
            </p>
            <div className="alert alert-warning small py-2">
              This overdue booking will be moved to a new slot and require advisor reconfirmation.
            </div>

            <div className="mb-3">
              <label className="bookings-modal-label">New Service Date</label>
              <input
                type="date"
                className={`form-control ${errors.newDate ? 'is-invalid' : ''}`}
                value={form.newDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(event) => onDateChange(event.target.value)}
              />
              {errors.newDate ? <div className="invalid-feedback">{errors.newDate}</div> : null}
            </div>

            <div className="mb-3">
              <label className="bookings-modal-label">New Time Slot</label>
              <select
                className={`form-select ${errors.newSlot ? 'is-invalid' : ''}`}
                value={form.newSlot}
                onChange={(event) => onFieldChange('newSlot', event.target.value)}
              >
                <option value="">{slots.length ? 'Select time slot' : 'Select a date first'}</option>
                {slots.map((slot) => (
                  <option key={slot.availabilityId} value={slot.timeSlot}>{slot.timeSlot}</option>
                ))}
              </select>
              {errors.newSlot ? <div className="invalid-feedback">{errors.newSlot}</div> : null}
            </div>

            <div>
              <label className="bookings-modal-label">Reason</label>
              <select
                className={`form-select ${errors.reason ? 'is-invalid' : ''}`}
                value={form.reason}
                onChange={(event) => onFieldChange('reason', event.target.value)}
              >
                <option value="">Select reason</option>
                {RESCHEDULE_REASONS.map((reason) => (
                  <option key={reason.value} value={reason.value}>{reason.label}</option>
                ))}
              </select>
              {errors.reason ? <div className="invalid-feedback">{errors.reason}</div> : null}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="button" className="bookings-save-btn" disabled={saving} onClick={onSave}>
              {saving ? 'Saving...' : 'Reschedule'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

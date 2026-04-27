import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CustomerLayout } from '../../../layouts/AppShell'
import { PageHero, PageContent } from '../../../components/common/PageElements'
import { PageSpinner } from '../../../components/ui/Spinner'
import { BookingStepper } from '../../../components/ui/BookingStepper'
import { ServiceCard } from '../../../components/ui/ServiceCard'
import { VehicleCard } from '../../../components/ui/VehicleCard'
import { TimeSlotGrid } from '../../../components/ui/TimeSlotGrid'
import { useAuth } from '../../auth/hooks/useAuth'
import { useToast } from '../../../components/ui/Toast'
import { formatCurrency, formatDate } from '../../../utils/formatters'
import { validateCustomerBookServiceForm } from '../../../utils/adminValidation'
import { useNavigationGuard } from '../../../hooks/useNavigationGuard'
import '../../../styles/features/bookings/AdminBookServicePage.css'
import { availabilityService } from '../../availability/services/availabilityService'
import { bookingService } from '../services/bookingService'
import { catalogService } from '../../catalog/services/catalogService'
import { vehicleService } from '../../vehicles/services/vehicleService'

const STEPS = ['Vehicle', 'Service', 'Schedule', 'Confirm']
const BOOKING_PAYMENT_METHODS = ['UPI', 'CARD', 'NET_BANKING']
const DEFAULT_BOOKING_CHARGE = 299
const BOOKING_DRAFT_KEY = 'vserv_customer_booking_draft'

export function CustomerBookServicePage() {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState(params.get('vehicleId') ? 1 : 0)
  const [vehicles, setVehicles] = useState([])
  const [services, setServices] = useState([])
  const [slots, setSlots] = useState([])
  const [serviceQuery, setServiceQuery] = useState('')
  const [serviceType, setServiceType] = useState('')
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [selectedService, setSelectedService] = useState(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [notes, setNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('UPI')
  const [errors, setErrors] = useState({})
  const txRefFromPayment = params.get('txRef') || ''
  const guardNavigation = useNavigationGuard(
    Boolean(selectedVehicle || selectedService || selectedDate || selectedSlot || notes.trim() || submitting),
    'A booking is still in progress. Leaving now will discard the current booking flow. Continue?'
  )

  const tomorrow = useMemo(() => {
    const value = new Date()
    value.setDate(value.getDate() + 1)
    return value.toISOString().split('T')[0]
  }, [])

  useEffect(() => {
    if (!user?.userId) return
    async function load() {
      setLoading(true)
      try {
        const [vehicleResponse, catalogResponse] = await Promise.all([
          vehicleService.byUser(user.userId),
          catalogService.list({ activeOnly: true }),
        ])
        const nextVehicles = (vehicleResponse.data || []).slice().sort((left, right) => Number(right.vehicleId || 0) - Number(left.vehicleId || 0))
        setVehicles(nextVehicles)
        setServices((catalogResponse.data || [])
          .filter((service) => service.isActive !== false)
          .sort((left, right) => Number(right.catalogId || 0) - Number(left.catalogId || 0)))
        const preselectedVehicleId = Number(params.get('vehicleId') || 0)
        if (preselectedVehicleId) {
          const preselectedVehicle = nextVehicles.find((vehicle) => vehicle.vehicleId === preselectedVehicleId)
          if (preselectedVehicle) setSelectedVehicle(preselectedVehicle)
        }
      } catch (error) {
        toast(error.response?.data?.message || 'Failed to load booking data.', 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params, toast, user?.userId])

  useEffect(() => {
    const status = (params.get('paymentStatus') || '').toLowerCase()
    const method = params.get('paymentMethod') || ''
    if (status !== 'success') return

    const draft = JSON.parse(sessionStorage.getItem(BOOKING_DRAFT_KEY) || 'null')
    if (!draft) return

    async function finalizeBooking() {
      const finalPayload = {
        vehicleId: draft.vehicleId,
        catalogId: draft.catalogId,
        serviceDate: draft.serviceDate,
        timeSlot: draft.timeSlot,
        notes: draft.notes,
        paymentMethod: method || draft.paymentMethod,
        transactionRef: txRefFromPayment || draft.transactionRef,
      }
      const { errors: nextErrors, isValid } = validateCustomerBookServiceForm(finalPayload)
      if (!isValid) {
        toast(nextErrors.transactionRef || 'Payment confirmation is incomplete. Please try again.', 'error')
        navigate('/customer/book-service', { replace: true })
        return
      }

      sessionStorage.removeItem(BOOKING_DRAFT_KEY)

      setSubmitting(true)
      try {
        const response = await bookingService.create(finalPayload)
        toast(`Booking #${response.data.bookingId} created successfully.`)
        navigate('/customer/bookings', { replace: true })
      } catch (error) {
        toast(error.response?.data?.message || 'Failed to create booking.', 'error')
      } finally {
        setSubmitting(false)
      }
    }

    finalizeBooking()
  }, [navigate, params, toast, txRefFromPayment])

  const serviceTypes = useMemo(() => [...new Set(services.map((service) => service.serviceType).filter(Boolean))], [services])

  const filteredServices = useMemo(() => {
    return services
      .filter((service) => !selectedVehicle || service.carType === 'ALL' || service.carType === selectedVehicle.carType)
      .filter((service) => !serviceQuery.trim() || [service.serviceName, service.description].filter(Boolean).join(' ').toLowerCase().includes(serviceQuery.trim().toLowerCase()))
      .filter((service) => !serviceType || service.serviceType === serviceType)
      .sort((left, right) => Number(right.catalogId || 0) - Number(left.catalogId || 0))
  }, [services, selectedVehicle, serviceQuery, serviceType])

  const summaryRows = []
  if (selectedVehicle) summaryRows.push({ label: 'Vehicle', value: `${selectedVehicle.brand} ${selectedVehicle.model}`, sub: `${selectedVehicle.registrationNumber} - ${selectedVehicle.carType}` })
  if (selectedService) summaryRows.push({ label: 'Service', value: selectedService.serviceName, sub: `${selectedService.serviceType} - ${selectedService.carType}` })
  if (selectedDate || selectedSlot) summaryRows.push({ label: 'Schedule', value: selectedDate ? formatDate(selectedDate) : '-', sub: selectedSlot?.timeSlot || 'No slot selected' })
  if (selectedService) summaryRows.push({ label: 'Booking Charge', value: formatCurrency(selectedService.bookingCharge ?? DEFAULT_BOOKING_CHARGE), sub: paymentMethod })

  async function loadSlots(date) {
    const query = { from: date, to: date }
    if (selectedVehicle?.vehicleId) query.vehicleId = selectedVehicle.vehicleId
    const response = await availabilityService.bookable(query)
    setSlots(response.data || [])
  }

  function buildPayload() {
    return {
      vehicleId: selectedVehicle?.vehicleId,
      catalogId: selectedService?.catalogId,
      serviceDate: selectedDate,
      timeSlot: selectedSlot?.timeSlot,
      notes,
      paymentMethod,
      transactionRef: txRefFromPayment,
    }
  }

  function validateStep(targetStep = step + 1) {
    const payload = buildPayload()
    const { errors: nextErrors, isValid } = validateCustomerBookServiceForm(payload, { requireTransactionRef: false })
    if (targetStep <= 1 && selectedVehicle) return true
    if (targetStep <= 2 && selectedVehicle && selectedService) return true
    if (targetStep <= 2) {
      setErrors(nextErrors)
      return !nextErrors.vehicleId && !nextErrors.catalogId && !nextErrors.notes
    }
    if (targetStep <= 3) {
      setErrors(nextErrors)
      return !nextErrors.serviceDate && !nextErrors.timeSlot
    }
    setErrors(nextErrors)
    return isValid
  }

  async function confirmBooking() {
    const payload = buildPayload()
    const { errors: nextErrors, isValid } = validateCustomerBookServiceForm(payload, { requireTransactionRef: false })
    if (!isValid) {
      setErrors(nextErrors)
      return
    }

    setSubmitting(true)
    try {
      sessionStorage.setItem(BOOKING_DRAFT_KEY, JSON.stringify({
        vehicleId: selectedVehicle.vehicleId,
        catalogId: selectedService.catalogId,
        serviceDate: selectedDate,
        timeSlot: selectedSlot.timeSlot,
        notes: notes.trim() || null,
        paymentMethod,
        transactionRef: txRefFromPayment.trim(),
      }))

      const returnUrl = encodeURIComponent('/customer/book-service')
      navigate(`/customer/payment?amount=${selectedService.bookingCharge ?? DEFAULT_BOOKING_CHARGE}&returnUrl=${returnUrl}&paymentMethod=${encodeURIComponent(paymentMethod)}`)
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to initiate payment.', 'error')
      setSubmitting(false)
    }
  }

  if (loading || (submitting && (params.get('paymentStatus') || '').toLowerCase() === 'success')) {
    return <CustomerLayout activeKey="bookings"><PageSpinner /></CustomerLayout>
  }

  return (
    <CustomerLayout activeKey="bookings">
      <div className="book-service-page">
        <PageHero
          title="Book a Service"
          subtitle="Select your vehicle, choose a service, and pick your slot."
          variant="customer"
          className="book-service-hero"
          actions={<button type="button" className="book-service-back-link bg-transparent border-0" onClick={() => guardNavigation(() => navigate('/customer/bookings'))}>Back to My Bookings</button>}
        />

        <PageContent className="py-4">
          <div className="booking-layout">
            <div>
              <BookingStepper steps={STEPS} step={step} onStepChange={setStep} />

              <div className={`stage-panel ${step === 0 ? 'active' : ''}`}>
                <div className="stage-header">
                  <div className="stage-num">1</div>
                  <div>
                    <div className="stage-title">Select Vehicle</div>
                    <div className="stage-sub">Choose a registered vehicle to continue with your booking</div>
                  </div>
                </div>
                {!vehicles.length ? (
                  <div className="no-vehicle-alert">No vehicles registered yet. Add one from My Vehicles before booking a service.</div>
                ) : (
                  <div className="vehicle-grid">
                    {vehicles.map((vehicle) => <VehicleCard key={vehicle.vehicleId} vehicle={vehicle} selected={selectedVehicle?.vehicleId === vehicle.vehicleId} onClick={() => { setSelectedVehicle(vehicle); setSelectedService(null); setSelectedDate(''); setSelectedSlot(null); setErrors({}) }} />)}
                  </div>
                )}
                {errors.vehicleId ? <div className="text-danger small mt-2">{errors.vehicleId}</div> : null}
                <div className="stage-nav">
                  <span />
                  <button type="button" className="btn-next" disabled={!selectedVehicle} onClick={() => setStep(1)}>Next: Service</button>
                </div>
              </div>

              <div className={`stage-panel ${step === 1 ? 'active' : ''}`}>
                <div className="stage-header">
                  <div className="stage-num">2</div>
                  <div>
                    <div className="stage-title">Select Service</div>
                    <div className="stage-sub">Choose a compatible active service for the selected vehicle and mention any extra service needs here</div>
                  </div>
                </div>
                <div className="booking-note-banner">
                  For multiple services or additional work, choose the closest primary service here and mention the rest in Special Instructions below.
                </div>
                <div className="service-toolbar">
                  <div className="search-box service-search">
                    <input type="text" placeholder="Search services..." value={serviceQuery} onChange={(event) => setServiceQuery(event.target.value)} />
                  </div>
                  <select className="svc-filter-select" value={serviceType} onChange={(event) => setServiceType(event.target.value)}>
                    <option value="">All Types</option>
                    {serviceTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div className="service-list">
                  {filteredServices.map((service) => <ServiceCard key={service.catalogId} service={service} selected={selectedService?.catalogId === service.catalogId} onClick={() => { setSelectedService(service); setErrors({}) }} bookingChargeFallback={DEFAULT_BOOKING_CHARGE} />)}
                  {!filteredServices.length ? <div className="text-muted small">No active compatible services found.</div> : null}
                </div>
                <div className="form-group mt-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <label>Special Instructions</label>
                    <span className={`small ${notes.length > 300 ? 'text-danger fw-semibold' : 'text-muted'}`}>{notes.length} / 300</span>
                  </div>
                  <textarea
                    className={`form-input ${errors.notes ? 'is-invalid' : ''}`}
                    rows={4}
                    value={notes}
                    placeholder="Optional: mention additional services, symptoms, or customer requests."
                    onChange={(event) => { setNotes(event.target.value); setErrors((previous) => ({ ...previous, notes: undefined })) }}
                  />
                  {errors.notes ? <div className="invalid-feedback d-block">{errors.notes}</div> : null}
                </div>
                {errors.catalogId ? <div className="text-danger small mt-2">{errors.catalogId}</div> : null}
                <div className="stage-nav">
                  <button type="button" className="btn-prev" onClick={() => setStep(0)}>Back</button>
                  <button type="button" className="btn-next" disabled={!selectedService} onClick={() => setStep(2)}>Next: Schedule</button>
                </div>
              </div>

              <div className={`stage-panel ${step === 2 ? 'active' : ''}`}>
                <div className="stage-header">
                  <div className="stage-num">3</div>
                  <div>
                    <div className="stage-title">Select Date & Time Slot</div>
                    <div className="stage-sub">Bookings are created from tomorrow onward, based on active availability</div>
                  </div>
                </div>
                <div className="form-group mb-3">
                  <label>Service Date</label>
                  <input className={`form-input ${errors.serviceDate ? 'is-invalid' : ''}`} type="date" value={selectedDate} min={tomorrow} onChange={async (event) => {
                    const nextDate = event.target.value
                    setSelectedDate(nextDate)
                    setSelectedSlot(null)
                    setErrors((previous) => ({ ...previous, serviceDate: undefined, timeSlot: undefined }))
                    await loadSlots(nextDate)
                  }} />
                  {errors.serviceDate ? <div className="invalid-feedback d-block">{errors.serviceDate}</div> : null}
                </div>
                <div className="form-group mb-3">
                  <label>Available Time Slots</label>
                  {!selectedDate ? <div className="text-muted small">Select a date to load active slots.</div> : <TimeSlotGrid slots={slots} selectedSlot={selectedSlot} onSelect={(slot) => { setSelectedSlot(slot); setErrors((previous) => ({ ...previous, timeSlot: undefined })) }} />}
                  {errors.timeSlot ? <div className="text-danger small mt-2">{errors.timeSlot}</div> : null}
                </div>
                <div className="stage-nav">
                  <button type="button" className="btn-prev" onClick={() => setStep(1)}>Back</button>
                  <button type="button" className="btn-next" onClick={() => { if (validateStep(3)) setStep(3) }}>Next: Confirm</button>
                </div>
              </div>

              <div className={`stage-panel ${step === 3 ? 'active' : ''}`}>
                <div className="stage-header">
                  <div className="stage-num">4</div>
                  <div>
                    <div className="stage-title">Confirm Booking</div>
                    <div className="stage-sub">Review your details before paying the booking charge and creating the booking</div>
                  </div>
                </div>
                <div className="confirm-grid">
                  {[
                    ['Vehicle', selectedVehicle ? `${selectedVehicle.brand} ${selectedVehicle.model}` : '-', selectedVehicle?.registrationNumber],
                    ['Service', selectedService?.serviceName, `${selectedService?.serviceType || ''} - ${selectedService?.carType || ''}`],
                    ['Service Date', selectedDate ? formatDate(selectedDate) : '-', selectedSlot?.timeSlot || '-'],
                    ['Duration', selectedService?.durationHours ? `${selectedService.durationHours}h` : '-', 'Estimated'],
                    ['Estimated Invoice', selectedService ? formatCurrency(selectedService.basePrice) : '-', 'Final invoice is settled after service completion'],
                    ['Booking Charge', selectedService ? formatCurrency(selectedService.bookingCharge ?? DEFAULT_BOOKING_CHARGE) : '-', 'Collected now to lock the slot'],
                    ['Instructions', notes || '-', null],
                  ].map(([label, value, sub]) => (
                    <div key={label} className="confirm-card">
                      <div className="sum-label">{label}</div>
                      <div className={`sum-val ${label === 'Estimated Invoice' ? 'sum-val-accent' : ''}`}>{value || '-'}</div>
                      {sub ? <div className="sum-sub">{sub}</div> : null}
                    </div>
                  ))}
                </div>
                <div className="row g-3 mt-1">
                  <div className="col-md-6">
                    <label className="form-label label-sm">Booking Charge Payment Method <span className="required-mark">*</span></label>
                    <select className={`form-select form-select-sm ${errors.paymentMethod ? 'is-invalid' : ''}`} value={paymentMethod} onChange={(event) => { setPaymentMethod(event.target.value); setErrors((current) => ({ ...current, paymentMethod: undefined })) }}>
                      {BOOKING_PAYMENT_METHODS.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                    {errors.paymentMethod ? <div className="invalid-feedback d-block">{errors.paymentMethod}</div> : null}
                  </div>
                </div>
                <div className="alert alert-warning mt-3 mb-0 py-2 px-3" style={{ fontSize: '0.8rem' }}>
                  Booking charge once paid is non-refundable if you cancel the booking after payment. Cancellation after payment may be allowed only under certain conditions and can be handled by admin review.
                </div>
                <div className="stage-nav">
                  <button type="button" className="btn-prev" onClick={() => setStep(2)}>Back</button>
                  <button type="button" className="btn-next btn-confirm" disabled={submitting} onClick={confirmBooking}>{submitting ? 'Processing...' : `Pay ${formatCurrency(selectedService?.bookingCharge ?? DEFAULT_BOOKING_CHARGE)} and Book`}</button>
                </div>
              </div>
            </div>

            <aside className="summary-card">
              <div className="summary-title">Booking Summary</div>
              <div id="summary-content">
                {summaryRows.length ? summaryRows.map((row) => (
                  <div key={row.label} className="summary-row">
                    <div className="sum-label">{row.label}</div>
                    <div className="sum-val">{row.value}</div>
                    {row.sub ? <div className="sum-sub">{row.sub}</div> : null}
                  </div>
                )) : <p className="text-muted small text-center py-3">Complete each step to see your booking summary here.</p>}
                {selectedService ? (
                  <div className="summary-row">
                    <div className="sum-label">Estimated Invoice</div>
                    <div className="price-total">{formatCurrency(selectedService.basePrice)}</div>
                    <div className="sum-sub">{selectedService.durationHours ? `${selectedService.durationHours}h estimated - Booking charge ${formatCurrency(selectedService.bookingCharge ?? DEFAULT_BOOKING_CHARGE)}` : `Booking charge ${formatCurrency(selectedService.bookingCharge ?? DEFAULT_BOOKING_CHARGE)}`}</div>
                  </div>
                ) : null}
              </div>
              <div className="progress-dots">
                {STEPS.map((_, index) => <div key={index} className={`progress-dot ${index < step ? 'done' : index === step ? 'active' : ''}`} />)}
              </div>
            </aside>
          </div>
        </PageContent>
      </div>
    </CustomerLayout>
  )
}

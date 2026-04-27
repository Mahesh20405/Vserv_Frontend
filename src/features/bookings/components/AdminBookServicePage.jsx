import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminLayout } from '../../../layouts/AppShell'
import { PageHero, PageContent } from '../../../components/common/PageElements'
import { PageSpinner } from '../../../components/ui/Spinner'
import { BookingStepper } from '../../../components/ui/BookingStepper'
import { ServiceCard } from '../../../components/ui/ServiceCard'
import { VehicleCard } from '../../../components/ui/VehicleCard'
import { TimeSlotGrid } from '../../../components/ui/TimeSlotGrid'
import { useToast } from '../../../components/ui/Toast'
import { formatCurrency, formatDate } from '../../../utils/formatters'
import { validateAdminBookServiceForm } from '../../../utils/adminValidation'
import { useNavigationGuard } from '../../../hooks/useNavigationGuard'
import '../../../styles/features/bookings/AdminBookServicePage.css'
import { availabilityService } from '../../availability/services/availabilityService'
import { bookingService } from '../services/bookingService'
import { catalogService } from '../../catalog/services/catalogService'
import { userService } from '../../users/services/userService'
import { vehicleService } from '../../vehicles/services/vehicleService'

const STEPS = ['Customer', 'Vehicle', 'Service', 'Schedule', 'Confirm']
const CUSTOMER_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#6C5CE7', '#A29BFE', '#F39C12', '#27AE60']
const BOOKING_PAYMENT_METHODS = ['CASH', 'UPI', 'CARD', 'NET_BANKING']
const DEFAULT_BOOKING_CHARGE = 299
const LOYALTY_THRESHOLD = 20

function customerSortValue(customer = {}) {
  return new Date(customer.createdAt || 0).getTime() || 0
}

function customerColor(id = 0) {
  return CUSTOMER_COLORS[id % CUSTOMER_COLORS.length]
}

function customerInitials(name = '?') {
  return name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?'
}

export function AdminBookServicePage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState(0)
  const [customers, setCustomers] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [services, setServices] = useState([])
  const [slots, setSlots] = useState([])
  const [customerQuery, setCustomerQuery] = useState('')
  const [serviceQuery, setServiceQuery] = useState('')
  const [serviceType, setServiceType] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [selectedService, setSelectedService] = useState(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [notes, setNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [transactionRef, setTransactionRef] = useState('')
  const [waiveBookingCharge, setWaiveBookingCharge] = useState(false)
  const [errors, setErrors] = useState({})
  const guardNavigation = useNavigationGuard(
    Boolean(selectedCustomer || selectedVehicle || selectedService || selectedDate || selectedSlot || notes.trim() || submitting),
    'A booking is still in progress. Leaving now will discard the current booking flow. Continue?'
  )

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [userResponse, catalogResponse] = await Promise.all([
          userService.list({ role: 'CUSTOMER' }),
          catalogService.list({ activeOnly: true }),
        ])
        setCustomers((userResponse.data || []).slice().sort((left, right) => (
          customerSortValue(right) - customerSortValue(left) ||
          Number(right.userId || 0) - Number(left.userId || 0)
        )))
        setServices((catalogResponse.data || [])
          .filter((service) => service.isActive !== false)
          .sort((left, right) => Number(right.catalogId || 0) - Number(left.catalogId || 0)))
      } catch (error) {
        toast(error.response?.data?.message || 'Failed to load booking data.', 'error')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const tomorrow = useMemo(() => {
    const value = new Date()
    value.setDate(value.getDate() + 1)
    return value.toISOString().split('T')[0]
  }, [])

  const filteredCustomers = useMemo(() => {
    const query = customerQuery.trim().toLowerCase()
    return customers
      .filter((customer) => {
        if (!query) return true
        return [customer.fullName, customer.email].filter(Boolean).join(' ').toLowerCase().includes(query)
      })
      .sort((left, right) => (
        customerSortValue(right) - customerSortValue(left) ||
        Number(right.userId || 0) - Number(left.userId || 0)
      ))
  }, [customers, customerQuery])

  const filteredServices = useMemo(() => {
    return services
      .filter((service) => !selectedVehicle || service.carType === 'ALL' || service.carType === selectedVehicle.carType)
      .filter((service) => !serviceQuery.trim() || [service.serviceName, service.description].filter(Boolean).join(' ').toLowerCase().includes(serviceQuery.trim().toLowerCase()))
      .filter((service) => !serviceType || service.serviceType === serviceType)
      .sort((left, right) => Number(right.catalogId || 0) - Number(left.catalogId || 0))
  }, [services, selectedVehicle, serviceQuery, serviceType])

  const bookingChargeAmount = selectedService?.bookingCharge ?? DEFAULT_BOOKING_CHARGE
  const loyaltyEligible = Boolean(selectedCustomer?.loyaltyEligible)
  const completedServicesCount = Number(selectedCustomer?.completedServicesCount || 0)
  const effectiveBookingCharge = waiveBookingCharge ? 0 : bookingChargeAmount
  const estimatedInvoiceTotal = Number(selectedService?.basePrice || 0) + Number(effectiveBookingCharge || 0)
  const serviceTypes = useMemo(() => [...new Set(services.map((service) => service.serviceType).filter(Boolean))], [services])

  async function loadVehicles(customer) {
    const response = await vehicleService.byUser(customer.userId)
    setVehicles((response.data || []).slice().sort((left, right) => Number(right.vehicleId || 0) - Number(left.vehicleId || 0)))
  }

  async function loadSlots(date) {
    const response = await availabilityService.bookable({ from: date, to: date })
    setSlots(response.data || [])
  }

  function selectCustomer(customer) {
    setSelectedCustomer(customer)
    setSelectedVehicle(null)
    setSelectedService(null)
    setSelectedDate('')
    setSelectedSlot(null)
    setSlots([])
    setWaiveBookingCharge(Boolean(customer?.loyaltyEligible))
    setErrors({})
    loadVehicles(customer)
  }

  function buildPayload() {
    return {
      customerId: selectedCustomer?.userId,
      vehicleId: selectedVehicle?.vehicleId,
      catalogId: selectedService?.catalogId,
      serviceDate: selectedDate,
      timeSlot: selectedSlot?.timeSlot,
      notes,
      paymentMethod: waiveBookingCharge ? null : paymentMethod,
      transactionRef: waiveBookingCharge ? '' : transactionRef,
      waiveBookingCharge,
    }
  }

  function validateStep(targetStep = step + 1) {
    const payload = buildPayload()
    const { errors: nextErrors, isValid } = validateAdminBookServiceForm(payload)
    if (targetStep <= 1 && selectedCustomer) return true
    if (targetStep <= 2 && selectedCustomer && selectedVehicle) return true
    if (targetStep <= 3 && selectedCustomer && selectedVehicle && selectedService) return true
    if (targetStep <= 4) {
      setErrors(nextErrors)
      return !nextErrors.customerId && !nextErrors.vehicleId && !nextErrors.catalogId && !nextErrors.serviceDate && !nextErrors.timeSlot && !nextErrors.notes
    }
    setErrors(nextErrors)
    return isValid
  }

  async function confirmBooking() {
    const payload = buildPayload()
    const { errors: nextErrors, isValid } = validateAdminBookServiceForm(payload)
    if (!isValid) {
      setErrors(nextErrors)
      return
    }

    setSubmitting(true)
    try {
      const response = await bookingService.create({
        vehicleId: selectedVehicle.vehicleId,
        catalogId: selectedService.catalogId,
        serviceDate: selectedDate,
        timeSlot: selectedSlot.timeSlot,
        notes: notes.trim() || null,
        paymentMethod: waiveBookingCharge ? null : paymentMethod,
        transactionRef: waiveBookingCharge ? null : transactionRef.trim(),
        waiveBookingCharge,
      })
      toast(`Booking #${response.data.bookingId} created successfully.`)
      navigate('/admin/bookings')
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to create booking.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <AdminLayout activeKey="book-service"><PageSpinner /></AdminLayout>
  }

  const summaryRows = []
  if (selectedCustomer) summaryRows.push({ label: 'Customer', value: selectedCustomer.fullName, sub: selectedCustomer.email })
  if (selectedVehicle) summaryRows.push({ label: 'Vehicle', value: `${selectedVehicle.brand} ${selectedVehicle.model}`, sub: `${selectedVehicle.registrationNumber} - ${selectedVehicle.carType}` })
  if (selectedService) summaryRows.push({ label: 'Service', value: selectedService.serviceName, sub: `${selectedService.serviceType} - ${selectedService.carType}` })
  if (selectedDate || selectedSlot) summaryRows.push({ label: 'Schedule', value: selectedDate ? formatDate(selectedDate) : '-', sub: selectedSlot?.timeSlot || 'No slot selected' })
  if (selectedService) summaryRows.push({
    label: 'Estimated Invoice',
    value: formatCurrency(estimatedInvoiceTotal),
    sub: waiveBookingCharge
      ? `Service ${formatCurrency(selectedService.basePrice)} + booking charge waived`
      : `Service ${formatCurrency(selectedService.basePrice)} + booking charge ${formatCurrency(effectiveBookingCharge)}`,
  })
  if (selectedService) summaryRows.push({
    label: 'Booking Charge',
    value: waiveBookingCharge ? 'Waived' : formatCurrency(effectiveBookingCharge),
    sub: waiveBookingCharge
      ? `Loyalty benefit applied after ${completedServicesCount} completed services`
      : `${paymentMethod}${paymentMethod !== 'CASH' && transactionRef.trim() ? ` - ${transactionRef.trim()}` : ''}`,
  })

  return (
    <AdminLayout activeKey="book-service">
      <div className="book-service-page">
        <PageHero
          title="Book Service for Any User"
          subtitle="Create a booking on behalf of any registered customer"
          variant="admin"
          className="book-service-hero"
          actions={<button type="button" className="book-service-back-link bg-transparent border-0" onClick={() => guardNavigation(() => navigate('/admin/bookings'))}>Back to Bookings</button>}
        />

        <PageContent className="py-4">
          <div className="booking-layout">
            <div>
              <BookingStepper steps={STEPS} step={step} onStepChange={setStep} />

              <div className={`stage-panel ${step === 0 ? 'active' : ''}`}>
                <div className="stage-header">
                  <div className="stage-num">1</div>
                  <div>
                    <div className="stage-title">Select Customer</div>
                    <div className="stage-sub">Search and choose the customer you're booking for</div>
                  </div>
                </div>
                <div className="search-box">
                  <input type="text" placeholder="Search by name or email..." value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} />
                </div>
                <div className="stage-count">{`${filteredCustomers.length} of ${customers.length} customers`}</div>
                <div className="customer-grid">
                  {filteredCustomers.map((customer) => {
                    const selected = selectedCustomer?.userId === customer.userId
                    return (
                      <button key={customer.userId} type="button" className={`customer-card ${selected ? 'selected' : ''}`} onClick={() => selectCustomer(customer)}>
                        <div className="cust-avatar" style={{ background: customerColor(customer.userId) }}>{customerInitials(customer.fullName)}</div>
                        <div className="min-w-0">
                          <div className="cust-name">{customer.fullName}</div>
                          <div className="cust-email">{customer.email}</div>
                          <div className="cust-meta-row">
                            <span className="cust-meta">{Number(customer.completedServicesCount || 0)} completed services</span>
                            {customer.loyaltyEligible ? <span className="loyalty-badge">Loyalty</span> : null}
                          </div>
                        </div>
                        {selected ? <span className="check-icon">OK</span> : null}
                      </button>
                    )
                  })}
                </div>
                <div className="stage-nav">
                  <span />
                  <button type="button" className="btn-next" disabled={!selectedCustomer} onClick={() => setStep(1)}>Next: Vehicle</button>
                </div>
              </div>

              <div className={`stage-panel ${step === 1 ? 'active' : ''}`}>
                <div className="stage-header">
                  <div className="stage-num">2</div>
                  <div>
                    <div className="stage-title">Select Vehicle</div>
                    <div className="stage-sub">Choose a registered vehicle for {selectedCustomer?.fullName || 'the customer'}</div>
                  </div>
                </div>
                {!vehicles.length ? (
                  <div className="no-vehicle-alert">No vehicles registered for this customer yet. Add one from Vehicle Management first.</div>
                ) : (
                  <div className="vehicle-grid">
                    {vehicles.map((vehicle) => <VehicleCard key={vehicle.vehicleId} vehicle={vehicle} selected={selectedVehicle?.vehicleId === vehicle.vehicleId} onClick={() => { setSelectedVehicle(vehicle); setErrors({}) }} />)}
                  </div>
                )}
                {errors.vehicleId ? <div className="text-danger small mt-2">{errors.vehicleId}</div> : null}
                <div className="stage-nav">
                  <button type="button" className="btn-prev" onClick={() => setStep(0)}>Back</button>
                  <button type="button" className="btn-next" disabled={!selectedVehicle} onClick={() => setStep(2)}>Next: Service</button>
                </div>
              </div>

              <div className={`stage-panel ${step === 2 ? 'active' : ''}`}>
                <div className="stage-header">
                  <div className="stage-num">3</div>
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
                  <textarea className={`form-input ${errors.notes ? 'is-invalid' : ''}`} rows={4} value={notes} placeholder="Optional: mention additional services, symptoms, or customer requests." onChange={(event) => { setNotes(event.target.value); setErrors((previous) => ({ ...previous, notes: undefined })) }} />
                  {errors.notes ? <div className="invalid-feedback d-block">{errors.notes}</div> : null}
                </div>
                {errors.catalogId ? <div className="text-danger small mt-2">{errors.catalogId}</div> : null}
                <div className="stage-nav">
                  <button type="button" className="btn-prev" onClick={() => setStep(1)}>Back</button>
                  <button type="button" className="btn-next" disabled={!selectedService} onClick={() => setStep(3)}>Next: Schedule</button>
                </div>
              </div>

              <div className={`stage-panel ${step === 3 ? 'active' : ''}`}>
                <div className="stage-header">
                  <div className="stage-num">4</div>
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
                  <button type="button" className="btn-prev" onClick={() => setStep(2)}>Back</button>
                  <button type="button" className="btn-next" onClick={() => { if (validateStep(4)) setStep(4) }}>Next: Confirm</button>
                </div>
              </div>

              <div className={`stage-panel ${step === 4 ? 'active' : ''}`}>
                <div className="stage-header">
                  <div className="stage-num">5</div>
                  <div>
                    <div className="stage-title">Confirm Booking</div>
                    <div className="stage-sub">Review the booking details before creating it on behalf of the customer</div>
                  </div>
                </div>
                <div className="confirm-grid">
                  {[
                    ['Customer', selectedCustomer?.fullName, selectedCustomer?.email],
                    ['Vehicle', selectedVehicle ? `${selectedVehicle.brand} ${selectedVehicle.model}` : '-', selectedVehicle?.registrationNumber],
                    ['Service', selectedService?.serviceName, `${selectedService?.serviceType || ''} - ${selectedService?.carType || ''}`],
                    ['Service Date', selectedDate ? formatDate(selectedDate) : '-', selectedSlot?.timeSlot || '-'],
                    ['Duration', selectedService?.durationHours ? `${selectedService.durationHours}h` : '-', 'Estimated'],
                    ['Estimated Invoice', selectedService ? formatCurrency(estimatedInvoiceTotal) : '-', waiveBookingCharge ? `Service ${formatCurrency(selectedService?.basePrice || 0)} + booking charge waived` : `Service ${formatCurrency(selectedService?.basePrice || 0)} + booking charge ${formatCurrency(effectiveBookingCharge)}`],
                    ['Booking Charge', selectedService ? (waiveBookingCharge ? 'Waived' : formatCurrency(effectiveBookingCharge)) : '-', waiveBookingCharge ? `Loyalty benefit applied after ${completedServicesCount} completed services` : 'Collected now to lock the slot'],
                    ['Booking Charge Payment', waiveBookingCharge ? 'Not required' : (paymentMethod || '-'), waiveBookingCharge ? 'Loyalty waiver selected by admin' : paymentMethod !== 'CASH' ? (transactionRef || 'Transaction ref required') : 'Cash accepted for admin bookings'],
                    ['Instructions', notes || '-', null],
                  ].map(([label, value, sub]) => (
                    <div key={label} className="confirm-card">
                      <div className="sum-label">{label}</div>
                      <div className={`sum-val ${label === 'Estimated Invoice' ? 'sum-val-accent' : ''}`}>{value || '-'}</div>
                      {sub ? <div className="sum-sub">{sub}</div> : null}
                    </div>
                  ))}
                </div>
                {selectedCustomer ? (
                  <div className={`loyalty-panel ${loyaltyEligible ? 'eligible' : ''}`}>
                    <div className="loyalty-panel-title">Loyalty Status</div>
                    <div className="loyalty-panel-copy">
                      {loyaltyEligible
                        ? `${selectedCustomer.fullName} has completed ${completedServicesCount} services and qualifies for admin-side booking charge waiver. The booking charge is removed by default for this loyal customer.`
                        : `${selectedCustomer.fullName} has completed ${completedServicesCount} services. Waiver unlocks at ${LOYALTY_THRESHOLD} completed services.`}
                    </div>
                    <label className={`loyalty-toggle ${!loyaltyEligible ? 'disabled' : ''}`}>
                      <input
                        type="checkbox"
                        checked={!waiveBookingCharge}
                        disabled={!loyaltyEligible}
                        onChange={(event) => {
                          const applyCharge = event.target.checked
                          setWaiveBookingCharge(!applyCharge)
                          if (!applyCharge) {
                            setErrors((current) => ({ ...current, paymentMethod: undefined, transactionRef: undefined }))
                          }
                        }}
                      />
                      <span>Apply booking charge to this booking</span>
                    </label>
                    <div className="loyalty-panel-note">
                      {loyaltyEligible
                        ? 'Uncheck to remove the booking charge for this loyal customer, or leave it checked to collect the usual charge.'
                        : 'Booking charge remains applied for non-loyal customers.'}
                    </div>
                  </div>
                ) : null}
                <div className="row g-3 mt-1">
                  <div className="col-md-6">
                    <label className="form-label label-sm">Booking Charge Payment Method {waiveBookingCharge ? '' : <span className="required-mark">*</span>}</label>
                    <select className={`form-select form-select-sm ${errors.paymentMethod ? 'is-invalid' : ''}`} value={paymentMethod} disabled={waiveBookingCharge} onChange={(event) => { setPaymentMethod(event.target.value); setErrors((current) => ({ ...current, paymentMethod: undefined, transactionRef: undefined })) }}>
                      {BOOKING_PAYMENT_METHODS.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                    {errors.paymentMethod ? <div className="invalid-feedback d-block">{errors.paymentMethod}</div> : null}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label label-sm">Transaction Reference {!waiveBookingCharge && paymentMethod !== 'CASH' ? <span className="required-mark">*</span> : ''}</label>
                    <input className={`form-control form-control-sm ${errors.transactionRef ? 'is-invalid' : ''}`} value={transactionRef} disabled={waiveBookingCharge} placeholder={waiveBookingCharge ? 'Not needed when loyalty waiver is used' : paymentMethod === 'CASH' ? 'Optional for cash collection' : 'Required for digital payment'} onChange={(event) => { setTransactionRef(event.target.value); setErrors((current) => ({ ...current, transactionRef: undefined })) }} />
                    {errors.transactionRef ? <div className="invalid-feedback d-block">{errors.transactionRef}</div> : null}
                  </div>
                </div>
                <div className="stage-nav">
                  <button type="button" className="btn-prev" onClick={() => setStep(3)}>Back</button>
                  <button type="button" className="btn-next btn-confirm" disabled={submitting} onClick={confirmBooking}>{submitting ? 'Creating...' : 'Create Booking'}</button>
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
                    <div className="price-total">{formatCurrency(estimatedInvoiceTotal)}</div>
                    <div className="sum-sub">
                      {selectedService.durationHours
                        ? `${selectedService.durationHours}h estimated - Service ${formatCurrency(selectedService.basePrice)} + ${waiveBookingCharge ? 'booking charge waived' : `booking charge ${formatCurrency(effectiveBookingCharge)}`}`
                        : `Service ${formatCurrency(selectedService.basePrice)} + ${waiveBookingCharge ? 'booking charge waived' : `booking charge ${formatCurrency(effectiveBookingCharge)}`}`}
                    </div>
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
    </AdminLayout>
  )
}

import { EMAIL_RE, PHONE_RE, NAME_RE, PASSWORD_RE } from './validationPatterns'
const VEHICLE_MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9\s.'-]*$/
const CATALOG_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9\s&'().,+\-\/]*$/
const REG_RE = /^[A-Z]{2}[ -]?\d{1,2}[ -]?[A-Z]{1,3}[ -]?\d{4}$/

export function evaluatePasswordStrength(password = '') {
  if (!password) return { score: 0, label: 'Add a strong password', color: '#cbd5e1' }

  let score = 0
  if (password.length >= 8) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/[a-z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[@$!%*?&#^()_+=\-]/.test(password)) score += 1

  if (score <= 2) return { score, label: 'Weak', color: '#ef4444' }
  if (score === 3 || score === 4) return { score, label: 'Medium', color: '#f59e0b' }
  return { score, label: 'Strong', color: '#16a34a' }
}

export function normalizeRegistrationNumber(value = '') {
  return value.toUpperCase().replace(/\s+/g, ' ').trim()
}

export function validateUserForm(form, users = [], editingUserId = null, vehicles = []) {
  const errors = {}
  const name = (form.fullName || '').trim()
  const email = (form.email || '').trim().toLowerCase()
  const phone = (form.phone || '').trim()
  const password = form.password || ''
  const roleName = form.roleName || 'CUSTOMER'
  const isCreate = !editingUserId
  const shouldValidateVehicle = isCreate && roleName === 'CUSTOMER' && Boolean(form.addVehicleNow)

  if (!name) errors.fullName = 'Full name cannot be empty.'
  else if (name.length < 2) errors.fullName = 'Name must be at least 2 characters.'
  else if (!NAME_RE.test(name)) errors.fullName = 'Name can only contain letters, spaces, hyphens, apostrophes, and dots.'

  if (!email) errors.email = 'Email address cannot be empty.'
  else if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.'
  else if (users.some((u) => (u.email || '').trim().toLowerCase() === email && u.userId !== editingUserId)) {
    errors.email = 'Email is already registered.'
  }

  if (!editingUserId || phone) {
    const digits = phone.replace(/\D/g, '')
    if (!phone.trim()) errors.phone = 'Mobile number cannot be empty.'
    else if (digits !== phone) errors.phone = 'Mobile number must contain digits only.'
    else if (digits.length !== 10) errors.phone = 'Mobile number must be exactly 10 digits.'
    else if (!PHONE_RE.test(digits)) errors.phone = 'Enter a valid Indian mobile number starting with 6, 7, 8, or 9.'
    else if (users.some((u) => (u.phone || '').replace(/\D/g, '') === digits && u.userId !== editingUserId)) {
      errors.phone = 'Mobile number is already registered.'
    }
  }

  if (!editingUserId) {
    if (!password) errors.password = 'Password is required for new users.'
    else if (password.length < 8) errors.password = 'Password must be at least 8 characters.'
    else if (!PASSWORD_RE.test(password)) {
      errors.password = 'Password must include uppercase, lowercase, digit, and special character.'
    }
  } else if (password && !PASSWORD_RE.test(password)) {
    errors.password = 'Password must include uppercase, lowercase, digit, and special character.'
  }

  if (roleName === 'ADVISOR' && form.overtimeRate !== undefined && form.overtimeRate !== '') {
    const rate = Number(form.overtimeRate)
    if (!Number.isFinite(rate) || rate < 0) errors.overtimeRate = 'Overtime rate must be 0 or greater.'
  }

  if (roleName === 'ADVISOR' && form.specialization && form.specialization.trim().length > 80) {
    errors.specialization = 'Specialization must be 80 characters or fewer.'
  }

  if (shouldValidateVehicle) {
    const registrationNumber = normalizeRegistrationNumber(form.vehicleRegistrationNumber)
    const manufactureYear = Number(form.vehicleManufactureYear)
    const mileage = Number(form.vehicleMileage)
    const interval = (form.vehicleServiceIntervalKm ?? '') === '' ? null : Number(form.vehicleServiceIntervalKm)
    const currentYear = new Date().getFullYear()

    if (!form.vehicleCarType) errors.vehicleCarType = 'Please select a car type.'
    if (!form.vehicleBrand?.trim()) errors.vehicleBrand = 'Brand cannot be empty.'
    if (!form.vehicleModel?.trim()) errors.vehicleModel = 'Model cannot be empty.'

    if (!registrationNumber) errors.vehicleRegistrationNumber = 'Registration number cannot be empty.'
    else if (!REG_RE.test(registrationNumber)) errors.vehicleRegistrationNumber = 'Enter a valid registration number, e.g., TN55AK0915.'
    if (!errors.vehicleRegistrationNumber && vehicles.some((v) =>
      normalizeRegistrationNumber(v.registrationNumber || v.registration || '') === registrationNumber
    )) {
      errors.vehicleRegistrationNumber = 'A vehicle with this registration already exists.'
    }

    if (!Number.isInteger(manufactureYear)) errors.vehicleManufactureYear = 'Manufacture year must be a whole number.'
    else if (manufactureYear < 1900 || manufactureYear > currentYear) {
      errors.vehicleManufactureYear = `Manufacture year must be between 1900 and ${currentYear}.`
    }

    if (!Number.isInteger(mileage)) errors.vehicleMileage = 'Mileage must be a whole number.'
    else if (mileage < 0) errors.vehicleMileage = 'Mileage cannot be negative.'

    if (interval !== null) {
      if (!Number.isInteger(interval)) errors.vehicleServiceIntervalKm = 'Service interval must be a whole number.'
      else if (interval < 1000) errors.vehicleServiceIntervalKm = 'Service interval must be at least 1000 km.'
    }

    if (Number.isInteger(mileage) && mileage < 10000 && !form.lowMileageConsent) {
      errors.lowMileageConsent = 'Please confirm low mileage before adding this vehicle.'
    }
  }

  return { errors, isValid: Object.keys(errors).length === 0 }
}

export function validateVehicleForm(form, vehicles = [], options = {}) {
  const { editingVehicleId = null, currentBookings = 0 } = options
  const errors = {}
  const isEdit = Boolean(editingVehicleId)
  const registrationNumber = normalizeRegistrationNumber(form.registrationNumber)
  const year = Number(form.manufactureYear)
  const mileage = Number(form.mileage)
  const interval = form.serviceIntervalKm === '' || form.serviceIntervalKm === null || form.serviceIntervalKm === undefined
    ? null
    : Number(form.serviceIntervalKm)
  const currentYear = new Date().getFullYear()

  if (!isEdit && !form.userId) errors.userId = 'Please select a customer.'

  if (!form.brand?.trim()) errors.brand = 'Brand cannot be empty.'
  else if (!NAME_RE.test(form.brand.trim())) errors.brand = 'Brand can only contain letters, spaces, hyphens, apostrophes, and dots.'

  if (!form.model?.trim()) errors.model = 'Model cannot be empty.'
  else if (!VEHICLE_MODEL_RE.test(form.model.trim())) errors.model = 'Model can only contain letters, numbers, spaces, hyphens, apostrophes, and dots.'

  if (!registrationNumber) errors.registrationNumber = 'Registration number cannot be empty.'
  else if (!REG_RE.test(registrationNumber)) errors.registrationNumber = 'Enter a valid registration number, e.g., TN55AK0915.'
  else if (vehicles.some((v) => normalizeRegistrationNumber(v.registrationNumber) === registrationNumber && v.vehicleId !== editingVehicleId)) {
    errors.registrationNumber = 'Registration number already exists.'
  }

  if (!form.carType) errors.carType = 'Please select a car type.'
  if (!Number.isInteger(year)) errors.manufactureYear = 'Manufacture year must be a whole number.'
  else if (year < 1990 || year > currentYear) errors.manufactureYear = `Manufacture year must be between 1990 and ${currentYear}.`

  if (!Number.isInteger(mileage)) errors.mileage = 'Mileage must be a whole number.'
  else if (mileage < 0) errors.mileage = 'Mileage cannot be negative.'

  if (interval !== null) {
    if (!Number.isInteger(interval)) errors.serviceIntervalKm = 'Service interval must be a whole number.'
    else if (interval < 1000 || interval > 50000) errors.serviceIntervalKm = 'Service interval must be between 1000 and 50000 km.'
  }

  if (!isEdit && mileage < 10000 && !form.lowMileageConsent) {
    errors.lowMileageConsent = 'Please confirm low mileage before adding this vehicle.'
  }

  if (isEdit && Number.isFinite(currentBookings) && interval !== null && interval < 1000) {
    errors.serviceIntervalKm = 'Service interval must be at least 1000 km.'
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
    normalized: {
      ...form,
      registrationNumber,
    },
  }
}

export function validateCatalogForm(form, items = [], editingId = null) {
  const errors = {}
  const name = (form.serviceName || '').trim()
  const description = (form.description || '').trim()
  const price = Number(form.basePrice)
  const duration = form.durationHours === '' ? null : Number(form.durationHours)

  if (!name) errors.serviceName = 'Service name cannot be empty.'
  else if (name.length < 3) errors.serviceName = 'Service name must be at least 3 characters.'
  else if (!CATALOG_NAME_RE.test(name)) errors.serviceName = 'Service name can only use letters, numbers, spaces, and basic symbols like & / - . ( ).'

  if (!form.serviceType) errors.serviceType = 'Service type is required.'
  if (!form.carType) errors.carType = 'Car type is required.'
  if (!Number.isFinite(price) || price < 0) errors.basePrice = 'Base price must be 0 or greater.'
  if (duration === null || !Number.isFinite(duration) || duration <= 0) errors.durationHours = 'Duration must be greater than 0.'
  if (description.length > 250) errors.description = 'Description must be 250 characters or fewer.'

  const duplicate = items.some((item) =>
    item.catalogId !== editingId &&
    (item.serviceName || '').trim().toLowerCase() === name.toLowerCase() &&
    item.serviceType === form.serviceType &&
    (item.carType || 'ALL') === form.carType
  )
  if (!errors.serviceName && duplicate) errors.serviceName = 'A matching service already exists for this type and car type.'

  return { errors, isValid: Object.keys(errors).length === 0 }
}

export function validateWorkItemForm(form, items = [], editingId = null) {
  const errors = {}
  const name = (form.itemName || '').trim()
  const description = (form.description || '').trim()
  const price = Number(form.unitPrice)

  if (!name) errors.itemName = 'Item name cannot be empty.'
  else if (name.length < 2) errors.itemName = 'Item name must be at least 2 characters.'
  else if (!CATALOG_NAME_RE.test(name)) errors.itemName = 'Item name can only use letters, numbers, spaces, and basic symbols like & / - . ( ).'

  if (!form.itemType) errors.itemType = 'Type is required.'
  if (!form.carType) errors.carType = 'Car type is required.'
  if (!Number.isFinite(price) || price < 0) errors.unitPrice = 'Unit price must be 0 or greater.'
  if (description.length > 250) errors.description = 'Description must be 250 characters or fewer.'

  const duplicate = items.some((item) =>
    item.workItemId !== editingId &&
    (item.itemName || '').trim().toLowerCase() === name.toLowerCase()
  )
  if (!errors.itemName && duplicate) errors.itemName = 'Work item name already exists.'

  return { errors, isValid: Object.keys(errors).length === 0 }
}

export function validateAvailabilitySlotForm(form, mode = 'create', slot = null) {
  const errors = {}
  const today = new Date().toISOString().split('T')[0]
  const maxBookings = Number(form.maxBookings)
  const slotPattern = /^(09:00-11:00|11:00-13:00|13:00-15:00|15:00-17:00|17:00-19:00)$/
  const slotStartMinutes = (value = '') => {
    const match = value.split('-')[0]?.trim().match(/^(\d{1,2}):(\d{2})$/)
    return match ? (Number(match[1]) * 60) + Number(match[2]) : null
  }
  const hasStartedToday = (date, value) => {
    if (date !== today) return false
    const slotMinutes = slotStartMinutes(value)
    if (slotMinutes == null) return false
    const now = new Date()
    return ((now.getHours() * 60) + now.getMinutes()) >= slotMinutes
  }

  if (mode === 'create') {
    if (!form.serviceDate) errors.serviceDate = 'Date is required.'
    else if (form.serviceDate < today) errors.serviceDate = 'Cannot create slots for past dates.'
    if (!form.timeSlot) errors.timeSlot = 'Time slot is required.'
    else if (!slotPattern.test(form.timeSlot)) errors.timeSlot = 'Select a valid time slot.'
    else if (hasStartedToday(form.serviceDate, form.timeSlot)) errors.timeSlot = 'Cannot create slots for past time on today.'
  }

  if (!Number.isInteger(maxBookings)) errors.maxBookings = 'Maximum bookings must be a whole number.'
  else if (maxBookings < 1 || maxBookings > 20) errors.maxBookings = 'Maximum bookings must be between 1 and 20.'
  else if (mode === 'edit' && slot && maxBookings < (slot.currentBookings || 0)) {
    errors.maxBookings = `Cannot be less than current bookings (${slot.currentBookings || 0}).`
  }

  if (mode === 'bulk') {
    if (!form.from) errors.from = 'From date is required.'
    if (!form.to) errors.to = 'To date is required.'
    if (form.from && form.from < today) errors.from = 'From date cannot be in the past.'
    if (form.to && form.to < form.from) errors.to = 'To date cannot be earlier than from date.'
    if (!form.slots?.length) errors.slots = 'Select at least one time slot.'
    else if (form.slots.some((value) => !slotPattern.test(value))) errors.slots = 'One or more selected time slots are invalid.'
    else if (form.from && form.to && form.from <= today && today <= form.to && form.slots.some((value) => hasStartedToday(today, value))) {
      errors.slots = 'Started time slots cannot be bulk-created for today.'
    }
  }

  return { errors, isValid: Object.keys(errors).length === 0 }
}

export function validateInvoicePaymentForm(form = {}, invoice = null, options = {}) {
  const errors = {}
  const amount = Number(form.amount)
  const txRef = (form.transactionReference || form.transactionRef || '').trim()
  const remainingBalance = Number(invoice?.remainingBalance ?? invoice?.totalAmount ?? 0)
  const { allowCash = true, requireTransactionRef = true } = options

  if (!form.paymentMethod) errors.paymentMethod = 'Please select a payment method.'
  else if (!(allowCash ? ['UPI', 'CARD', 'NET_BANKING', 'CASH'] : ['UPI', 'CARD', 'NET_BANKING']).includes(form.paymentMethod)) {
    errors.paymentMethod = 'Please select a valid payment method.'
  }

  if (!Number.isFinite(amount)) errors.amount = 'Payment amount is required.'
  else if (amount <= 0) errors.amount = 'Payment amount must be greater than 0.'
  else if (remainingBalance > 0 && amount > remainingBalance) {
    errors.amount = `Payment cannot exceed the remaining balance of ${remainingBalance.toLocaleString('en-IN')}.`
  }

  if (txRef && !/^[A-Za-z0-9._\-/#]{4,40}$/.test(txRef)) {
    errors.transactionReference = 'Use 4-40 characters: letters, numbers, and . _ - / # only.'
  }
  if (requireTransactionRef && form.paymentMethod !== 'CASH' && !txRef) {
    errors.transactionReference = 'Transaction reference is required for digital payments.'
  }

  return { errors, isValid: Object.keys(errors).length === 0 }
}

export function validateAdvisorForm(form) {
  const errors = {}
  if (form.specialization && form.specialization.trim().length > 80) {
    errors.specialization = 'Specialization must be 80 characters or fewer.'
  }
  if (form.overtimeRate !== '' && form.overtimeRate !== null && form.overtimeRate !== undefined) {
    const rate = Number(form.overtimeRate)
    if (!Number.isFinite(rate) || rate < 0) errors.overtimeRate = 'Overtime rate must be 0 or greater.'
  }
  if (!form.availabilityStatus) errors.availabilityStatus = 'Availability status is required.'
  return { errors, isValid: Object.keys(errors).length === 0 }
}

export function validateProfileForm(form) {
  const errors = {}
  const name = (form.fullName || '').trim()
  const phone = (form.phone || '').trim()

  if (!name) errors.fullName = 'Full name cannot be empty.'
  else if (name.length < 2) errors.fullName = 'Name must be at least 2 characters.'
  else if (!NAME_RE.test(name)) errors.fullName = 'Name can only contain letters, spaces, hyphens, apostrophes, and dots.'

  if (!phone) errors.phone = 'Mobile number cannot be empty.'
  else if (!PHONE_RE.test(phone)) errors.phone = 'Enter a valid Indian mobile number.'

  return { errors, isValid: Object.keys(errors).length === 0 }
}

export function validatePasswordChangeForm(form) {
  const errors = {}
  if (!(form.currentPassword || '').trim()) errors.currentPassword = 'Current password is required.'
  if (!form.newPassword) errors.newPassword = 'New password is required.'
  else if (form.newPassword.length < 8) errors.newPassword = 'Password must be at least 8 characters.'
  return { errors, isValid: Object.keys(errors).length === 0 }
}

export function validateBookingAdminAction(type, payload = {}, advisors = []) {
  const errors = {}
  const findAdvisor = (advisorId) => advisors.find((item) => String(item.advisorId) === String(advisorId))
  const isSelectableAdvisor = (advisor) => advisor && !advisor.isDeleted && (advisor.userStatus || 'ACTIVE') === 'ACTIVE'

  if (type === 'confirm' && payload.advisorId) {
    const advisor = findAdvisor(payload.advisorId)
    if (!advisor) errors.advisorId = 'Selected advisor was not found.'
    else if (!isSelectableAdvisor(advisor)) {
      errors.advisorId = 'Selected advisor is inactive or deleted.'
    }
    else if (['ON_LEAVE', 'RESIGNED'].includes(advisor.availabilityStatus)) {
      errors.advisorId = 'Selected advisor is not eligible for assignment.'
    } else if (advisor.availabilityStatus === 'ASSIGNED' && Number(advisor.currentLoad || 0) >= 5) {
      errors.advisorId = 'Selected advisor has reached maximum active load.'
    }
  }

  if (type === 'cancel' && !(payload.reason || '').trim()) {
    errors.reason = 'Cancellation reason is required.'
  }

  if (type === 'reschedule') {
    const today = new Date().toISOString().split('T')[0]
    const slotPattern = /^\d{2}:\d{2}([ -]|–)\d{2}:\d{2}$/
    if (!payload.newDate) errors.newDate = 'Please select a date.'
    else if (payload.newDate < today) errors.newDate = 'Cannot reschedule to a past date.'
    if (!payload.newSlot) errors.newSlot = 'Please select a time slot.'
    else if (!slotPattern.test(payload.newSlot)) errors.newSlot = 'Enter a valid time slot.'
    if (!(payload.reason || '').trim()) errors.reason = 'Reason is required.'
  }

  if (type === 'reassign') {
    if (!payload.advisorId) errors.advisorId = 'Please select an advisor.'
    else {
      const advisor = findAdvisor(payload.advisorId)
      if (!advisor) errors.advisorId = 'Selected advisor was not found.'
      else if (!isSelectableAdvisor(advisor)) errors.advisorId = 'Selected advisor is inactive or deleted.'
      else if (['ON_LEAVE', 'RESIGNED'].includes(advisor.availabilityStatus)) errors.advisorId = 'Selected advisor is not eligible for assignment.'
      else if (advisor.availabilityStatus === 'ASSIGNED' && Number(advisor.currentLoad || 0) >= 5) {
        errors.advisorId = 'Selected advisor has reached maximum active load.'
      }
    }
  }

  return { errors, isValid: Object.keys(errors).length === 0 }
}

export function validateAdminBookServiceForm(payload = {}, options = {}) {
  const errors = validateBookServicePayload(payload, { requireCustomer: true, allowCash: true, ...options })
  return { errors, isValid: Object.keys(errors).length === 0 }
}

export function validateCustomerBookServiceForm(payload = {}, options = {}) {
  const errors = validateBookServicePayload(payload, { requireCustomer: false, allowCash: false, ...options })
  return { errors, isValid: Object.keys(errors).length === 0 }
}

function validateBookServicePayload(payload = {}, options = {}) {
  const errors = {}
  const { requireCustomer = true, allowCash = true, requireTransactionRef = true } = options
  const tomorrow = (() => {
    const value = new Date()
    value.setDate(value.getDate() + 1)
    return value.toISOString().split('T')[0]
  })()
  const notes = (payload.notes || '').trim()
  const txRef = (payload.transactionRef || '').trim()
  const waiveBookingCharge = Boolean(payload.waiveBookingCharge)

  if (requireCustomer && !payload.customerId) errors.customerId = 'Please select a customer.'
  if (!payload.vehicleId) errors.vehicleId = 'Please select a vehicle.'
  if (!payload.catalogId) errors.catalogId = 'Please select a service.'
  if (!payload.serviceDate) errors.serviceDate = 'Please select a service date.'
  else if (payload.serviceDate < tomorrow) errors.serviceDate = 'Bookings must be scheduled from tomorrow onward.'
  if (!payload.timeSlot) errors.timeSlot = 'Please select a time slot.'
  if (!waiveBookingCharge) {
    if (!payload.paymentMethod) errors.paymentMethod = 'Please select how the booking charge was paid.'
    else if (!(allowCash ? ['UPI', 'CARD', 'NET_BANKING', 'CASH'] : ['UPI', 'CARD', 'NET_BANKING']).includes(payload.paymentMethod)) {
      errors.paymentMethod = 'Please select a valid booking charge payment method.'
    }
  }
  if (!waiveBookingCharge && payload.paymentMethod && payload.paymentMethod !== 'CASH') {
    if (requireTransactionRef && !txRef) errors.transactionRef = 'Transaction reference is required for digital booking charge payments.'
    else if (txRef && !/^[A-Za-z0-9._\-/#]{4,40}$/.test(txRef)) {
      errors.transactionRef = 'Use 4-40 characters: letters, numbers, and . _ - / # only.'
    }
  } else if (!waiveBookingCharge && txRef && !/^[A-Za-z0-9._\-/#]{4,40}$/.test(txRef)) {
    errors.transactionRef = 'Use 4-40 characters: letters, numbers, and . _ - / # only.'
  }
  if (!waiveBookingCharge && !allowCash && payload.paymentMethod === 'CASH') errors.paymentMethod = 'Customers must use a digital booking charge payment method.'

  if (notes) {
    if (notes.length > 300) errors.notes = 'Special instructions cannot exceed 300 characters.'
    else if (/^\d+$/.test(notes)) errors.notes = 'Special instructions must contain text, not numbers only.'
    else if (!/^[a-zA-Z0-9\s.,!?'\-\/():]+$/.test(notes)) {
      errors.notes = 'Special instructions can only contain letters, numbers, spaces, and basic punctuation.'
    }
  }

  return errors
}

import { EMAIL_RE, PHONE_RE, NAME_RE, PASSWORD_RE } from './validationPatterns'

export function validateLoginForm(form = {}) {
  const errors = {}
  const email = (form.email || '').trim()
  const password = form.password || ''

  if (!email) errors.email = 'Email address cannot be empty.'
  else if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.'

  if (!password) errors.password = 'Password cannot be empty.'
  else if (password.length < 8) errors.password = 'Password must be at least 8 characters.'

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
    normalized: { ...form, email },
  }
}

export function validateRegisterForm(form = {}) {
  const errors = {}
  const fullName = (form.fullName || '').trim()
  const email = (form.email || '').trim()
  const phone = String(form.phone || '').replace(/\D/g, '')
  const password = form.password || ''

  if (!fullName) errors.fullName = 'Full name cannot be empty.'
  else if (fullName.length < 2) errors.fullName = 'Name must be at least 2 characters.'
  else if (!NAME_RE.test(fullName)) errors.fullName = 'Name can only contain letters, spaces, hyphens, apostrophes, and dots.'

  if (!email) errors.email = 'Email address cannot be empty.'
  else if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.'

  if (phone && !PHONE_RE.test(phone)) errors.phone = 'Enter a valid 10-digit Indian mobile number.'

  if (!password) errors.password = 'Password cannot be empty.'
  else if (!PASSWORD_RE.test(password)) errors.password = 'Password must include uppercase, lowercase, digit, and special character.'

  return { errors, isValid: Object.keys(errors).length === 0, normalized: { ...form, phone } }
}

export function validateAdvisorQuantity(quantity, itemType) {
  if (itemType === 'LABOR' && Number(quantity) !== 1) return 'Labor items use a fixed quantity of 1.'
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return 'Quantity must be a whole number between 1 and 99.'
  return ''
}

export function validateAdvisorRemarks(remarks, limit = 300) {
  return (remarks || '').trim().length > limit ? `Remarks must be ${limit} characters or fewer.` : ''
}

export function validateAdvisorCompletion({ selectedRecord, bom = [], actualHours, remarks }) {
  const errors = {}
  const parsedHours = Number(actualHours)
  if (!selectedRecord) errors.selectedRecord = 'Please select a service record.'
  if (!bom.length) errors.bom = 'Add BOM items before completing the service.'
  if (!Number.isFinite(parsedHours) || parsedHours < 0.1 || parsedHours > 24) errors.actualHours = 'Actual hours must be between 0.1 and 24.'
  const remarksError = validateAdvisorRemarks(remarks)
  if (remarksError) errors.remarks = remarksError
  return { errors, isValid: Object.keys(errors).length === 0 }
}

export function validateContactForm(form = {}) {
  const errors = {}
  const fullName = (form.fullName || '').trim()
  const email = (form.email || '').trim()
  const phone = String(form.phone || '').replace(/\D/g, '')
  const subject = (form.subject || '').trim()
  const message = (form.message || '').trim()

  if (!fullName) errors.fullName = 'Full name is required.'
  else if (fullName.length < 2) errors.fullName = 'Name must be at least 2 characters.'
  else if (!NAME_RE.test(fullName)) errors.fullName = 'Name can only contain letters, spaces, hyphens, apostrophes, and dots.'

  if (!email) errors.email = 'Email address is required.'
  else if (!EMAIL_RE.test(email)) errors.email = 'Please enter a valid email address (e.g., name@gmail.com'

  if (phone && !PHONE_RE.test(phone)) errors.phone = 'Enter a valid 10-digit phone number.'
  if (!subject) errors.subject = 'Please select a subject.'
  if (!message) errors.message = 'Message cannot be empty.'
  else if (message.length < 10) errors.message = 'Message must be at least 10 characters.'
  else if (message.length > 1000) errors.message = 'Message cannot exceed 1000 characters.'

  return { errors, isValid: Object.keys(errors).length === 0, normalized: { ...form, phone } }
}

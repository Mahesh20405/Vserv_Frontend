export const ACCESS_TOKEN_KEY = 'vserv.accessToken'
export const REFRESH_TOKEN_KEY = 'vserv.refreshToken'
export const USER_STORAGE_KEY = 'vserv.authUser'

export const ROLES = {
  ADMIN: 'ADMIN',
  ADVISOR: 'ADVISOR',
  CUSTOMER: 'CUSTOMER',
}

export const USER_STATUSES = ['ACTIVE', 'INACTIVE']

export const ROLE_HOMES = {
  ADMIN: '/admin/dashboard',
  ADVISOR: '/advisor/dashboard',
  CUSTOMER: '/customer/dashboard',
}

export const BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'CANCELLED', 'RESCHEDULED', 'COMPLETED']

export const PAYMENT_STATUSES = ['PENDING', 'PAID', 'PARTIALLY_PAID']

export const PAYMENT_METHODS = ['UPI', 'CARD', 'NET_BANKING', 'CASH']

export const CAR_TYPES = ['SEDAN', 'SUV', 'HATCHBACK', 'COUPE', 'CONVERTIBLE', 'WAGON', 'MINIVAN']

export const SERVICE_TYPES = ['SERVICING', 'REPAIR', 'INSPECTION', 'MAINTENANCE']

export const TIME_SLOTS = [
  '09:00-11:00',
  '11:00-13:00',
  '13:00-15:00',
  '15:00-17:00',
  '17:00-19:00',
]

export const ADVISOR_STATUSES = ['AVAILABLE', 'ASSIGNED', 'ON_LEAVE', 'RESIGNED']

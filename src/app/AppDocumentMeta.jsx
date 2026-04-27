import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const TITLE_SUFFIX = 'VServ'
const ROUTE_TITLES = [
  ['/', 'Home'],
  ['/services', 'Services'],
  ['/about', 'About'],
  ['/contact', 'Contact'],
  ['/404', 'Page Not Found'],
  ['/login', 'Login'],
  ['/register', 'Register'],
  ['/forgot-password', 'Forgot Password'],
  ['/admin/dashboard', 'Admin Dashboard'],
  ['/admin/users', 'User Management'],
  ['/admin/vehicles', 'Vehicle Management'],
  ['/admin/bookings', 'Bookings Management'],
  ['/admin/overdue-bookings', 'Requires Action'],
  ['/admin/advisors', 'Service Advisors'],
  ['/admin/catalog', 'Service Catalog'],
  ['/admin/work-items', 'Work Items'],
  ['/admin/availability', 'Availability'],
  ['/admin/invoices', 'Invoices'],
  ['/admin/audit-logs', 'Audit Logs'],
  ['/admin/book-service', 'Book Service'],
  ['/admin/profile', 'Admin Profile'],
  ['/advisor/dashboard', 'Advisor Dashboard'],
  ['/advisor/manage-service', 'Manage Service'],
  ['/advisor/complete-service', 'Complete Service'],
  ['/advisor/profile', 'Advisor Profile'],
  ['/customer/dashboard', 'Customer Dashboard'],
  ['/customer/book-service', 'Book Service'],
  ['/customer/bookings', 'My Bookings'],
  ['/customer/vehicles', 'My Vehicles'],
  ['/customer/invoices', 'My Invoices'],
  ['/customer/notifications', 'Notifications'],
  ['/customer/profile', 'My Profile'],
]

function resolveTitle(pathname, search) {
  if (pathname === '/customer/payment') {
    const purpose = new URLSearchParams(search).get('purpose')
    return purpose === 'invoice' ? 'Invoice Payment' : 'Booking Charge Payment'
  }

  if (pathname.startsWith('/advisor/service-details/')) {
    return 'Service Details'
  }

  return ROUTE_TITLES.find(([route]) => route === pathname)?.[1] || null
}

export function AppDocumentMeta() {
  const location = useLocation()

  useEffect(() => {
    const pageTitle = resolveTitle(location.pathname, location.search)
    document.title = pageTitle ? `${pageTitle} - ${TITLE_SUFFIX}` : TITLE_SUFFIX
  }, [location.pathname, location.search])

  return null
}

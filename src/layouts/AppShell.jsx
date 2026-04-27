import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/hooks/useAuth'
import { authService } from '../features/auth/services/authService'
import { clearTokens, getAccessToken, toUser } from '../lib/axios'
import { ROLE_HOMES } from '../config/constants'
import { Topbar } from './Topbar'
import { AppFooter } from './AppFooter'
import { TooltipBootstrap } from '../components/ui/TooltipBootstrap'
import { setUser, clearUser, setLoading } from '../features/auth/slices/authSlice'
import { useDispatch, useSelector } from 'react-redux'


// Lazy-load role-scoped reference CSS so no user pays for another role's styles
const ROLE_CSS = {
  ADMIN:    () => import('../styles/admin-reference.css'),
  ADVISOR:  () => import('../styles/advisor-reference.css'),
  CUSTOMER: () => import('../styles/customer-reference.css'),
}
// Public reference CSS is loaded for unauthenticated layouts
import('../styles/public-reference.css')

const ADMIN_LINKS = [
  { key: 'dashboard',    label: 'Dashboard',   href: '/admin/dashboard' },
  { key: 'users',        label: 'Users',        href: '/admin/users' },
  { key: 'bookings',     label: 'Bookings',     href: '/admin/bookings' },
  { key: 'vehicles',     label: 'Vehicles',     href: '/admin/vehicles' },
  { key: 'availability', label: 'Availability', href: '/admin/availability' },
  { key: 'invoices',     label: 'Invoices',     href: '/admin/invoices' },
]

const ADMIN_SYSTEM_LINKS = [
  { key: 'catalog',     label: 'Service Catalog', href: '/admin/catalog' },
  { key: 'work-items',  label: 'Work Items',       href: '/admin/work-items' },
  { key: 'advisors',    label: 'Advisors',         href: '/admin/advisors' },
  { key: 'audit',       label: 'Audit Logs',       href: '/admin/audit-logs' },
]

const CUSTOMER_LINKS = [
  { key: 'dashboard', label: 'Dashboard',   href: '/customer/dashboard' },
  { key: 'vehicles',  label: 'My Vehicles', href: '/customer/vehicles' },
  { key: 'bookings',  label: 'Bookings',    href: '/customer/bookings' },
  { key: 'invoices',  label: 'Invoices',    href: '/customer/invoices' },
]

const ADVISOR_LINKS = [
  { key: 'dashboard', label: 'Dashboard',   href: '/advisor/dashboard' },
  { key: 'services',  label: 'My Services', href: '/advisor/manage-service' },
  { key: 'complete',  label: 'Complete',    href: '/advisor/complete-service' },
]

function labelFor(segment = '') {
  return segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function AppBreadcrumbs() {
  const location = useLocation()
  const parts = location.pathname.split('/').filter(Boolean)
  if (parts.length <= 1) return null

  const crumbs = [{ label: 'Home', href: '/' }]
  let href = ''

  parts.forEach((part, index) => {
    if (/^\d+$/.test(part)) return
    href += `/${part}`
    if (index === parts.length - 1) crumbs.push({ label: labelFor(part) })
    else crumbs.push({ label: labelFor(part), href })
  })

  return (
    <div className="container-fluid px-4 py-2">
      <nav aria-label="Breadcrumb">
        <ol className="breadcrumb mb-0 text-xs">
          {crumbs.map((crumb, index) => (
            <li
              key={`${crumb.label}-${index}`}
              className={`breadcrumb-item${index === crumbs.length - 1 ? ' active' : ''}`}
              aria-current={index === crumbs.length - 1 ? 'page' : undefined}
            >
              {crumb.href && index !== crumbs.length - 1
                ? <Link to={crumb.href}>{crumb.label}</Link>
                : crumb.label}
            </li>
          ))}
        </ol>
      </nav>
    </div>
  )
}

export function SessionBootstrap() {
  const dispatch = useDispatch()
  const userRole = useSelector((state) => state.auth.user?.role)

  // Lazy-load role-scoped CSS once the user's role is known
  useEffect(() => {
    if (userRole && ROLE_CSS[userRole]) {
      ROLE_CSS[userRole]()
    }
  }, [userRole])


  useEffect(() => {
    if (!getAccessToken()) {
      dispatch(setLoading(false))
      dispatch(clearUser())
      return
    }
    dispatch(setLoading(true))
    authService.me()
      .then((response) => dispatch(setUser(toUser(response.data))))
      .catch(() => {
        clearTokens()
        dispatch(clearUser())
      })
  }, [])

  return null
}

export function AdminLayout({ children, activeKey }) {
  useEffect(() => {
    document.body.classList.add('has-user-navbar-offset')
    return () => document.body.classList.remove('has-user-navbar-offset')
  }, [])

  return (
    <>
      <TooltipBootstrap />
      <Topbar
        links={ADMIN_LINKS}
        dropdownLinks={ADMIN_SYSTEM_LINKS}
        activeKey={activeKey}
        profilePath="/admin/profile"
        roleBadge="ADMIN"
        userLabel="Admin"
        wide
      />
      <AppBreadcrumbs />
      <main>{children}</main>
      <AppFooter />
    </>
  )
}

export function CustomerLayout({ children, activeKey }) {
  useEffect(() => {
    document.body.classList.add('has-user-navbar-offset')
    return () => document.body.classList.remove('has-user-navbar-offset')
  }, [])

  return (
    <>
      <TooltipBootstrap />
      <Topbar
        links={CUSTOMER_LINKS}
        activeKey={activeKey}
        notifPath="/customer/notifications"
        profilePath="/customer/profile"
        showNotifications
        userLabel="Customer"
      />
      <AppBreadcrumbs />
      <main>{children}</main>
      <AppFooter />
    </>
  )
}

export function AdvisorLayout({ children, activeKey }) {
  useEffect(() => {
    document.body.classList.add('has-user-navbar-offset')
    return () => document.body.classList.remove('has-user-navbar-offset')
  }, [])

  return (
    <>
      <TooltipBootstrap />
      <Topbar links={ADVISOR_LINKS} activeKey={activeKey} profilePath="/advisor/profile" userLabel="Advisor" wide />
      <AppBreadcrumbs />
      <main>{children}</main>
      <AppFooter />
    </>
  )
}

export function PublicLayout({ children }) {
  const location = useLocation()
  useEffect(() => {
    document.body.classList.add('has-user-navbar-offset')
    return () => document.body.classList.remove('has-user-navbar-offset')
  }, [])

  const { user, loading } = useAuth()

  const dashboardPath = ROLE_HOMES[user?.role] || '/login'
  const profilePath = user?.role ? `/${user.role.toLowerCase()}/profile` : ''

  return (
    <>
      <TooltipBootstrap />
      <Topbar
        links={[
          { key: 'services', label: 'Services', href: '/services' },
          { key: 'about', label: 'About', href: '/about' },
          { key: 'contact', label: 'Contact', href: '/contact' },
        ]}
        activeKey={location.pathname.split('/').filter(Boolean)[0] || ''}
        profilePath={profilePath}
        userLabel="Guest"
        authMode="buttons"
        dashboardPath={!loading && user ? dashboardPath : ''}
        loginPath="/login"
        registerPath="/register"
        navId="pubNav"
      />
      <AppBreadcrumbs />
      <main>{children}</main>
      <AppFooter />
    </>
  )
}

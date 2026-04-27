import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/hooks/useAuth'
import { authService } from '../features/auth/services/authService'
import { useNotifications } from '../features/notifications/hooks/useNotifications'
import { NotifBadge } from '../features/notifications/components/NotifBadge'
import { clearTokens, getRefreshToken } from '../lib/axios'
import { confirmNavigation } from '../hooks/useNavigationGuard'

export function Topbar({
  links = [],
  dropdownLinks = [],
  activeKey = '',
  notifPath = '/customer/notifications',
  profilePath = '',
  roleBadge = '',
  userLabel = 'User',
  showNotifications = false,
  wide = false,
  authMode = 'menu',
  dashboardPath = '',
  loginPath = '/login',
  registerPath = '/register',
  navId = 'topNav',
}) {
  const { user, clearUser } = useAuth()
  const nav = useNavigate()
  const { unreadCount } = useNotifications()
  const systemActive = dropdownLinks.some((link) => link.key === activeKey)

  async function logout() {
    if (!confirmNavigation()) return
    try { await authService.logout({ refreshToken: getRefreshToken() }) } catch (err) { if (import.meta.env.DEV) console.warn('[logout]', err) }
    clearTokens()
    clearUser()
    nav('/login')
  }

  return (
    <nav className="navbar navbar-expand-lg fixed-top bg-white border-bottom vserv-user-navbar">
      <div className={wide ? 'container-fluid px-4' : 'container'}>
        <Link className="navbar-brand" to="/">
          V<span>Serv</span>
          {roleBadge && <span className="badge bg-secondary ms-2 role-chip">{roleBadge}</span>}
        </Link>

        <button
          className="navbar-toggler border-0"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target={`#${navId}`}
          aria-label="Toggle navigation"
          title="Toggle navigation"
        >
          <span className="navbar-toggler-icon" />
        </button>

        <div className="collapse navbar-collapse" id={navId}>
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            {links.map((link) => (
              <li key={link.key} className="nav-item">
                <Link className={`nav-link${activeKey === link.key ? ' active' : ''}`} to={link.href}>
                  {link.label}
                </Link>
              </li>
            ))}

            {!!dropdownLinks.length && (
              <li className="nav-item dropdown admin-system-dropdown">
                <a
                  className={`nav-link dropdown-toggle${systemActive ? ' active' : ''}`}
                  href="#"
                  data-bs-toggle="dropdown"
                  onClick={(e) => e.preventDefault()}
                >
                  System
                </a>
                <ul className="dropdown-menu">
                  {dropdownLinks.map((link) => (
                    <li key={link.key}>
                      <Link className={`dropdown-item${activeKey === link.key ? ' active' : ''}`} to={link.href}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            )}
          </ul>

          <div className="d-flex align-items-center gap-3">
            {user ? (
              <>
                {showNotifications && (
                  <Link
                    to={notifPath}
                    className="nav-link position-relative customer-notif-link"
                    aria-label="Notifications"
                    title="Notifications"
                    data-bs-toggle="tooltip"
                    data-bs-placement="bottom"
                  >
                    <svg className="customer-notif-icon" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                    <NotifBadge count={unreadCount} />
                  </Link>
                )}

                {authMode === 'buttons' ? (
                  <>
                    {dashboardPath ? <Link className="btn btn-sm btn-outline-secondary" to={dashboardPath}>Dashboard</Link> : null}
                    {profilePath ? <Link className="btn btn-sm btn-outline-secondary" to={profilePath}>Profile</Link> : null}
                    <button className="btn btn-sm btn-outline-secondary" onClick={logout}>Logout</button>
                  </>
                ) : (
                  <div className="dropdown">
                    <button className="btn btn-sm btn-outline dropdown-toggle" data-bs-toggle="dropdown">
                      {user?.fullName?.split(' ')[0] || userLabel}
                    </button>
                    <ul className="dropdown-menu dropdown-menu-end">
                      <li><span className="dropdown-item-text text-muted" style={{ fontSize: '0.75rem' }}>{user?.email}</span></li>
                      {profilePath && (
                        <>
                          <li><hr className="dropdown-divider" /></li>
                          <li>
                            <Link className={`dropdown-item${activeKey === 'profile' ? ' active' : ''}`} to={profilePath}>
                              Profile
                            </Link>
                          </li>
                        </>
                      )}
                      <li><hr className="dropdown-divider" /></li>
                      <li><button className="dropdown-item text-danger" onClick={logout}>Logout</button></li>
                    </ul>
                  </div>
                )}
              </>
            ) : authMode === 'buttons' ? (
              <div className="d-flex gap-2">
                <Link className="btn btn-sm btn-outline-secondary" to={loginPath}>Login</Link>
                <Link className="btn btn-sm btn-accent" to={registerPath}>Register</Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  )
}



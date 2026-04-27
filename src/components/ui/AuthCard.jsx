import { Link } from 'react-router-dom'

export function AuthCard({
  subtitle,
  error,
  maxWidth,
  children,
  footer,
  backTo = '/',
  backLabel = 'Back to Landing Page',
}) {
  return (
    <div className="auth-wrapper">
      <div className="auth-card" style={maxWidth ? { maxWidth } : undefined}>
        <div className="text-center mb-4">
          <div className="auth-logo">V<span>Serv</span></div>
          {subtitle ? <p className="text-muted mt-1" style={{ fontSize: '0.85rem' }}>{subtitle}</p> : null}
        </div>
        {error ? <div className="alert alert-danger py-2 px-3 mb-3 label-sm">{error}</div> : null}
        {children}
        {footer}
        <div className="text-center mt-3 label-sm">
          <Link to={backTo} className="text-muted">{backLabel}</Link>
        </div>
      </div>
    </div>
  )
}

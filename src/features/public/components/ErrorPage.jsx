import { Link } from 'react-router-dom'
import { PublicLayout } from '../../../layouts/AppShell'
import '../../../styles/features/public/ErrorPage.css'

export function ErrorPage() {
  return (
    <PublicLayout>
      <section className="system-error-page">
        <div className="system-error-panel">
          <div className="system-error-inner">
            <div className="system-error-chip">Page Not Found</div>
            <div className="system-error-code">404</div>
            <h1 className="system-error-title">We could not find that page</h1>
            <p className="system-error-message">
              The link may be incorrect, the page may have moved, or the content may no longer be available.
            </p>

            <div className="system-error-actions">
              <Link to="/" className="btn btn-primary btn-lg">
                Back To Home
              </Link>
              <button type="button" className="btn btn-outline-secondary btn-lg" onClick={() => window.history.back()}>
                Go Back
              </button>
            </div>

            <div className="system-error-meta">
              <div className="system-error-meta-item">
                <div className="system-error-meta-label">Status</div>
                <div className="system-error-meta-value">404</div>
              </div>
              <div className="system-error-meta-item">
                <div className="system-error-meta-label">System</div>
                <div className="system-error-meta-value">VServ</div>
              </div>
              <div className="system-error-meta-item">
                <div className="system-error-meta-label">Route Type</div>
                <div className="system-error-meta-value">Client Page</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}

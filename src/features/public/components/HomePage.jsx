import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PublicLayout } from '../../../layouts/AppShell'
import { useAuth } from '../../auth/hooks/useAuth'
import { formatCurrency, SERVICE_ICONS } from '../../../utils/formatters'
import { catalogService } from '../../catalog/services/catalogService'
import { ROLE_HOMES } from '../../../config/constants'

const HERO_STATS = [
  ['2000+', 'Happy Customers'],
  ['150+', 'Partner Centers'],
  ['50K+', 'Services Completed'],
]

const FEATURES = [
  ['Booking', 'Smart Booking', 'Real-time slot visibility and fast confirmation from one shared workflow.'],
  ['Vehicles', 'Vehicle Management', 'Keep customer, vehicle, service, and history data in one reliable system.'],
  ['Payments', 'Integrated Payments', 'Transparent invoicing and cleaner completion-to-billing handoff.'],
]

const STEPS = [
  ['1', 'Create Account', 'Sign up and set up your profile in minutes.'],
  ['2', 'Book Service', 'Choose a service, vehicle, and available time slot.'],
  ['3', 'Track Progress', 'Follow service updates through completion and billing.'],
]

export function HomePage() {
  const { user, loading } = useAuth()
  const [services, setServices] = useState([])

  useEffect(() => {
    catalogService.list({ activeOnly: true }).then((response) => {
      setServices((response.data || []).slice(0, 6))
    }).catch(() => {})
  }, [])

  const dashboardPath = useMemo(() => ROLE_HOMES[user?.role] || '/login', [user])

  return (
    <PublicLayout>
      <section className="public-hero">
        <div className="container">
          <div className="row align-items-center g-4">
            <div className="col-lg-7">
              <h1 className="display-4 fw-bold mb-3">Manage Vehicle Services With Ease</h1>
              <p className="lead mb-4" style={{ maxWidth: 640, opacity: 0.92 }}>
                Complete platform for service centers, advisors, and customers to streamline vehicle maintenance, bookings, and service tracking.
              </p>
              <div className="d-flex gap-3 flex-wrap">
                <Link to={loading || user ? dashboardPath : '/register'} className="btn btn-primary btn-lg">
                  {user ? 'Go to Dashboard' : 'Start Free Trial'}
                </Link>
                <Link to={user ? '/services' : '#how-it-works'} className="btn btn-outline-light btn-lg">
                  {user ? 'Browse Services' : 'Learn More'}
                </Link>
              </div>
            </div>
            <div className="col-lg-5">
              <div className="row g-3">
                {HERO_STATS.map(([value, label]) => (
                  <div key={label} className="col-12">
                    <div className="public-hero-stat">
                      <div style={{ fontSize: '2rem', fontWeight: 800 }}>{value}</div>
                      <div>{label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-5">
        <div className="text-center mb-5">
          <h2 className="fw-bold">Everything You Need</h2>
          <p className="text-muted">Comprehensive features for service management.</p>
        </div>
        <div className="row g-4">
          {FEATURES.map(([mark, title, desc], index) => (
            <div key={title} className="col-md-4">
              <div className="public-feature-card text-center">
                <div className="public-icon-slab mx-auto" style={{ background: ['#f97316', '#0f766e', '#2563eb'][index] }}>{mark}</div>
                <h5 className="fw-bold">{title}</h5>
                <p className="text-muted mb-0">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-5 bg-light" id="how-it-works">
        <div className="container">
          <div className="text-center mb-5">
            <h2 className="fw-bold">How VServ Works</h2>
            <p className="text-muted">Get started in three simple steps.</p>
          </div>
          <div className="row g-4">
            {STEPS.map(([mark, title, desc]) => (
              <div key={title} className="col-md-4 text-center">
                <div className="public-icon-slab mx-auto" style={{ background: '#f97316', width: 60, height: 60, borderRadius: '50%' }}>{mark}</div>
                <h5 className="fw-bold">{title}</h5>
                <p className="text-muted mb-0">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {services.length ? (
        <section className="container py-5">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
            <div>
              <h2 className="fw-bold mb-1">Featured Services</h2>
              <p className="text-muted mb-0">A snapshot of active catalog services available for booking.</p>
            </div>
            <Link to="/services" className="section-link">Browse All</Link>
          </div>
          <div className="row g-4">
            {services.map((service) => (
              <div key={service.catalogId} className="col-md-6 col-lg-4">
                <div className="public-service-card d-flex flex-column">
                  <div style={{ fontSize: '1.9rem', marginBottom: '0.5rem' }}>{SERVICE_ICONS[service.serviceType] || SERVICE_ICONS.default}</div>
                  <div className="fw-bold mb-1">{service.serviceName}</div>
                  <div className="text-muted small mb-2">{service.serviceType} · {service.carType}</div>
                  <p className="text-muted small flex-grow-1 mb-3">{service.description || 'Professional service delivered through the VServ workflow.'}</p>
                  <div className="d-flex justify-content-between align-items-center">
                    <strong style={{ color: 'var(--primary-accent)' }}>{formatCurrency(service.basePrice)}</strong>
                    <Link to={user ? '/customer/book-service' : '/register'} className="btn btn-sm btn-primary">{user ? 'Book' : 'Sign Up'}</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="container pb-5">
        <div className="public-cta-band text-center">
          <h2 className="fw-bold text-white mb-2">Ready To Transform Your Service Workflow?</h2>
          <p className="mb-4">Join hundreds of teams and customers using VServ.</p>
          <div className="d-flex gap-3 justify-content-center flex-wrap">
            <Link to={user ? dashboardPath : '/register'} className="btn btn-light btn-lg">{user ? 'Open Dashboard' : 'Start Free Trial'}</Link>
            <Link to="/services" className="btn btn-outline-light btn-lg">Browse Services</Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}



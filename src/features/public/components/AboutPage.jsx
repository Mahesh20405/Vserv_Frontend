import { Link } from 'react-router-dom'
import { PublicLayout } from '../../../layouts/AppShell'
import { useAuth } from '../../auth/hooks/useAuth'

const MISSION_ITEMS = [
  { title: 'Our Vision', desc: 'To become the most trusted vehicle service operating system for service centers, advisors, and customers.', color: '#f97316', mark: 'Vision' },
  { title: 'Our Values', desc: 'Transparency, reliability, and customer-first communication shape every booking and service update.', color: '#0f766e', mark: 'Values' },
  { title: 'Our Goal', desc: 'We remove friction from vehicle maintenance with smarter booking, better tracking, and cleaner service workflows.', color: '#2563eb', mark: 'Goal' },
]

const STATS = [
  ['2000+', 'Happy Customers'],
  ['150+', 'Partner Centers'],
  ['50K+', 'Services Completed'],
  ['98%', 'Customer Satisfaction'],
]

const STORY = [
  ['2024', 'The Beginning', 'VServ started with a simple goal: make service booking feel as dependable as the workshop itself.'],
  ['2025', 'Scale Up', 'The platform expanded across customers, service advisors, and admin operations with one shared workflow.'],
  ['2026', 'Operational Depth', 'We now focus on service visibility, cleaner billing, and higher trust between customers and centers.'],
]

const TEAM = [
  ['MR', 'Mahesh R', 'Founder & CEO', '#f97316'],
  ['KT', 'Kavin T', 'CTO', '#0f766e'],
  ['GH', 'Guhan', 'COO', '#2563eb'],
]

export function AboutPage() {
  const { user } = useAuth()
  const primaryCta = user
    ? user.role === 'ADMIN'
      ? '/admin/dashboard'
      : user.role === 'ADVISOR'
        ? '/advisor/dashboard'
        : '/customer/dashboard'
    : '/register'

  return (
    <PublicLayout>
      <section className="public-hero text-center">
        <div className="container">
          <h1 className="display-4 fw-bold mb-3">About VServ</h1>
          <p className="lead mb-0" style={{ maxWidth: 680, margin: '0 auto', opacity: 0.9 }}>
            Transforming vehicle service management with technology, transparency, and trust.
          </p>
        </div>
      </section>

      <section className="container py-5">
        <div className="text-center mb-4">
          <h2 className="fw-bold">Our Mission</h2>
          <p className="text-muted mx-auto" style={{ maxWidth: 620 }}>
            We are simplifying vehicle service management while giving customers and service centers a clearer operational experience.
          </p>
        </div>
        <div className="row g-4">
          {MISSION_ITEMS.map((item) => (
            <div key={item.title} className="col-md-4">
              <div className="public-feature-card text-center">
                <div className="public-icon-slab mx-auto" style={{ background: item.color }}>{item.mark}</div>
                <h5 className="fw-bold">{item.title}</h5>
                <p className="text-muted mb-0">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-5" style={{ background: 'linear-gradient(135deg,#f97316 0%,#d97706 100%)', color: '#fff' }}>
        <div className="container text-center">
          <h2 className="fw-bold text-white mb-4">VServ In Numbers</h2>
          <div className="row g-4">
            {STATS.map(([value, label]) => (
              <div key={label} className="col-6 col-md-3">
                <div style={{ fontSize: '2.4rem', fontWeight: 800 }}>{value}</div>
                <div>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-5">
        <div className="text-center mb-4">
          <h2 className="fw-bold">Our Story</h2>
          <p className="text-muted">How we started and where the product is headed next.</p>
        </div>
        <div className="row g-4">
          {STORY.map(([year, title, desc], index) => (
            <div key={year} className="col-md-4">
              <div className="public-story-card text-center">
                <div className="public-icon-slab mx-auto" style={{ background: '#f97316' }}>{index + 1}</div>
                <h5 className="fw-bold" style={{ color: '#f97316' }}>{year} · {title}</h5>
                <p className="text-muted mb-0">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container py-5">
        <div className="text-center mb-4">
          <h2 className="fw-bold">Meet Our Team</h2>
          <p className="text-muted">The people building better service operations behind the scenes.</p>
        </div>
        <div className="row g-4 justify-content-center">
          {TEAM.map(([mark, name, role, color]) => (
            <div key={name} className="col-md-6 col-lg-4">
              <div className="public-feature-card text-center">
                <div className="public-icon-slab mx-auto" style={{ background: color, width: 72, height: 72, borderRadius: '50%' }}>{mark}</div>
                <h5 className="fw-bold mb-1">{name}</h5>
                <div className="text-muted small mb-2">{role}</div>
                <p className="text-muted mb-0">Focused on operational clarity, customer trust, and platform quality.</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container pb-5">
        <div className="public-cta-band text-center">
          <h2 className="fw-bold text-white mb-2">Join Us On The Journey</h2>
          <p className="mb-4">Whether you manage operations or just need dependable vehicle service, VServ is built to help.</p>
          <div className="d-flex gap-3 justify-content-center flex-wrap">
            <Link to={primaryCta} className="btn btn-light btn-lg">{user ? 'Go to Dashboard' : 'Get Started'}</Link>
            <Link to="/contact" className="btn btn-outline-light btn-lg">Contact Us</Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}



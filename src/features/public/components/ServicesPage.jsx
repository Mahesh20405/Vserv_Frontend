import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PublicLayout } from '../../../layouts/AppShell'
import { PageSpinner } from '../../../components/ui/Spinner'
import { useAuth } from '../../auth/hooks/useAuth'
import { formatCurrency, SERVICE_ICONS } from '../../../utils/formatters'
import { catalogService } from '../../catalog/services/catalogService'

export function ServicesPage() {
  const { user } = useAuth()
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [view, setView] = useState('grid')

  useEffect(() => {
    catalogService.list({ activeOnly: true })
      .then((response) => setServices(response.data || []))
      .finally(() => setLoading(false))
  }, [])

  const types = useMemo(() => ['All Services', ...new Set(services.map((service) => service.serviceType).filter(Boolean))], [services])

  const visible = useMemo(() => {
    const filtered = services.filter((service) => {
      if (typeFilter && typeFilter !== 'All Services' && service.serviceType !== typeFilter) return false
      if (!search.trim()) return true
      const haystack = [service.serviceName, service.description, service.serviceType, service.carType].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(search.trim().toLowerCase())
    })

    filtered.sort((left, right) => {
      if (sortBy === 'price-low') return Number(left.basePrice || 0) - Number(right.basePrice || 0)
      if (sortBy === 'price-high') return Number(right.basePrice || 0) - Number(left.basePrice || 0)
      if (sortBy === 'duration') return Number(left.durationHours || 0) - Number(right.durationHours || 0)
      if (sortBy === 'duration-long') return Number(right.durationHours || 0) - Number(left.durationHours || 0)
      if (sortBy === 'name-desc') return (right.serviceName || '').localeCompare(left.serviceName || '')
      return (left.serviceName || '').localeCompare(right.serviceName || '')
    })

    return filtered
  }, [services, typeFilter, search, sortBy])

  return (
    <PublicLayout>
      <section className="public-hero text-center">
        <div className="container">
          <h1 className="display-4 fw-bold mb-3">Browse Our Services</h1>
          <p className="lead mb-0" style={{ maxWidth: 700, margin: '0 auto', opacity: 0.9 }}>
            Professional vehicle maintenance and repair services for a wide range of vehicle types.
          </p>
        </div>
      </section>

      <section className="container py-4">
        <div className="public-filter-bar mb-4">
          <div className="row g-3 align-items-center">
            <div className="col-lg-5">
              <input className="form-control" placeholder="Search services..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="col-lg-4">
              <div className="public-chip-row">
                {types.map((type) => (
                  <button key={type} type="button" className={`btn public-chip-btn ${(!typeFilter && type === 'All Services') || typeFilter === type ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setTypeFilter(type === 'All Services' ? '' : type)}>
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div className="col-lg-3">
              <div className="d-flex gap-2">
                <select className="form-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="name">Name (A-Z)</option>
                  <option value="name-desc">Name (Z-A)</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="duration">Duration (Shortest)</option>
                  <option value="duration-long">Duration (Longest)</option>
                </select>
                <button type="button" className={`btn ${view === 'grid' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setView('grid')}>Grid</button>
                <button type="button" className={`btn ${view === 'list' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setView('list')}>List</button>
              </div>
            </div>
          </div>
        </div>

        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
          <div className="public-results-meta">Showing {visible.length} of {services.length} services</div>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setTypeFilter(''); setSearch(''); setSortBy('name') }}>Reset Filters</button>
        </div>

        {loading ? <PageSpinner /> : view === 'grid' ? (
          <div className="row g-4">
            {visible.map((service) => (
              <div key={service.catalogId} className="col-md-6 col-lg-4">
                <div className="public-service-card d-flex flex-column">
                  <div style={{ fontSize: '1.9rem', marginBottom: '0.5rem' }}>{SERVICE_ICONS[service.serviceType] || SERVICE_ICONS.default}</div>
                  <div className="fw-bold mb-1">{service.serviceName}</div>
                  <div className="text-muted small mb-2">{service.serviceType} · {service.carType} · {service.durationHours ? `${service.durationHours}h` : 'Variable'}</div>
                  <p className="text-muted small flex-grow-1 mb-3">{service.description || 'Professional maintenance and repair service delivered through the VServ workflow.'}</p>
                  <div className="d-flex justify-content-between align-items-center">
                    <strong style={{ color: 'var(--primary-accent)' }}>{formatCurrency(service.basePrice)}</strong>
                    <Link to={user ? '/customer/book-service' : '/register'} className="btn btn-sm btn-primary">{user ? 'Book Now' : 'Sign Up To Book'}</Link>
                  </div>
                </div>
              </div>
            ))}
            {!visible.length ? <div className="col-12"><div className="empty-state"><div className="empty-state-icon">Search</div><p>No services found. Try adjusting your search or filters.</p></div></div> : null}
          </div>
        ) : (
          <div className="d-flex flex-column gap-3">
            {visible.map((service) => (
              <div key={service.catalogId} className="public-service-card">
                <div className="row g-3 align-items-center">
                  <div className="col-md-6">
                    <div className="d-flex gap-3">
                      <div style={{ fontSize: '1.9rem' }}>{SERVICE_ICONS[service.serviceType] || SERVICE_ICONS.default}</div>
                      <div>
                        <div className="fw-bold">{service.serviceName}</div>
                        <div className="text-muted small mb-2">{service.serviceType} · {service.carType}</div>
                        <div className="text-muted small">{service.description || 'Professional service delivered through the VServ workflow.'}</div>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="advisor-mini-label">Duration</div>
                    <div className="advisor-mini-value">{service.durationHours ? `${service.durationHours}h` : 'Variable'}</div>
                  </div>
                  <div className="col-md-3 text-md-end">
                    <div className="fw-bold mb-2" style={{ color: 'var(--primary-accent)' }}>{formatCurrency(service.basePrice)}</div>
                    <Link to={user ? '/customer/book-service' : '/register'} className="btn btn-sm btn-primary">{user ? 'Book Now' : 'Sign Up To Book'}</Link>
                  </div>
                </div>
              </div>
            ))}
            {!visible.length ? <div className="empty-state"><div className="empty-state-icon">Search</div><p>No services found. Try adjusting your search or filters.</p></div> : null}
          </div>
        )}
      </section>

      <section className="container pb-5">
        <div className="public-cta-band text-center">
          <h2 className="fw-bold text-white mb-2">{user ? 'Need A Custom Service?' : 'Ready To Book A Service?'}</h2>
          <p className="mb-4">{user ? 'Contact our team for specialized vehicle maintenance needs.' : 'Create an account to book services and track vehicle maintenance.'}</p>
          <div className="d-flex gap-3 justify-content-center flex-wrap">
            <Link to={user ? '/customer/dashboard' : '/register'} className="btn btn-light btn-lg">{user ? 'Go to Dashboard' : 'Create Account'}</Link>
            <Link to={user ? '/contact' : '/login'} className="btn btn-outline-light btn-lg">{user ? 'Contact Support' : 'Login'}</Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}



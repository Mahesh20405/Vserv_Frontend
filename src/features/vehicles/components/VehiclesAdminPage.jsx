import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminLayout } from '../../../layouts/AppShell'
import { PageSpinner } from '../../../components/ui/Spinner'
import { ActionIconButton } from '../../../components/ui/ActionIconButton'
import { PillStat } from '../../../components/ui/PillStat'
import { PillStatRow } from '../../../components/ui/PillStatRow'
import { PaginationControls } from '../../../components/ui/PaginationControls'
import { useToast } from '../../../components/ui/Toast'
import { formatDate } from '../../../utils/formatters'
import { normalizeRegistrationNumber, validateVehicleForm } from '../../../utils/adminValidation'
import { useNavigationGuard } from '../../../hooks/useNavigationGuard'
import { readPaginatedData } from '../../../services/pagination'
import '../../../styles/features/vehicles/VehiclesAdminPage.css'
import { userService } from '../../users/services/userService'
import { vehicleService } from '../services/vehicleService'
import { CAR_TYPES } from '../../../config/constants'

const TYPE_COLORS = {
  SEDAN: '#2563eb',
  SUV: '#16a34a',
  HATCHBACK: '#d97706',
  COUPE: '#7c3aed',
  CONVERTIBLE: '#db2777',
  WAGON: '#0369a1',
  MINIVAN: '#7e22ce',
}
const EMPTY_FORM = {
  userId: '',
  brand: '',
  model: '',
  registrationNumber: '',
  manufactureYear: '',
  carType: '',
  mileage: '',
  serviceIntervalKm: '10000',
  lowMileageConsent: false,
}
const PAGE_SIZE = 9

function customerSortValue(customer = {}) {
  return new Date(customer.createdAt || 0).getTime() || 0
}

function serviceStatus(vehicle) {
  if (!vehicle?.nextServiceDue) return 'OK'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = (new Date(vehicle.nextServiceDue) - today) / 86400000
  if (diff < 0) return 'OVERDUE'
  if (diff <= 30) return 'DUE'
  return 'OK'
}

function initials(name = '?') {
  return name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?'
}

function ownerMatches(vehicle, query) {
  return [vehicle.ownerName, vehicle.brand, vehicle.model, vehicle.registrationNumber].filter(Boolean).join(' ').toLowerCase().includes(query)
}

export function VehiclesAdminPage() {
  const toast = useToast()
  const [vehicles, setVehicles] = useState([])
  const [totalVehicles, setTotalVehicles] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [serviceFilter, setServiceFilter] = useState('ALL')
  const [editingVehicle, setEditingVehicle] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [vehicleToToggle, setVehicleToToggle] = useState(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [page, setPage] = useState(1)
  const guardNavigation = useNavigationGuard(
    Boolean(showModal && (
      form.userId || form.brand || form.model || form.registrationNumber || form.manufactureYear || form.carType ||
      form.mileage || form.serviceIntervalKm
    )),
    'A vehicle form is still in progress. Leaving now will discard the current changes. Continue?'
  )

  async function loadData() {
    setLoading(true)
    try {
      const [vehicleResponse, customerResponse] = await Promise.all([
        vehicleService.list({
          page,
          size: PAGE_SIZE,
          q: query.trim() || undefined,
          carType: typeFilter !== 'ALL' ? typeFilter : undefined,
          serviceStatus: serviceFilter !== 'ALL' ? serviceFilter : undefined,
        }),
        userService.list({ role: 'CUSTOMER' }),
      ])
      const vehiclesPage = readPaginatedData(vehicleResponse.data, { page, size: PAGE_SIZE })
      setVehicles(vehiclesPage.content)
      setTotalVehicles(vehiclesPage.totalElements)
      setTotalPages(vehiclesPage.totalPages)
      setCustomers(customerResponse.data || [])
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to load vehicles.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [page, query, typeFilter, serviceFilter])

  const metrics = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return {
      total: totalVehicles,
      overdue: vehicles.filter((vehicle) => serviceStatus(vehicle) === 'OVERDUE').length,
      dueSoon: vehicles.filter((vehicle) => serviceStatus(vehicle) === 'DUE').length,
      types: [...new Set(vehicles.map((vehicle) => vehicle.carType).filter(Boolean))].length,
    }
  }, [vehicles])

  const brandBreakdown = useMemo(() => {
    const counts = {}
    vehicles.forEach((vehicle) => {
      const brand = vehicle.brand || 'Unknown'
      counts[brand] = (counts[brand] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [vehicles])

  const recentVehicles = useMemo(() => [...vehicles]
    .sort((left, right) => Number(right.vehicleId || 0) - Number(left.vehicleId || 0))
    .slice(0, 5), [vehicles])

  const customerOptions = useMemo(() => {
    const q = customerSearch.trim().toLowerCase()
    return customers
      .filter((customer) => {
        if (!q) return true
        return [customer.fullName, customer.email].filter(Boolean).join(' ').toLowerCase().includes(q)
      })
      .sort((left, right) => (
        customerSortValue(right) - customerSortValue(left) ||
        Number(right.userId || 0) - Number(left.userId || 0)
      ))
  }, [customers, customerSearch])

  const activePills = []
  if (typeFilter !== 'ALL') activePills.push(typeFilter)
  if (serviceFilter !== 'ALL') activePills.push(serviceFilter === 'OK' ? 'Service OK' : serviceFilter === 'DUE' ? 'Due Soon' : 'Overdue')
  if (query.trim()) activePills.push(`"${query.trim()}"`)
  const pagedVehicles = vehicles

  function resetFilters() {
    setQuery('')
    setTypeFilter('ALL')
    setServiceFilter('ALL')
    setPage(1)
  }

  useEffect(() => { setPage(1) }, [query, typeFilter, serviceFilter])
  useEffect(() => { setPage((current) => Math.min(current, totalPages)) }, [totalPages])

  function updateForm(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }))
    setErrors((previous) => ({ ...previous, [key]: undefined }))
  }

  function openAddModal() {
    setEditingVehicle(null)
    setForm(EMPTY_FORM)
    setErrors({})
    setCustomerSearch('')
    setShowModal(true)
  }

  async function openEditModal(vehicle) {
    const source = vehicle?.serviceIntervalKm !== undefined ? vehicle : (await vehicleService.getById(vehicle.vehicleId)).data
    setEditingVehicle(source)
    setForm({
      userId: source.ownerId || '',
      brand: source.brand || '',
      model: source.model || '',
      registrationNumber: source.registrationNumber || '',
      manufactureYear: source.manufactureYear || '',
      carType: source.carType || '',
      mileage: source.mileage ?? '',
      serviceIntervalKm: source.serviceIntervalKm ?? 10000,
      lowMileageConsent: true,
    })
    setErrors({})
    setShowModal(true)
  }

  async function submitVehicle(event) {
    event.preventDefault()
    const { errors: nextErrors, isValid, normalized } = validateVehicleForm(form, vehicles, { editingVehicleId: editingVehicle?.vehicleId ?? null })
    if (!isValid) {
      setErrors(nextErrors)
      return
    }

    setSaving(true)
    try {
      const payload = editingVehicle ? {
        userId: Number(editingVehicle.ownerId || form.userId),
        brand: editingVehicle.brand,
        model: editingVehicle.model,
        registrationNumber: normalizeRegistrationNumber(editingVehicle.registrationNumber),
        manufactureYear: Number(editingVehicle.manufactureYear),
        carType: editingVehicle.carType,
        mileage: Number(form.mileage),
        serviceIntervalKm: form.serviceIntervalKm === '' ? null : Number(form.serviceIntervalKm),
      } : {
        userId: Number(normalized.userId),
        brand: normalized.brand.trim(),
        model: normalized.model.trim(),
        registrationNumber: normalized.registrationNumber,
        manufactureYear: Number(normalized.manufactureYear),
        carType: normalized.carType,
        mileage: Number(normalized.mileage),
        serviceIntervalKm: normalized.serviceIntervalKm === '' ? null : Number(normalized.serviceIntervalKm),
      }

      if (editingVehicle) {
        await vehicleService.update(editingVehicle.vehicleId, payload)
        toast('Vehicle updated successfully.')
      } else {
        await vehicleService.create(payload)
        toast('Vehicle added successfully.')
      }
      setShowModal(false)
      await loadData()
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to save vehicle.', 'error')
    } finally {
      setSaving(false)
    }
  }

  function requestToggleStatus(vehicle) {
    if (vehicle?.canToggleStatus === false) {
      toast(vehicle.statusToggleReason || 'This vehicle cannot be deactivated right now.', 'error')
      return
    }
    setVehicleToToggle(vehicle)
  }

  async function confirmToggleStatus() {
    if (!vehicleToToggle) return
    setSaving(true)
    try {
      const wasActive = vehicleToToggle.isActive !== false
      await vehicleService.toggleStatus(vehicleToToggle.vehicleId)
      setVehicleToToggle(null)
      toast(`Vehicle ${wasActive ? 'deactivated' : 'activated'} successfully.`)
      await loadData()
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to update vehicle status.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminLayout activeKey="vehicles">
      <div className="vehicles-page">
        <section className="page-header vehicles-hero">
          <div className="container-fluid px-4">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
              <div>
                <h2 className="text-white mb-0">Vehicle Management</h2>
                <p className="mb-0 page-subtitle">Register and maintain customer vehicle records.</p>
              </div>
              <button type="button" className="vehicles-add-btn" onClick={() => guardNavigation(openAddModal)}>Add Vehicle</button>
            </div>
          </div>
        </section>

        <div className="container-fluid px-4 py-3">
          <PillStatRow>
            {[
              { label: 'Total Vehicles', value: metrics.total, icon: 'TV', bg: '#fff0e6', cls: 'kpi-orange' },
              { label: 'Service Overdue', value: metrics.overdue, icon: 'SO', bg: '#fee2e2', cls: 'kpi-red' },
              { label: 'Due in 30 Days', value: metrics.dueSoon, icon: 'D30', bg: '#fef3c7', cls: 'kpi-amber' },
              { label: 'Vehicle Types', value: metrics.types, icon: 'VT', bg: '#e0f2fe', cls: 'kpi-teal' },
            ].map((item) => (
              <PillStat key={item.label} label={item.label} value={item.value} color={item.bg} />
            ))}
          </PillStatRow>

          <div className="toolbar-card mb-3">
            <div className="row g-2 align-items-end">
              <div className="col-md-4">
                <label className="toolbar-label">Search</label>
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-white border-end-0 toolbar-icon-wrap">Find</span>
                  <input type="text" className="form-control border-start-0 toolbar-input" placeholder="Registration, brand, model, owner..." value={query} onChange={(event) => setQuery(event.target.value)} />
                </div>
              </div>
              <div className="col-md-4">
                <label className="toolbar-label">Vehicle Type</label>
                <div className="type-pills">
                  <span className={`type-pill ${typeFilter === 'ALL' ? 'active' : ''}`} onClick={() => setTypeFilter('ALL')}>All</span>
                  {CAR_TYPES.map((type) => <span key={type} className={`type-pill ${typeFilter === type ? 'active' : ''}`} onClick={() => setTypeFilter(type)}>{type}</span>)}
                </div>
              </div>
              <div className="col-md-2">
                <label className="toolbar-label">Service Status</label>
                <select className="form-select form-select-sm toolbar-select" value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value)}>
                  <option value="ALL">All Statuses</option>
                  <option value="OK">Service OK</option>
                  <option value="DUE">Due Soon</option>
                  <option value="OVERDUE">Overdue</option>
                </select>
              </div>
              <div className="col-md-2">
                <button type="button" className="btn-reset w-100" onClick={resetFilters}>Reset Filters</button>
              </div>
            </div>
          </div>

          <div className="vehicles-layout">
            <div>
              <div className="results-bar">
                <small className="text-muted">{totalVehicles ? `Showing ${((page - 1) * PAGE_SIZE) + 1}-${Math.min(page * PAGE_SIZE, totalVehicles)} of ${totalVehicles} vehicles` : `Showing 0 of ${totalVehicles} vehicles`}</small>
                <div className="d-flex gap-1 flex-wrap">{activePills.map((pill) => <span key={pill} className="filter-pill">{pill}</span>)}</div>
              </div>

              <div className="col-header-row">
                <span className="col-hdr">Vehicle</span>
                <span className="col-hdr">Owner</span>
                <span className="col-hdr">Year</span>
                <span className="col-hdr">Mileage</span>
                <span className="col-hdr">Service Status</span>
                <span className="col-hdr">Actions</span>
              </div>

              {loading ? (
                <div className="section-card"><PageSpinner /></div>
              ) : !pagedVehicles.length ? (
                <div className="empty-state">
                  <h6 className="mb-2">No vehicles found</h6>
                  <p className="small mb-3">Try adjusting your search or filters.</p>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetFilters}>Clear Filters</button>
                </div>
              ) : (
                <div id="vehicles-container">
                  {pagedVehicles.map((vehicle) => {
                    const status = serviceStatus(vehicle)
                    return (
                      <article key={vehicle.vehicleId} className="vehicle-card">
                        <div className="vehicle-accent-bar" style={{ background: status === 'OVERDUE' ? '#dc2626' : status === 'DUE' ? '#d97706' : '#16a34a' }} />
                        <div className="vehicle-body">
                          <div>
                            <span className={`vehicle-type-badge type-${vehicle.carType}`}>{vehicle.carType || '—'}</span>
                            <span className={`vehicle-type-badge ms-1 ${vehicle.isActive !== false ? 'svc-OK' : 'svc-OVERDUE'}`}>{vehicle.isActive !== false ? 'ACTIVE' : 'INACTIVE'}</span>
                            <div className="vehicle-name">{vehicle.brand} {vehicle.model}</div>
                            <span className="vehicle-reg">{vehicle.registrationNumber}</span>
                          </div>
                          <div className="meta-value">{vehicle.ownerName || 'Unknown'}</div>
                          <div className="meta-value">{vehicle.manufactureYear || '—'}</div>
                          <div className="meta-value">{(vehicle.mileage || 0).toLocaleString('en-IN')} km</div>
                          <div>
                            <span className={`svc-status svc-${status}`}>
                              <span className={`svc-dot dot-${status}`} />
                              {status === 'OK' ? 'Service OK' : status === 'DUE' ? 'Due Soon' : 'Overdue'}
                            </span>
                            {vehicle.nextServiceDue ? <div className="service-due-text">Due: {formatDate(vehicle.nextServiceDue)}</div> : null}
                          </div>
                          <div className="vehicle-actions">
                            <ActionIconButton icon="edit" label="Edit vehicle" onClick={() => openEditModal(vehicle)} />
                            <ActionIconButton
                              icon={vehicle.isActive !== false ? 'deactivate' : 'activate'}
                              label={vehicle.isActive !== false ? 'Deactivate vehicle' : 'Activate vehicle'}
                              className={`${vehicle.isActive !== false ? 'action-warning' : 'action-success'} ${vehicle.canToggleStatus === false ? 'is-disabled' : ''}`}
                              onClick={() => requestToggleStatus(vehicle)}
                            />
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
              <PaginationControls page={page} totalItems={totalVehicles} pageSize={PAGE_SIZE} totalPages={totalPages} onPageChange={setPage} />
            </div>

            <aside id="vehicles-sidebar">
              <div className="sidebar-card">
                <div className="sidebar-title">Quick Actions</div>
                <button type="button" className="quick-action-btn w-100" onClick={() => guardNavigation(openAddModal)}>
                  <div className="qa-icon-sm" style={{ background: '#fff0e6' }}>VH</div>
                  Register New Vehicle
                </button>
                <Link to="/admin/users" className="quick-action-btn">
                  <div className="qa-icon-sm" style={{ background: '#e8f4fd' }}>US</div>
                  Manage Customers
                </Link>
                <Link to="/admin/bookings" className="quick-action-btn">
                  <div className="qa-icon-sm" style={{ background: '#f0fdf4' }}>BK</div>
                  View Bookings
                </Link>
              </div>

              <div className="sidebar-card">
                <div className="sidebar-title">Fleet by Type</div>
                <div className="d-flex flex-column gap-2">
                  {CAR_TYPES.map((type) => {
                    const count = vehicles.filter((vehicle) => vehicle.carType === type).length
                    const total = vehicles.length || 1
                    return (
                      <div key={type}>
                        <div className="brand-bar-label"><span>{type}</span><span>{count}</span></div>
                        <div className="brand-bar-bg"><div className="brand-bar-fill" style={{ width: `${Math.round((count / total) * 100)}%`, background: TYPE_COLORS[type] }} /></div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="sidebar-card">
                <div className="sidebar-title">Top Brands</div>
                {!brandBreakdown.length ? <p className="text-muted small text-center mb-0">No data</p> : brandBreakdown.map(([brand, count]) => {
                  const max = brandBreakdown[0]?.[1] || 1
                  return (
                    <div key={brand} className="brand-bar-row">
                      <div className="brand-bar-label"><span>{brand}</span><span>{count}</span></div>
                      <div className="brand-bar-bg"><div className="brand-bar-fill" style={{ width: `${Math.round((count / max) * 100)}%` }} /></div>
                    </div>
                  )
                })}
              </div>

              <div className="sidebar-card">
                <div className="sidebar-title">Recent Additions</div>
                {!recentVehicles.length ? <p className="text-muted small text-center mb-0">No vehicles yet</p> : recentVehicles.map((vehicle) => (
                  <div key={vehicle.vehicleId} className="recent-veh-item">
                    <div className="rv-icon">VH</div>
                    <div>
                      <div className="rv-name">{vehicle.brand} {vehicle.model}</div>
                      <div className="rv-sub">{vehicle.registrationNumber} • {vehicle.ownerName || 'Unknown'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>

        {showModal ? (
          <div className="modal fade show d-block vehicles-modal-backdrop">
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content">
                <div className="modal-header vehicles-modal-header">
                  <h5 className="modal-title text-white">{editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}</h5>
                </div>
                <form onSubmit={submitVehicle}>
                  <div className="modal-body">
                    {!editingVehicle ? (
                      <div className="mb-3">
                        <label className="modal-form-label">Customer <span className="required-mark">*</span></label>
                        <div className="customer-picker-search">
                          <input type="text" placeholder="Search customers by name or email..." value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} />
                        </div>
                        <div className="small text-muted mb-2">{`${customerOptions.length} of ${customers.length} customers`}</div>
                        <div className="customer-picker-grid">
                          {customerOptions.map((customer) => (
                            <div key={customer.userId} className={`cust-card ${String(form.userId) === String(customer.userId) ? 'selected' : ''}`} onClick={() => updateForm('userId', String(customer.userId))}>
                              <div className="cust-avatar" style={{ background: '#F97316' }}>{initials(customer.fullName)}</div>
                              <div className="min-w-0">
                                <div className="cust-name-txt">{customer.fullName}</div>
                                <div className="cust-email-txt">{customer.email}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                        {errors.userId ? <div className="invalid-feedback d-block">{errors.userId}</div> : null}
                      </div>
                    ) : (
                      <>
                        <div className="lock-note">
                          Vehicle identity fields are locked. Only mileage and service interval can be updated.
                        </div>
                        <div className="mb-3">
                          <label className="modal-form-label text-muted">Owner</label>
                          <div className="form-control bg-light text-muted">{editingVehicle.ownerName || 'Unknown'}</div>
                        </div>
                      </>
                    )}

                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="modal-form-label">Car Type <span className="required-mark">*</span></label>
                        <select className={`form-select modal-form-control ${errors.carType ? 'is-invalid' : ''}`} value={form.carType} disabled={Boolean(editingVehicle)} onChange={(event) => updateForm('carType', event.target.value)}>
                          <option value="">Select car type</option>
                          {CAR_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                        </select>
                        {errors.carType ? <div className="invalid-feedback">{errors.carType}</div> : null}
                      </div>
                      <div className="col-md-6">
                        <label className="modal-form-label">Registration Number <span className="required-mark">*</span></label>
                        <input className={`form-control modal-form-control text-uppercase ${errors.registrationNumber ? 'is-invalid' : ''}`} value={form.registrationNumber} readOnly={Boolean(editingVehicle)} disabled={Boolean(editingVehicle)} onChange={(event) => updateForm('registrationNumber', normalizeRegistrationNumber(event.target.value))} />
                        {errors.registrationNumber ? <div className="invalid-feedback">{errors.registrationNumber}</div> : null}
                      </div>
                      <div className="col-md-6">
                        <label className="modal-form-label">Brand <span className="required-mark">*</span></label>
                        <input className={`form-control modal-form-control ${errors.brand ? 'is-invalid' : ''}`} value={form.brand} readOnly={Boolean(editingVehicle)} disabled={Boolean(editingVehicle)} onChange={(event) => updateForm('brand', event.target.value)} />
                        {errors.brand ? <div className="invalid-feedback">{errors.brand}</div> : null}
                      </div>
                      <div className="col-md-6">
                        <label className="modal-form-label">Model <span className="required-mark">*</span></label>
                        <input className={`form-control modal-form-control ${errors.model ? 'is-invalid' : ''}`} value={form.model} readOnly={Boolean(editingVehicle)} disabled={Boolean(editingVehicle)} onChange={(event) => updateForm('model', event.target.value)} />
                        {errors.model ? <div className="invalid-feedback">{errors.model}</div> : null}
                      </div>
                      <div className="col-md-4">
                        <label className="modal-form-label">Manufacture Year <span className="required-mark">*</span></label>
                        <input type="number" className={`form-control modal-form-control ${errors.manufactureYear ? 'is-invalid' : ''}`} value={form.manufactureYear} readOnly={Boolean(editingVehicle)} disabled={Boolean(editingVehicle)} onChange={(event) => updateForm('manufactureYear', event.target.value)} />
                        {errors.manufactureYear ? <div className="invalid-feedback">{errors.manufactureYear}</div> : null}
                      </div>
                      <div className="col-md-4">
                        <label className="modal-form-label">Mileage (km) <span className="required-mark">*</span></label>
                        <input type="number" className={`form-control modal-form-control ${errors.mileage ? 'is-invalid' : ''}`} value={form.mileage} onChange={(event) => updateForm('mileage', event.target.value)} />
                        {errors.mileage ? <div className="invalid-feedback">{errors.mileage}</div> : null}
                      </div>
                      <div className="col-md-4">
                        <label className="modal-form-label">Service Interval (km)</label>
                        <input type="number" className={`form-control modal-form-control ${errors.serviceIntervalKm ? 'is-invalid' : ''}`} value={form.serviceIntervalKm} onChange={(event) => updateForm('serviceIntervalKm', event.target.value)} />
                        {errors.serviceIntervalKm ? <div className="invalid-feedback">{errors.serviceIntervalKm}</div> : null}
                        <small className="text-muted">Default: 10,000 km</small>
                      </div>
                      {!editingVehicle && Number(form.mileage || 0) < 10000 ? (
                        <div className="col-12">
                          <div className="alert alert-warning py-2 px-3 mb-2 small">
                            This vehicle is below 10,000 km and may still be under brand service care. Proceeding can affect free brand service eligibility and warranty.
                          </div>
                          <div className="form-check">
                            <input className="form-check-input" id="vehicle-low-mileage" type="checkbox" checked={form.lowMileageConsent} onChange={(event) => updateForm('lowMileageConsent', event.target.checked)} />
                            <label className="form-check-label small" htmlFor="vehicle-low-mileage">I understand and agree to add this vehicle anyway.</label>
                          </div>
                          {errors.lowMileageConsent ? <div className="invalid-feedback d-block">{errors.lowMileageConsent}</div> : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => guardNavigation(() => setShowModal(false))}>Cancel</button>
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => editingVehicle ? openEditModal(editingVehicle) : setForm(EMPTY_FORM)}>Reset</button>
                    <button type="submit" className="btn-modal-save" disabled={saving}>{saving ? 'Saving...' : 'Save Vehicle'}</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        ) : null}

        {vehicleToToggle ? (
          <div className="modal fade show d-block vehicles-modal-backdrop">
            <div className="modal-dialog modal-dialog-centered modal-sm">
              <div className="modal-content">
                <div className="modal-header vehicles-danger-header">
                  <h5 className="modal-title text-white">{vehicleToToggle.isActive !== false ? 'Deactivate Vehicle' : 'Activate Vehicle'}</h5>
                </div>
                <div className="modal-body text-center py-4">
                  <h6 className="fw-bold mb-2">{vehicleToToggle.isActive !== false ? 'Deactivate this vehicle?' : 'Activate this vehicle?'}</h6>
                  <p className="text-muted small mb-0">{vehicleToToggle.brand} {vehicleToToggle.model} ({vehicleToToggle.registrationNumber}) • Owner: {vehicleToToggle.ownerName || 'Unknown'}</p>
                  <p className="text-muted small mt-2 mb-0">{vehicleToToggle.isActive !== false ? 'This vehicle will be hidden from active use until it is activated again.' : 'This vehicle will become available for active use again.'}</p>
                </div>
                <div className="modal-footer justify-content-center gap-2">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setVehicleToToggle(null)}>Cancel</button>
                  <button type="button" className={`btn btn-sm ${vehicleToToggle.isActive !== false ? 'btn-warning' : 'btn-success'}`} disabled={saving} onClick={confirmToggleStatus}>{saving ? 'Updating...' : vehicleToToggle.isActive !== false ? 'Deactivate' : 'Activate'}</button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AdminLayout>
  )
}



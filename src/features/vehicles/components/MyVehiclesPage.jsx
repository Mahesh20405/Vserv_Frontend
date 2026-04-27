import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CustomerLayout } from '../../../layouts/AppShell'
import { CustomerPageHero, PageContent } from '../../../components/common/PageElements'
import { PageSpinner } from '../../../components/ui/Spinner'
import { PillStat } from '../../../components/ui/PillStat'
import { PillStatRow } from '../../../components/ui/PillStatRow'
import { useAuth } from '../../auth/hooks/useAuth'
import { useToast } from '../../../components/ui/Toast'
import { formatDate } from '../../../utils/formatters'
import { ActionIconButton } from '../../../components/ui/ActionIconButton'
import { normalizeRegistrationNumber, validateVehicleForm } from '../../../utils/adminValidation'
import { PaginationControls } from '../../../components/ui/PaginationControls'
import { useNavigationGuard } from '../../../hooks/useNavigationGuard'
import { readPaginatedData } from '../../../services/pagination'
import { vehicleService } from '../services/vehicleService'
import { CAR_TYPES } from '../../../config/constants'

const BLANK = {
  brand: '',
  model: '',
  registrationNumber: '',
  manufactureYear: '',
  carType: 'SEDAN',
  mileage: '',
  serviceIntervalKm: 10000,
  lowMileageConsent: false,
}
const PAGE_SIZE = 9

function GenericCarIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M16 40L21 27C22.2 23.9 25.2 22 28.5 22H41.9C45.2 22 48.2 23.9 49.4 27L54 40" stroke="#334155" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 42.5C12 39.5 14.5 37 17.5 37H46.5C52.3 37 57 41.7 57 47.5V49C57 50.7 55.7 52 54 52H10C8.3 52 7 50.7 7 49V47.5C7 44.7 9.2 42.5 12 42.5Z" fill="#e2e8f0" stroke="#334155" strokeWidth="3.2" />
      <path d="M22 29H46" stroke="#94a3b8" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="18" cy="50" r="4" fill="#0f172a" />
      <circle cx="46" cy="50" r="4" fill="#0f172a" />
      <path d="M14 41H21" stroke="#f97316" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M44 41H51" stroke="#f97316" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  )
}

export function MyVehiclesPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [vehicles, setVehicles] = useState([])
  const [totalVehicles, setTotalVehicles] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editVehicle, setEditVehicle] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [sortBy, setSortBy] = useState('recent')
  const [deleteCandidate, setDeleteCandidate] = useState(null)
  const [page, setPage] = useState(1)
  const guardNavigation = useNavigationGuard(
    Boolean(showAdd && (
      form.brand || form.model || form.registrationNumber || form.manufactureYear || form.carType ||
      form.mileage || form.serviceIntervalKm
    )),
    'A vehicle form is still in progress. Leaving now will discard the current changes. Continue?'
  )

  const load = async () => {
    if (!user) return
    setLoading(true)
    try {
      const r = await vehicleService.byUser(user.userId, {
        page,
        size: PAGE_SIZE,
        q: query.trim() || undefined,
        carType: typeFilter || undefined,
        sort: sortBy === 'brand' ? 'brand' : sortBy === 'mileage' ? 'mileage' : 'recent',
      })
      const pageData = readPaginatedData(r.data, { page, size: PAGE_SIZE })
      setVehicles(pageData.content)
      setTotalVehicles(pageData.totalElements)
      setTotalPages(pageData.totalPages)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user, page, query, sortBy, typeFilter])

  const set = (k) => (e) => {
    const nextValue = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((p) => ({
      ...p,
      [k]: k === 'registrationNumber' ? normalizeRegistrationNumber(nextValue) : nextValue,
    }))
  }

  function openEdit(v) {
    setEditVehicle(v)
    setForm({
      brand: v.brand,
      model: v.model,
      registrationNumber: v.registrationNumber,
      manufactureYear: v.manufactureYear,
      carType: v.carType || 'SEDAN',
      mileage: v.mileage || '',
      serviceIntervalKm: v.serviceIntervalKm || 10000,
      lowMileageConsent: true,
    })
    setErrors({})
    setShowAdd(true)
  }

  async function submit(e) {
    e.preventDefault()
    const { errors: nextErrors, isValid, normalized } = validateVehicleForm(
      { ...form, userId: user?.userId },
      vehicles,
      { editingVehicleId: editVehicle?.vehicleId ?? null },
    )
    if (!isValid) {
      setErrors(nextErrors)
      return
    }

    setSaving(true)
    try {
      const body = editVehicle
        ? {
            userId: user.userId,
            brand: editVehicle.brand,
            model: editVehicle.model,
            registrationNumber: normalizeRegistrationNumber(editVehicle.registrationNumber),
            manufactureYear: Number(editVehicle.manufactureYear),
            carType: editVehicle.carType,
            mileage: Number(normalized.mileage),
            serviceIntervalKm: normalized.serviceIntervalKm === '' ? null : Number(normalized.serviceIntervalKm),
          }
        : {
            ...normalized,
            userId: user.userId,
            brand: normalized.brand.trim(),
            model: normalized.model.trim(),
            registrationNumber: normalizeRegistrationNumber(normalized.registrationNumber),
            mileage: Number(normalized.mileage),
            manufactureYear: Number(normalized.manufactureYear),
            serviceIntervalKm: Number(normalized.serviceIntervalKm),
          }
      if (editVehicle) await vehicleService.update(editVehicle.vehicleId, body)
      else await vehicleService.create(body)
      toast(editVehicle ? 'Vehicle updated!' : 'Vehicle added!')
      setShowAdd(false)
      setEditVehicle(null)
      setErrors({})
      load()
    } catch (err) {
      toast(err.response?.data?.message || 'Failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function deleteVehicle(id) {
    const target = vehicles.find((vehicle) => vehicle.vehicleId === id)
    if (!target) return
    if (target.canToggleStatus === false) {
      toast(target.statusToggleReason || 'This vehicle cannot be deactivated right now.', 'error')
      return
    }
    await vehicleService.toggleStatus(id)
    setDeleteCandidate(null)
    toast(`Vehicle ${target.isActive !== false ? 'deactivated' : 'activated'} successfully.`)
    load()
  }

  const pagedVehicles = vehicles

  const dueSoon = vehicles.filter((vehicle) => {
    if (!vehicle.serviceIntervalKm || vehicle.mileage == null) return false
    const nextKm = Math.max(Number(vehicle.serviceIntervalKm || 0), Number(vehicle.serviceIntervalKm || 0) + Number(vehicle.lastServiceMileage || 0))
    return (nextKm - Number(vehicle.mileage || 0)) < 2000
  }).length

  useEffect(() => { setPage(1) }, [query, sortBy, typeFilter])
  useEffect(() => { setPage((current) => Math.min(current, totalPages)) }, [totalPages])

  return (
    <CustomerLayout activeKey="vehicles">
      <div className="customer-vehicles-page">
        <CustomerPageHero
          title="My Vehicles"
          subtitle="Manage the vehicles linked to your account and keep service information current."
          actions={<button className="customer-hero-btn" onClick={() => guardNavigation(() => { setEditVehicle(null); setForm(BLANK); setErrors({}); setShowAdd(true) })}>Add Vehicle</button>}
        />
        <PageContent>
        <PillStatRow>
          {[{ icon: 'TV', label: 'TV', value: vehicles.length, bg: '#dbeafe' }, { icon: 'SV', label: 'SV', value: vehicles.filter((v) => v.carType === 'SUV').length, bg: '#dcfce7' }, { icon: 'SD', label: 'SD', value: vehicles.filter((v) => v.carType === 'SEDAN').length, bg: '#fef3c7' }, { icon: 'DS', label: 'DS', value: dueSoon, bg: '#fee2e2' }].map((k) => (
            <PillStat key={k.label} label={k.label} value={k.value} color={k.bg} />
          ))}
        </PillStatRow>

        <div className="toolbar-card customer-toolbar mb-3">
          <div className="row g-2 align-items-end">
            <div className="col-md-5">
              <label className="toolbar-label">Search</label>
              <input className="form-control form-control-sm" placeholder="Brand, model, registration..." value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="col-md-3">
              <label className="toolbar-label">Type</label>
              <select className="form-select form-select-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">All Vehicles</option>
                {CAR_TYPES.map((t) => vehicles.some((v) => v.carType === t) && <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="col-md-2">
              <label className="toolbar-label">Sort</label>
              <select className="form-select form-select-sm" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="recent">Recently Added</option>
                <option value="brand">Brand</option>
                <option value="mileage">Mileage</option>
              </select>
            </div>
            <div className="col-md-2">
              <button className="btn btn-sm btn-outline-secondary w-100" onClick={() => { setQuery(''); setTypeFilter(''); setSortBy('recent') }}>Reset</button>
            </div>
          </div>
        </div>

        {loading ? <PageSpinner /> : (
          <div className="row g-3">
            {pagedVehicles.map((v) => (
              <div key={v.vehicleId} className="col-md-6 col-xl-4">
                <div className="section-card">
                  <div className="section-body">
                    <div className="d-flex align-items-start gap-3 mb-3">
                      <div style={{ lineHeight: 1 }}><GenericCarIcon /></div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{v.brand} {v.model}</div>
                          <div style={{ fontSize: '0.73rem', color: 'var(--neutral-medium)' }}>{v.registrationNumber}</div>
                        <span className="badge bg-light text-dark mt-1" style={{ fontSize: '0.65rem' }}>{v.carType}</span>
                        <span className={`badge mt-1 ms-1 ${v.isActive !== false ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'}`} style={{ fontSize: '0.65rem' }}>{v.isActive !== false ? 'ACTIVE' : 'INACTIVE'}</span>
                      </div>
                    </div>
                    <div className="row g-2 mb-3">
                      {[['Year', v.manufactureYear], ['Mileage', `${(v.mileage || 0).toLocaleString('en-IN')} km`], ['Service Int.', `${v.serviceIntervalKm || 10000} km`], ['Last Service', formatDate(v.lastServiceDate)]].map(([l, val]) => (
                        <div key={l} className="col-6"><div className="detail-label">{l}</div><div className="detail-value label-sm">{val}</div></div>
                      ))}
                    </div>
                    {(() => {
                      const interval = Number(v.serviceIntervalKm || 10000)
                      const mileage = Number(v.mileage || 0)
                      const ratio = Math.max(0, Math.min(100, Math.round((mileage / interval) * 100)))
                      const remaining = Math.max(interval - mileage, 0)
                      const tone = ratio >= 80 ? '#dc2626' : ratio >= 60 ? '#d97706' : '#16a34a'
                      return (
                        <div className="mb-3">
                          <div className="d-flex justify-content-between align-items-center mb-1">
                            <div className="detail-label">Next service in</div>
                            <div style={{ fontSize: 'var(--fs-meta)', fontWeight: 700, color: tone }}>{remaining.toLocaleString('en-IN')} km</div>
                          </div>
                          <div style={{ height: 8, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden' }}>
                            <div style={{ width: `${ratio}%`, height: '100%', background: tone }} />
                          </div>
                          <div className="mt-2 d-flex justify-content-between" style={{ fontSize: 'var(--fs-fine)', color: 'var(--neutral-medium)' }}>
                            <span>{ratio}% of this cycle used</span>
                            <span>{v.nextServiceDue ? `Due ${formatDate(v.nextServiceDue)}` : 'Due date not set'}</span>
                          </div>
                        </div>
                      )
                    })()}
                    <div className="action-strip">
                      <ActionIconButton as={Link} to={`/customer/book-service?vehicleId=${v.vehicleId}`} icon="book" label="Book service" className="action-primary" />
                      <ActionIconButton icon="edit" label="Edit vehicle" onClick={() => openEdit(v)} />
                      <ActionIconButton
                        icon={v.isActive !== false ? 'deactivate' : 'activate'}
                        label={v.isActive !== false ? 'Deactivate vehicle' : 'Activate vehicle'}
                        className={`${v.isActive !== false ? 'action-warning' : 'action-success'} ms-auto ${v.canToggleStatus === false ? 'is-disabled' : ''}`}
                        onClick={() => {
                          if (v.canToggleStatus === false) {
                            toast(v.statusToggleReason || 'This vehicle cannot be deactivated right now.', 'error')
                            return
                          }
                          setDeleteCandidate(v)
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {!pagedVehicles.length && <div className="col-12 empty-state"><div className="empty-state-icon">Car</div><p>{totalVehicles ? 'No vehicles match this filter' : 'No vehicles added yet'}</p></div>}
          </div>
        )}
        <PaginationControls page={page} totalItems={totalVehicles} pageSize={PAGE_SIZE} totalPages={totalPages} onPageChange={setPage} />

        {showAdd && (
          <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content">
                <div className="modal-header text-white" style={{ background: 'var(--primary-dark-gradient)' }}>
                  <h5 className="modal-title fw-semibold">{editVehicle ? 'Edit Vehicle' : 'Add Vehicle'}</h5>
                </div>
                <form onSubmit={submit}>
                  <div className="modal-body">
                    {editVehicle ? <div className="alert alert-info small py-2">Only mileage and service interval can be updated after a vehicle is added.</div> : null}
                    <div className="row g-3">
                      {[['brand', 'Brand', 'text'], ['model', 'Model', 'text'], ['registrationNumber', 'Registration No.', 'text'], ['manufactureYear', 'Year', 'number'], ['mileage', 'Current Mileage (km)', 'number']].map(([k, l, type]) => (
                        <div key={k} className="col-md-6">
                          <label className="form-label label-sm">{l} <span className="required-mark">*</span></label>
                          <input type={type} className={`form-control form-control-sm ${k === 'registrationNumber' ? 'text-uppercase ' : ''}${errors[k] ? 'is-invalid' : ''}`} value={form[k]} onChange={set(k)} readOnly={Boolean(editVehicle && k !== 'mileage')} disabled={Boolean(editVehicle && k !== 'mileage')} />
                          {errors[k] && <div className="invalid-feedback">{errors[k]}</div>}
                        </div>
                      ))}
                      <div className="col-md-6">
                        <label className="form-label label-sm">Car Type <span className="required-mark">*</span></label>
                        <select className={`form-select form-select-sm ${errors.carType ? 'is-invalid' : ''}`} value={form.carType} onChange={set('carType')} disabled={Boolean(editVehicle)}>
                          {CAR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        {errors.carType && <div className="invalid-feedback">{errors.carType}</div>}
                      </div>
                      <div className="col-md-6">
                        <label className="form-label label-sm">Service Interval (km)</label>
                        <input type="number" className={`form-control form-control-sm ${errors.serviceIntervalKm ? 'is-invalid' : ''}`} value={form.serviceIntervalKm} onChange={set('serviceIntervalKm')} />
                        {errors.serviceIntervalKm && <div className="invalid-feedback">{errors.serviceIntervalKm}</div>}
                      </div>
                      {!editVehicle && Number(form.mileage) < 10000 && (
                        <div className="col-12">
                          <div className="form-check">
                            <input className="form-check-input" type="checkbox" id="custLowMileageConsent" checked={form.lowMileageConsent} onChange={set('lowMileageConsent')} />
                            <label className="form-check-label" htmlFor="custLowMileageConsent">This vehicle has low mileage and I still want to add it.</label>
                          </div>
                          {errors.lowMileageConsent && <div className="text-danger small mt-1">{errors.lowMileageConsent}</div>}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => guardNavigation(() => { setShowAdd(false); setEditVehicle(null) })}>Cancel</button>
                    <button type="submit" className="btn btn-sm btn-primary" disabled={saving}>{saving ? 'Saving...' : editVehicle ? 'Update' : 'Add Vehicle'}</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
        {deleteCandidate && (
          <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div className="modal-dialog modal-dialog-centered modal-sm">
              <div className="modal-content">
                <div className="modal-header text-white" style={{ background: 'var(--primary-dark-gradient)' }}>
                  <h5 className="modal-title fw-semibold">{deleteCandidate.isActive !== false ? 'Deactivate Vehicle' : 'Activate Vehicle'}</h5>
                </div>
                <div className="modal-body">
                  <p className="mb-0 small text-muted">{deleteCandidate.brand} {deleteCandidate.model} ({deleteCandidate.registrationNumber}) will be {deleteCandidate.isActive !== false ? 'deactivated' : 'activated'} in your garage.</p>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setDeleteCandidate(null)}>Cancel</button>
                  <button type="button" className={`btn btn-sm ${deleteCandidate.isActive !== false ? 'btn-warning' : 'btn-success'}`} onClick={() => deleteVehicle(deleteCandidate.vehicleId)}>{deleteCandidate.isActive !== false ? 'Deactivate' : 'Activate'}</button>
                </div>
              </div>
            </div>
          </div>
        )}
        </PageContent>
      </div>
    </CustomerLayout>
  )
}



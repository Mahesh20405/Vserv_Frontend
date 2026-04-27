import { useEffect, useMemo, useState } from 'react'
import { AdminLayout } from '../../../layouts/AppShell'
import { AdminPageHero, PageContent } from '../../../components/common/PageElements'
import { PageSpinner } from '../../../components/ui/Spinner'
import { useToast } from '../../../components/ui/Toast'
import { formatCurrency } from '../../../utils/formatters'
import { ActionIconButton } from '../../../components/ui/ActionIconButton'
import { PaginationControls } from '../../../components/ui/PaginationControls'
import { PillStat } from '../../../components/ui/PillStat'
import { PillStatRow } from '../../../components/ui/PillStatRow'
import { Modal } from '../../../components/ui/Modal'
import { validateCatalogForm } from '../../../utils/adminValidation'
import { useNavigationGuard } from '../../../hooks/useNavigationGuard'
import '../../../styles/features/catalog/CatalogPage.css'
import { catalogService } from '../services/catalogService'
import { CAR_TYPES as BASE_CAR_TYPES } from '../../../config/constants'

const CAR_TYPES = [...BASE_CAR_TYPES, 'ALL']

const SVC_TYPES = ['SERVICING', 'REPAIR', 'INSPECTION', 'MAINTENANCE']
const FIXED_BOOKING_CHARGE = 299
const BLANK = { serviceName: '', serviceType: 'SERVICING', description: '', basePrice: '', carType: 'ALL', durationHours: '' }
const TYPE_META = {
  SERVICING: { icon: 'SV', accent: '#16a34a', soft: '#dcfce7' },
  REPAIR: { icon: 'RP', accent: '#2563eb', soft: '#dbeafe' },
  INSPECTION: { icon: 'IN', accent: '#d97706', soft: '#fef3c7' },
  MAINTENANCE: { icon: 'MT', accent: '#7c3aed', soft: '#ede9fe' },
}
const PAGE_SIZE = 8

function CatalogModal({ title, subtitle, children, onClose }) {
  return <Modal title={title} subtitle={subtitle} size="lg" onClose={onClose} open>{children}</Modal>
}

function ConfirmModal({ title, body, confirmLabel, onClose, onConfirm, danger = false, saving = false }) {
  return (
    <Modal
      title={title}
      danger={danger}
      small
      onClose={onClose}
      open
      footer={(
        <div className="modal-footer justify-content-center gap-2">
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className={`btn btn-sm ${danger ? 'btn-danger' : 'btn-warning'}`} disabled={saving} onClick={onConfirm}>{saving ? 'Working...' : confirmLabel}</button>
        </div>
      )}
    >
      <div className="modal-body text-center py-4"><p className="text-muted small mb-0">{body}</p></div>
    </Modal>
  )
}

export function CatalogPage() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [carFilter, setCarFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [errors, setErrors] = useState({})
  const [confirmState, setConfirmState] = useState(null)
  const [page, setPage] = useState(1)
  const isCatalogDirty = Boolean(showModal && (
    editItem
      ? (
        form.serviceName !== (editItem.serviceName || '') ||
        form.serviceType !== (editItem.serviceType || 'SERVICING') ||
        form.description !== (editItem.description || '') ||
        String(form.basePrice) !== String(editItem.basePrice ?? '') ||
        form.carType !== (editItem.carType || 'ALL') ||
        String(form.durationHours) !== String(editItem.durationHours ?? '')
      )
      : Object.values(form).some((value) => String(value || '').trim() !== '')
  ))
  const guardNavigation = useNavigationGuard(
    Boolean(saving || confirmState || isCatalogDirty),
    'A service catalog change is still in progress. Leaving now may discard it. Continue?'
  )

  async function load() {
    setLoading(true)
    try {
      const response = await catalogService.list()
      setItems(response.data || [])
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to load services.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items
      .filter((item) => {
        const active = item.isActive !== false
        if (typeFilter && item.serviceType !== typeFilter) return false
        if (carFilter && item.carType !== carFilter) return false
        if (statusFilter === 'ACTIVE' && !active) return false
        if (statusFilter === 'INACTIVE' && active) return false
        if (!q) return true
        return [item.serviceName, item.description, item.serviceType, item.carType].filter(Boolean).join(' ').toLowerCase().includes(q)
      })
      .sort((left, right) => Number(right.catalogId || 0) - Number(left.catalogId || 0))
  }, [items, query, typeFilter, carFilter, statusFilter])

  const counts = useMemo(() => {
    const active = items.filter((item) => item.isActive !== false).length
    const inactive = items.length - active
    const types = new Set(items.map((item) => item.serviceType).filter(Boolean)).size
    const prices = items.map((item) => Number(item.basePrice || 0)).filter((price) => price > 0)
    const avgPrice = prices.length ? Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length) : 0
    return { total: items.length, active, inactive, types, avgPrice }
  }, [items])

  const activePills = []
  if (typeFilter) activePills.push(typeFilter)
  if (carFilter) activePills.push(carFilter)
  if (statusFilter) activePills.push(statusFilter === 'ACTIVE' ? 'Active' : 'Inactive')
  if (query.trim()) activePills.push(`"${query.trim()}"`)

  const typeBreakdown = useMemo(() => SVC_TYPES.map((type) => ({
    type,
    count: visible.filter((item) => item.serviceType === type).length,
  })), [visible])

  const durationBuckets = useMemo(() => {
    const buckets = { 'Quick (<2h)': 0, 'Standard (2-4h)': 0, 'Major (4h+)': 0 }
    visible.forEach((item) => {
      const duration = Number(item.durationHours || 0)
      if (duration < 2) buckets['Quick (<2h)'] += 1
      else if (duration < 4) buckets['Standard (2-4h)'] += 1
      else buckets['Major (4h+)'] += 1
    })
    return Object.entries(buckets)
  }, [visible])

  const recentServices = useMemo(() => [...items].slice().sort((a, b) => Number(b.catalogId || 0) - Number(a.catalogId || 0)).slice(0, 5), [items])
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const pagedItems = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function updateForm(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }))
    setErrors((previous) => ({ ...previous, [key]: undefined }))
  }

  function resetFilters() {
    setQuery('')
    setTypeFilter('')
    setCarFilter('')
    setStatusFilter('')
    setPage(1)
  }

  useEffect(() => { setPage(1) }, [query, typeFilter, carFilter, statusFilter])
  useEffect(() => { setPage((current) => Math.min(current, totalPages)) }, [totalPages])

  function openCreate() {
    setEditItem(null)
    setForm(BLANK)
    setErrors({})
    setShowModal(true)
  }

  function openEdit(item) {
    setEditItem(item)
    setForm({
      serviceName: item.serviceName || '',
      serviceType: item.serviceType || 'SERVICING',
      description: item.description || '',
      basePrice: item.basePrice ?? '',
      carType: item.carType || 'ALL',
      durationHours: item.durationHours ?? '',
    })
    setErrors({})
    setShowModal(true)
  }

  async function submit(event) {
    event.preventDefault()
    const { errors: nextErrors, isValid } = validateCatalogForm(form, items, editItem?.catalogId ?? null)
    if (!isValid) {
      setErrors(nextErrors)
      return
    }

    setSaving(true)
    try {
      const body = {
        ...form,
        basePrice: Number(form.basePrice),
        durationHours: Number(form.durationHours),
      }
      if (editItem) {
        await catalogService.update(editItem.catalogId, body)
        toast('Service updated successfully.')
      } else {
        await catalogService.create(body)
        toast('Service created successfully.')
      }
      setShowModal(false)
      await load()
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to save service.', 'error')
    } finally {
      setSaving(false)
    }
  }

  function requestToggle(item) {
    const active = item.isActive !== false
    setConfirmState({
      mode: 'toggle',
      item,
      title: active ? 'Deactivate Service' : 'Activate Service',
      body: active ? `Deactivate ${item.serviceName}? Customers will no longer be able to book it.` : `Activate ${item.serviceName} and make it available again?`,
      confirmLabel: active ? 'Deactivate' : 'Activate',
      danger: false,
    })
  }

  function requestDelete(item) {
    requestToggle(item)
  }

  async function handleConfirm() {
    if (!confirmState?.item) return
    setSaving(true)
    try {
      await catalogService.toggle(confirmState.item.catalogId)
      toast(`Service ${confirmState.item.isActive !== false ? 'deactivated' : 'activated'} successfully.`)
      setConfirmState(null)
      await load()
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to update service.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminLayout activeKey="catalog">
      <div className="catalog-page">
        <AdminPageHero
          title="Service Catalog"
          subtitle="Manage service pricing, duration, vehicle coverage, and active catalog offerings."
          actions={<button type="button" className="admin-hero-btn" onClick={openCreate}>Add Service</button>}
        />
        <PageContent>
          <PillStatRow>
            {[
              { label: 'Total Services', value: counts.total, icon: 'TS', bg: '#fff0e6' },
              { label: 'Active Services', value: counts.active, icon: 'AC', bg: '#dcfce7' },
              { label: 'Inactive Services', value: counts.inactive, icon: 'IN', bg: '#f3f4f6' },
              { label: 'Service Types', value: counts.types, icon: 'TP', bg: '#dbeafe' },
              { label: 'Average Price', value: formatCurrency(counts.avgPrice), icon: 'AP', bg: '#ede9fe' },
            ].map((item) => <PillStat key={item.label} label={item.label} value={item.value} color={item.bg} />)}
          </PillStatRow>

          <div className="toolbar-card catalog-toolbar-card mb-3">
            <div className="row g-2 align-items-end">
              <div className="col-md-4">
                <label className="toolbar-label">Search</label>
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-white border-end-0 catalog-toolbar-icon">Find</span>
                  <input type="text" className="form-control border-start-0 toolbar-input" placeholder="Name, type, description..." value={query} onChange={(event) => setQuery(event.target.value)} />
                </div>
              </div>
              <div className="col-md-2">
                <label className="toolbar-label">Type</label>
                <select className="form-select form-select-sm toolbar-select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                  <option value="">All Types</option>
                  {SVC_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div className="col-md-2">
                <label className="toolbar-label">Car Type</label>
                <select className="form-select form-select-sm toolbar-select" value={carFilter} onChange={(event) => setCarFilter(event.target.value)}>
                  <option value="">All Vehicles</option>
                  {CAR_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div className="col-md-2">
                <label className="toolbar-label">Status</label>
                <select className="form-select form-select-sm toolbar-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
              <div className="col-md-2">
                <button type="button" className="btn-reset w-100" onClick={resetFilters}>Reset</button>
              </div>
            </div>
          </div>

          <div className="catalog-layout">
            <div>
              <div className="results-bar">
                <small className="text-muted">{visible.length ? `Showing ${((page - 1) * PAGE_SIZE) + 1}-${Math.min(page * PAGE_SIZE, visible.length)} of ${visible.length} services` : '0 services'}</small>
                <div className="d-flex gap-1 flex-wrap">{activePills.map((pill) => <span key={pill} className="filter-pill">{pill}</span>)}</div>
              </div>

              {loading ? <div className="section-card"><PageSpinner /></div> : !visible.length ? <div className="catalog-empty-state"><h6 className="mb-1">No services found</h6><p className="mb-3">Try adjusting your search or filters.</p><button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetFilters}>Clear Filters</button></div> : <div className="catalog-list">{pagedItems.map((item) => {
                const meta = TYPE_META[item.serviceType] || TYPE_META.SERVICING
                const active = item.isActive !== false
                return <article key={item.catalogId} className={`catalog-card ${!active ? 'inactive' : ''}`}><div className="catalog-accent" style={{ background: active ? meta.accent : '#94a3b8' }} /><div className="catalog-body"><div className="catalog-main"><div className="catalog-top"><span className="catalog-type-pill" style={{ background: meta.soft, color: meta.accent }}>{item.serviceType}</span>{!active ? <span className="catalog-inactive-pill">INACTIVE</span> : null}</div><div className="catalog-title">{item.serviceName}</div><div className="catalog-sub">{item.carType || 'ALL'} · Duration {Number(item.durationHours || 0).toFixed(1)}h</div><div className="catalog-description">{item.description || 'No description provided.'}</div></div><div className="catalog-price-block"><div className="catalog-price">{formatCurrency(item.basePrice)}</div><div className="catalog-price-sub">Booking charge {formatCurrency(item.bookingCharge || FIXED_BOOKING_CHARGE)}</div></div><div className="catalog-actions"><ActionIconButton icon="edit" label="Edit service" onClick={() => openEdit(item)} /><ActionIconButton icon={active ? 'deactivate' : 'activate'} label={active ? 'Deactivate service' : 'Activate service'} className="action-warning" onClick={() => requestToggle(item)} /><ActionIconButton icon="delete" label="Delete service" className="action-danger" onClick={() => requestDelete(item)} /></div></div></article>
              })}</div>}
              <PaginationControls page={page} totalItems={visible.length} pageSize={PAGE_SIZE} totalPages={totalPages} onPageChange={setPage} />
            </div>

            <aside className="catalog-sidebar">
              <div className="sidebar-card">
                <div className="sidebar-title">Type Breakdown</div>
                <div className="d-flex flex-column gap-3">
                  {typeBreakdown.map(({ type, count }) => {
                    const total = visible.length || 1
                    const meta = TYPE_META[type]
                    return <div key={type}><div className="d-flex justify-content-between small fw-semibold mb-1"><span>{type}</span><span>{count}</span></div><div className="catalog-progress-track"><div className="catalog-progress-fill" style={{ width: `${Math.round((count / total) * 100)}%`, background: meta?.accent || '#94a3b8' }} /></div></div>
                  })}
                </div>
              </div>

              <div className="sidebar-card">
                <div className="sidebar-title">Duration Mix</div>
                <div className="d-flex flex-column gap-3">
                  {durationBuckets.map(([label, count], index) => <div key={label}><div className="d-flex justify-content-between small fw-semibold mb-1"><span>{label}</span><span>{count}</span></div><div className="catalog-progress-track"><div className="catalog-progress-fill" style={{ width: `${visible.length ? Math.round((count / visible.length) * 100) : 0}%`, background: ['#16a34a', '#d97706', '#7c3aed'][index] }} /></div></div>)}
                </div>
              </div>

              <div className="sidebar-card">
                <div className="sidebar-title">Recent Services</div>
                {!recentServices.length ? <p className="text-muted small text-center mb-0">No services yet</p> : <div className="d-flex flex-column gap-3">{recentServices.map((item) => <div key={item.catalogId} className="catalog-recent-row"><div className="catalog-recent-icon" style={{ background: (TYPE_META[item.serviceType] || TYPE_META.SERVICING).soft, color: (TYPE_META[item.serviceType] || TYPE_META.SERVICING).accent }}>{(TYPE_META[item.serviceType] || TYPE_META.SERVICING).icon}</div><div className="flex-grow-1 min-w-0"><div className="catalog-recent-name">{item.serviceName}</div><div className="catalog-recent-meta">{item.carType || 'ALL'} · {formatCurrency(item.basePrice)}</div></div></div>)}</div>}
              </div>
            </aside>
          </div>

          {showModal ? <CatalogModal title={editItem ? 'Edit Service' : 'Add Service'} subtitle="Match the reference service setup and validation flow." onClose={() => guardNavigation(() => setShowModal(false))}><form onSubmit={submit}><div className="modal-body"><div className="row g-3"><div className="col-12"><label className="modal-form-label">Service Name</label><input className={`form-control modal-form-control ${errors.serviceName ? 'is-invalid' : ''}`} value={form.serviceName} maxLength={100} onChange={(event) => updateForm('serviceName', event.target.value)} />{errors.serviceName ? <div className="invalid-feedback d-block">{errors.serviceName}</div> : null}</div><div className="col-md-6"><label className="modal-form-label">Service Type</label><select className={`form-select modal-form-control ${errors.serviceType ? 'is-invalid' : ''}`} value={form.serviceType} onChange={(event) => updateForm('serviceType', event.target.value)}>{SVC_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select>{errors.serviceType ? <div className="invalid-feedback d-block">{errors.serviceType}</div> : null}</div><div className="col-md-6"><label className="modal-form-label">Car Type</label><select className={`form-select modal-form-control ${errors.carType ? 'is-invalid' : ''}`} value={form.carType} onChange={(event) => updateForm('carType', event.target.value)}>{CAR_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select>{errors.carType ? <div className="invalid-feedback d-block">{errors.carType}</div> : null}</div><div className="col-md-6"><label className="modal-form-label">Base Price (INR)</label><input type="number" className={`form-control modal-form-control ${errors.basePrice ? 'is-invalid' : ''}`} value={form.basePrice} min={0} onChange={(event) => updateForm('basePrice', event.target.value)} />{errors.basePrice ? <div className="invalid-feedback d-block">{errors.basePrice}</div> : null}</div><div className="col-md-6"><label className="modal-form-label">Duration (Hours)</label><input type="number" step="0.5" className={`form-control modal-form-control ${errors.durationHours ? 'is-invalid' : ''}`} value={form.durationHours} min={0.5} onChange={(event) => updateForm('durationHours', event.target.value)} />{errors.durationHours ? <div className="invalid-feedback d-block">{errors.durationHours}</div> : null}</div><div className="col-12"><label className="modal-form-label">Description</label><textarea className={`form-control modal-form-control ${errors.description ? 'is-invalid' : ''}`} rows={3} value={form.description} onChange={(event) => updateForm('description', event.target.value)} />{errors.description ? <div className="invalid-feedback d-block">{errors.description}</div> : null}</div><div className="col-12"><div className="catalog-booking-note">Booking charge is fixed at {formatCurrency(FIXED_BOOKING_CHARGE)} for all catalog services.</div></div></div></div><div className="modal-footer"><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => guardNavigation(() => setShowModal(false))}>Cancel</button><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setForm(editItem ? { ...form } : BLANK); setErrors({}) }}>Reset</button><button type="submit" className="catalog-save-btn" disabled={saving}>{saving ? 'Saving...' : editItem ? 'Update Service' : 'Create Service'}</button></div></form></CatalogModal> : null}
          {confirmState ? <ConfirmModal title={confirmState.title} body={confirmState.body} confirmLabel={confirmState.confirmLabel} danger={confirmState.danger} saving={saving} onClose={() => guardNavigation(() => setConfirmState(null))} onConfirm={handleConfirm} /> : null}
        </PageContent>
      </div>
    </AdminLayout>
  )
}



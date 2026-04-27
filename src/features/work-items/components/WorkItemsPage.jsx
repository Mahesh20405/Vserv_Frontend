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
import { validateWorkItemForm } from '../../../utils/adminValidation'
import { useNavigationGuard } from '../../../hooks/useNavigationGuard'
import '../../../styles/features/work-items/WorkItemsPage.css'
import { workItemService } from '../services/workItemService'
import { CAR_TYPES as BASE_CAR_TYPES } from '../../../config/constants'

const CAR_TYPES = [...BASE_CAR_TYPES, 'ALL']

const ITEM_TYPES = ['PART', 'LABOR', 'CONSUMABLE']
const BLANK = { itemName: '', itemType: 'PART', carType: 'ALL', unitPrice: '', description: '' }
const TYPE_META = {
  PART: { icon: 'PT', accent: '#2563eb', soft: '#dbeafe' },
  LABOR: { icon: 'LB', accent: '#16a34a', soft: '#dcfce7' },
  CONSUMABLE: { icon: 'CS', accent: '#d97706', soft: '#fef3c7' },
}
const PAGE_SIZE = 8

function WorkItemModal({ title, subtitle, children, onClose }) {
  return <Modal title={title} subtitle={subtitle} onClose={onClose} open>{children}</Modal>
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

export function WorkItemsPage() {
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
  const isWorkItemDirty = Boolean(showModal && (
    editItem
      ? (
        form.itemName !== (editItem.itemName || '') ||
        form.itemType !== (editItem.itemType || 'PART') ||
        form.carType !== (editItem.carType || 'ALL') ||
        String(form.unitPrice) !== String(editItem.unitPrice ?? '') ||
        form.description !== (editItem.description || '')
      )
      : Object.values(form).some((value) => String(value || '').trim() !== '')
  ))
  const guardNavigation = useNavigationGuard(
    Boolean(saving || confirmState || isWorkItemDirty),
    'A work item change is still in progress. Leaving now may discard it. Continue?'
  )

  async function load() {
    setLoading(true)
    try {
      const response = await workItemService.list()
      setItems(response.data || [])
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to load work items.', 'error')
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
        if (typeFilter && item.itemType !== typeFilter) return false
        if (carFilter && item.carType !== carFilter) return false
        if (statusFilter === 'ACTIVE' && !active) return false
        if (statusFilter === 'INACTIVE' && active) return false
        if (!q) return true
        return [item.itemName, item.description, item.itemType, item.carType].filter(Boolean).join(' ').toLowerCase().includes(q)
      })
      .sort((left, right) => Number(right.workItemId || 0) - Number(left.workItemId || 0))
  }, [items, query, typeFilter, carFilter, statusFilter])

  const counts = useMemo(() => ({
    total: items.length,
    active: items.filter((item) => item.isActive !== false).length,
    PART: items.filter((item) => item.itemType === 'PART').length,
    LABOR: items.filter((item) => item.itemType === 'LABOR').length,
    CONSUMABLE: items.filter((item) => item.itemType === 'CONSUMABLE').length,
  }), [items])

  const activePills = []
  if (typeFilter) activePills.push(typeFilter)
  if (carFilter) activePills.push(carFilter)
  if (statusFilter) activePills.push(statusFilter === 'ACTIVE' ? 'Active' : 'Inactive')
  if (query.trim()) activePills.push(`"${query.trim()}"`)

  const typeBreakdown = useMemo(() => ITEM_TYPES.map((type) => ({
    type,
    count: visible.filter((item) => item.itemType === type).length,
  })), [visible])

  const carBreakdown = useMemo(() => CAR_TYPES.filter((type) => type !== 'ALL').map((type) => ({
    type,
    count: visible.filter((item) => item.carType === type || item.carType === 'ALL').length,
  })).filter((entry) => entry.count > 0).slice(0, 6), [visible])

  const recentItems = useMemo(() => [...items].slice().sort((a, b) => Number(b.workItemId || 0) - Number(a.workItemId || 0)).slice(0, 5), [items])
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
      itemName: item.itemName || '',
      itemType: item.itemType || 'PART',
      carType: item.carType || 'ALL',
      unitPrice: item.unitPrice ?? '',
      description: item.description || '',
    })
    setErrors({})
    setShowModal(true)
  }

  async function submit(event) {
    event.preventDefault()
    const { errors: nextErrors, isValid } = validateWorkItemForm(form, items, editItem?.workItemId ?? null)
    if (!isValid) {
      setErrors(nextErrors)
      return
    }

    setSaving(true)
    try {
      const body = { ...form, unitPrice: Number(form.unitPrice) }
      if (editItem) {
        await workItemService.update(editItem.workItemId, body)
        toast('Work item updated successfully.')
      } else {
        await workItemService.create(body)
        toast('Work item created successfully.')
      }
      setShowModal(false)
      await load()
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to save work item.', 'error')
    } finally {
      setSaving(false)
    }
  }

  function requestToggle(item) {
    const active = item.isActive !== false
    setConfirmState({
      mode: 'toggle',
      item,
      title: active ? 'Deactivate Work Item' : 'Activate Work Item',
      body: active ? `Deactivate ${item.itemName}? It will stay in history but stop appearing as an active catalog item.` : `Activate ${item.itemName} and make it usable again?`,
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
      await workItemService.toggle(confirmState.item.workItemId)
      toast(`Work item ${confirmState.item.isActive !== false ? 'deactivated' : 'activated'} successfully.`)
      setConfirmState(null)
      await load()
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to update work item.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminLayout activeKey="work-items">
      <div className="work-items-page">
        <AdminPageHero
          title="Work Items"
          subtitle="Manage parts, labor, and consumables available to service records and invoices."
          actions={<button type="button" className="admin-hero-btn" onClick={openCreate}>Add Item</button>}
        />
        <PageContent>
          <PillStatRow>
            {[
              { label: 'Total Items', value: counts.total, icon: 'TI', bg: '#fff0e6' },
              { label: 'Active Items', value: counts.active, icon: 'AC', bg: '#dcfce7' },
              { label: 'Parts', value: counts.PART, icon: 'PT', bg: '#dbeafe' },
              { label: 'Labor', value: counts.LABOR, icon: 'LB', bg: '#dcfce7' },
              { label: 'Consumables', value: counts.CONSUMABLE, icon: 'CS', bg: '#fef3c7' },
            ].map((item) => <PillStat key={item.label} label={item.label} value={item.value} color={item.bg} />)}
          </PillStatRow>

          <div className="toolbar-card work-items-toolbar-card mb-3">
            <div className="row g-2 align-items-end">
              <div className="col-md-4">
                <label className="toolbar-label">Search</label>
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-white border-end-0 work-items-toolbar-icon">Find</span>
                  <input type="text" className="form-control border-start-0 toolbar-input" placeholder="Name, type, description..." value={query} onChange={(event) => setQuery(event.target.value)} />
                </div>
              </div>
              <div className="col-md-2">
                <label className="toolbar-label">Type</label>
                <select className="form-select form-select-sm toolbar-select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                  <option value="">All Types</option>
                  {ITEM_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
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

          <div className="work-items-layout">
            <div>
              <div className="results-bar">
                <small className="text-muted">{visible.length ? `Showing ${((page - 1) * PAGE_SIZE) + 1}-${Math.min(page * PAGE_SIZE, visible.length)} of ${visible.length} items` : '0 items'}</small>
                <div className="d-flex gap-1 flex-wrap">{activePills.map((pill) => <span key={pill} className="filter-pill">{pill}</span>)}</div>
              </div>

              {loading ? <div className="section-card"><PageSpinner /></div> : !visible.length ? <div className="work-items-empty-state"><h6 className="mb-1">No work items found</h6><p className="mb-3">Try adjusting your search or filters.</p><button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetFilters}>Clear Filters</button></div> : <div className="work-items-list">{pagedItems.map((item) => {
                const meta = TYPE_META[item.itemType] || TYPE_META.PART
                const active = item.isActive !== false
                return <article key={item.workItemId} className={`work-item-card ${!active ? 'inactive' : ''}`}><div className="work-item-accent" style={{ background: active ? meta.accent : '#94a3b8' }} /><div className="work-item-body"><div className="work-item-main"><div className="work-item-top"><span className="work-item-type-pill" style={{ background: meta.soft, color: meta.accent }}>{item.itemType}</span>{!active ? <span className="work-item-inactive-pill">INACTIVE</span> : null}</div><div className="work-item-title">{item.itemName}</div><div className="work-item-sub">{item.carType || 'ALL'} compatible</div><div className="work-item-description">{item.description || 'No description provided.'}</div></div><div className="work-item-price-block"><div className="work-item-price">{formatCurrency(item.unitPrice)}</div><div className="work-item-price-sub">Unit price</div></div><div className="work-item-actions"><ActionIconButton icon="edit" label="Edit work item" onClick={() => openEdit(item)} /><ActionIconButton icon={active ? 'deactivate' : 'activate'} label={active ? 'Deactivate work item' : 'Activate work item'} className="action-warning" onClick={() => requestToggle(item)} /><ActionIconButton icon="delete" label="Delete work item" className="action-danger" onClick={() => requestDelete(item)} /></div></div></article>
              })}</div>}
              <PaginationControls page={page} totalItems={visible.length} pageSize={PAGE_SIZE} totalPages={totalPages} onPageChange={setPage} />
            </div>

            <aside className="work-items-sidebar">
              <div className="sidebar-card">
                <div className="sidebar-title">Type Breakdown</div>
                <div className="d-flex flex-column gap-3">
                  {typeBreakdown.map(({ type, count }) => {
                    const total = visible.length || 1
                    const meta = TYPE_META[type]
                    return <div key={type}><div className="d-flex justify-content-between small fw-semibold mb-1"><span>{type}</span><span>{count}</span></div><div className="work-items-progress-track"><div className="work-items-progress-fill" style={{ width: `${Math.round((count / total) * 100)}%`, background: meta?.accent || '#94a3b8' }} /></div></div>
                  })}
                </div>
              </div>

              <div className="sidebar-card">
                <div className="sidebar-title">Vehicle Coverage</div>
                {!carBreakdown.length ? <p className="text-muted small text-center mb-0">No coverage data</p> : <div className="d-flex flex-column gap-3">{carBreakdown.map(({ type, count }) => { const total = visible.length || 1; return <div key={type}><div className="d-flex justify-content-between small fw-semibold mb-1"><span>{type}</span><span>{count}</span></div><div className="work-items-progress-track"><div className="work-items-progress-fill" style={{ width: `${Math.round((count / total) * 100)}%`, background: '#f97316' }} /></div></div> })}</div>}
              </div>

              <div className="sidebar-card">
                <div className="sidebar-title">Recent Items</div>
                {!recentItems.length ? <p className="text-muted small text-center mb-0">No items yet</p> : <div className="d-flex flex-column gap-3">{recentItems.map((item) => <div key={item.workItemId} className="work-items-recent-row"><div className="work-items-recent-icon" style={{ background: (TYPE_META[item.itemType] || TYPE_META.PART).soft, color: (TYPE_META[item.itemType] || TYPE_META.PART).accent }}>{(TYPE_META[item.itemType] || TYPE_META.PART).icon}</div><div className="flex-grow-1 min-w-0"><div className="work-items-recent-name">{item.itemName}</div><div className="work-items-recent-meta">{item.itemType} · {formatCurrency(item.unitPrice)}</div></div></div>)}</div>}
              </div>
            </aside>
          </div>

          {showModal ? <WorkItemModal title={editItem ? 'Edit Work Item' : 'Add Work Item'} subtitle="Keep work item naming, pricing, and compatibility consistent across admin flows." onClose={() => guardNavigation(() => setShowModal(false))}><form onSubmit={submit}><div className="modal-body"><div className="row g-3"><div className="col-12"><label className="modal-form-label">Item Name</label><input className={`form-control modal-form-control ${errors.itemName ? 'is-invalid' : ''}`} value={form.itemName} maxLength={100} onChange={(event) => updateForm('itemName', event.target.value)} />{errors.itemName ? <div className="invalid-feedback d-block">{errors.itemName}</div> : null}</div><div className="col-md-6"><label className="modal-form-label">Item Type</label><select className={`form-select modal-form-control ${errors.itemType ? 'is-invalid' : ''}`} value={form.itemType} onChange={(event) => updateForm('itemType', event.target.value)}>{ITEM_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select>{errors.itemType ? <div className="invalid-feedback d-block">{errors.itemType}</div> : null}</div><div className="col-md-6"><label className="modal-form-label">Car Type</label><select className={`form-select modal-form-control ${errors.carType ? 'is-invalid' : ''}`} value={form.carType} onChange={(event) => updateForm('carType', event.target.value)}>{CAR_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select>{errors.carType ? <div className="invalid-feedback d-block">{errors.carType}</div> : null}</div><div className="col-md-6"><label className="modal-form-label">Unit Price (INR)</label><input type="number" className={`form-control modal-form-control ${errors.unitPrice ? 'is-invalid' : ''}`} value={form.unitPrice} min={0} onChange={(event) => updateForm('unitPrice', event.target.value)} />{errors.unitPrice ? <div className="invalid-feedback d-block">{errors.unitPrice}</div> : null}</div><div className="col-12"><label className="modal-form-label">Description</label><textarea className={`form-control modal-form-control ${errors.description ? 'is-invalid' : ''}`} rows={3} value={form.description} onChange={(event) => updateForm('description', event.target.value)} />{errors.description ? <div className="invalid-feedback d-block">{errors.description}</div> : null}</div></div></div><div className="modal-footer"><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => guardNavigation(() => setShowModal(false))}>Cancel</button><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setForm(editItem ? { ...form } : BLANK); setErrors({}) }}>Reset</button><button type="submit" className="work-items-save-btn" disabled={saving}>{saving ? 'Saving...' : editItem ? 'Update Item' : 'Create Item'}</button></div></form></WorkItemModal> : null}
          {confirmState ? <ConfirmModal title={confirmState.title} body={confirmState.body} confirmLabel={confirmState.confirmLabel} danger={confirmState.danger} saving={saving} onClose={() => guardNavigation(() => setConfirmState(null))} onConfirm={handleConfirm} /> : null}
        </PageContent>
      </div>
    </AdminLayout>
  )
}



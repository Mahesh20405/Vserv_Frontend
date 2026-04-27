import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AdvisorLayout } from '../../../layouts/AppShell'
import { PageSpinner } from '../../../components/ui/Spinner'
import { useToast } from '../../../components/ui/Toast'
import { formatCurrency } from '../../../utils/formatters'
import { ActionIconButton } from '../../../components/ui/ActionIconButton'
import { serviceRecordService } from '../services/serviceRecordService'
import '../../../styles/features/service-records/ServiceRecords.css'
import { workItemService } from '../../work-items/services/workItemService'

const TYPE_COLORS = { PART: '#dbeafe', LABOR: '#dcfce7', CONSUMABLE: '#fef3c7' }

export function ManageServicePage() {
  const toast = useToast()
  const [params] = useSearchParams()
  const preselectedId = params.get('serviceId') ? Number(params.get('serviceId')) : null
  const [inProgressRecords, setInProgressRecords] = useState([])
  const [workItems, setWorkItems] = useState([])
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [bom, setBom] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [q, setQ] = useState('')
  const [remarks, setRemarks] = useState('')
  const [remarksSaving, setRemarksSaving] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    Promise.all([
      serviceRecordService.list({ status: 'IN_PROGRESS' }),
      workItemService.list({ activeOnly: true }),
    ]).then(async ([rRes, wRes]) => {
      const records = rRes.data || []
      setInProgressRecords(records)
      setWorkItems(wRes.data || [])
      if (preselectedId) {
        const match = records.find((r) => r.serviceId === preselectedId)
        if (match) await selectRecord(match)
      }
    }).finally(() => setLoading(false))
  }, [])

  async function selectRecord(rec) {
    setSelectedRecord(rec)
    const [itemsRes, detailRes] = await Promise.all([
      serviceRecordService.getItems(rec.serviceId),
      serviceRecordService.getById(rec.serviceId),
    ])
    const existing = (itemsRes.data || []).map((item) => ({
      workItemId: item.workItemId || item.workItem?.workItemId,
      itemName: item.itemName || item.workItem?.itemName || 'Item',
      itemType: item.itemType || item.workItem?.itemType || 'PART',
      unitPrice: Number(item.unitPrice),
      quantity: item.quantity || 1,
      totalPrice: Number(item.totalPrice || Number(item.unitPrice) * (item.quantity || 1)),
    }))
    setBom(existing)
    setRemarks(detailRes.data?.remarks || '')
  }

  function addItem(wi) {
    if (!selectedRecord) {
      toast('Please select an in-progress service first.', 'error')
      return
    }
    const existing = bom.find((b) => b.workItemId === wi.workItemId)
    if (existing) {
      setBom((prev) => prev.map((b) => b.workItemId === wi.workItemId ? { ...b, quantity: b.quantity + 1, totalPrice: Number(wi.unitPrice) * (b.quantity + 1) } : b))
    } else {
      setBom((prev) => [...prev, { workItemId: wi.workItemId, itemName: wi.itemName, itemType: wi.itemType, unitPrice: Number(wi.unitPrice), quantity: 1, totalPrice: Number(wi.unitPrice) }])
    }
  }

  function updateQty(workItemId, qty) {
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) return
    setBom((prev) => prev.map((b) => b.workItemId === workItemId ? { ...b, quantity: qty, totalPrice: b.unitPrice * qty } : b))
  }

  function removeItem(workItemId) {
    setBom((prev) => prev.filter((b) => b.workItemId !== workItemId))
  }

  async function saveBOM() {
    if (!selectedRecord) return
    if (!bom.length) {
      toast('Add at least one BOM item before saving.', 'error')
      return
    }
    setSaving(true)
    try {
      await serviceRecordService.saveItems(selectedRecord.serviceId, {
        items: bom.map((b) => ({ workItemId: b.workItemId, quantity: b.quantity, unitPrice: b.unitPrice, totalPrice: b.totalPrice })),
      })
      toast('BOM saved!')
      setErrors((prev) => ({ ...prev, bom: '' }))
      await selectRecord(selectedRecord)
    } catch (err) {
      toast(err.response?.data?.message || 'Failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function saveRemarks() {
    if (!selectedRecord) return
    if (remarks.trim().length > 300) {
      setErrors((prev) => ({ ...prev, remarks: 'Remarks must be 300 characters or fewer.' }))
      return
    }
    setRemarksSaving(true)
    try {
      const r = await serviceRecordService.updateRemarks(selectedRecord.serviceId, { remarks })
      setSelectedRecord(r.data)
      setErrors((prev) => ({ ...prev, remarks: '' }))
      toast('Remarks saved!')
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to save remarks', 'error')
    } finally {
      setRemarksSaving(false)
    }
  }

  const total = bom.reduce((s, b) => s + Number(b.totalPrice || 0), 0)
  const filteredItems = workItems.filter((wi) => !q || wi.itemName.toLowerCase().includes(q.toLowerCase()))

  return (
    <AdvisorLayout activeKey="services">
      <div style={{ background: 'var(--primary-dark-gradient)', color: '#fff', padding: '20px 28px 16px' }}>
        <h4 className="mb-0 fw-bold">Manage Service Items</h4>
        <div style={{ opacity: 0.86, fontSize: 'var(--fs-label)', marginTop: 2 }}>Add, modify, or remove items from the bill of materials.</div>
      </div>
      <div className="page-shell">
        <div className="toolbar-card">
          <label className="form-label fw-semibold label-sm">Active Service</label>
          <select className="form-select form-select-sm" style={{ maxWidth: 400 }} value={selectedRecord?.serviceId || ''} onChange={(e) => { const r = inProgressRecords.find((record) => record.serviceId === Number(e.target.value)); if (r) selectRecord(r) }}>
            <option value="">- select in-progress service -</option>
            {inProgressRecords.map((r) => <option key={r.serviceId} value={r.serviceId}>SR-{r.serviceId} · {r.vehicleInfo} · {r.serviceName}</option>)}
          </select>
        </div>

        {loading ? <PageSpinner /> : (
          <div className="row g-3">
            <div className="col-lg-6">
              <div className="section-card">
                <div className="section-header"><span className="section-title">Work Item Catalog</span></div>
                <div className="section-body">
                  <div className="search-bar mb-3">
                    <span className="search-bar-icon">Search</span>
                    <input className="form-control form-control-sm" placeholder="Search items..." value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 56 }} />
                  </div>
                  <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {filteredItems.map((wi) => (
                      <div key={wi.workItemId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff' }}>
                        <span className="badge" style={{ background: TYPE_COLORS[wi.itemType] || '#f3f4f6', color: '#374151', fontSize: '0.65rem' }}>{wi.itemType}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 'var(--fs-label)', fontWeight: 600 }}>{wi.itemName}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--neutral-medium)' }}>{wi.carType} · {formatCurrency(wi.unitPrice)}/unit</div>
                        </div>
                        <ActionIconButton icon="add" label="Add item to BOM" className="action-primary" disabled={!selectedRecord} onClick={() => addItem(wi)} />
                      </div>
                    ))}
                    {!filteredItems.length && <div className="empty-sm">No items found</div>}
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="section-card mb-3">
                <div className="section-header">
                  <span className="section-title">Bill of Materials</span>
                  {selectedRecord && <span style={{ fontSize: '0.75rem', color: 'var(--neutral-medium)' }}>SR-{selectedRecord.serviceId}</span>}
                </div>
                <div className="section-body p-0">
                  {bom.length ? (
                    <table className="vserv-table w-100">
                      <thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Total</th><th /></tr></thead>
                      <tbody>
                        {bom.map((b) => (
                          <tr key={b.workItemId}>
                            <td className="text-xs">{b.itemName}</td>
                            <td>
                              <input type="number" min={1} max={99} value={b.quantity} onChange={(e) => updateQty(b.workItemId, Number(e.target.value))} style={{ width: 56, padding: '2px 4px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 'var(--fs-meta)' }} />
                            </td>
                            <td className="text-xs">{formatCurrency(b.unitPrice)}</td>
                            <td style={{ fontWeight: 600, fontSize: 'var(--fs-meta)', color: 'var(--primary-accent)' }}>{formatCurrency(b.totalPrice)}</td>
                            <td><ActionIconButton icon="delete" label="Remove item from BOM" className="action-danger" onClick={() => removeItem(b.workItemId)} /></td>
                          </tr>
                        ))}
                        <tr style={{ background: '#f9fafb' }}>
                          <td colSpan={3} style={{ fontWeight: 700, fontSize: 'var(--fs-label)', textAlign: 'right', padding: '10px 12px' }}>Items Total</td>
                          <td style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary-accent)', padding: '10px 12px' }}>{formatCurrency(total)}</td>
                          <td />
                        </tr>
                      </tbody>
                    </table>
                  ) : <div className="empty-sm">{selectedRecord ? 'No items added yet. Pick from the catalog.' : 'Select a service record first.'}</div>}
                </div>
                {selectedRecord && (
                  <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0' }}>
                    <div className="action-strip justify-content-end">
                      <ActionIconButton icon="save" label={saving ? 'Saving BOM...' : 'Save BOM'} className="action-success" disabled={saving || !bom.length} onClick={saveBOM} />
                    </div>
                  </div>
                )}
              </div>

              <div className="section-card">
                <div className="section-header"><span className="section-title">Service Remarks</span></div>
                <div className="section-body">
                  <textarea className={`form-control form-control-sm ${errors.remarks ? 'is-invalid' : ''}`} rows={4} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Observations, customer notes, or service updates..." disabled={!selectedRecord} />
                  {errors.remarks && <div className="invalid-feedback">{errors.remarks}</div>}
                  <div className="text-muted small mt-1">{remarks.trim().length}/300</div>
                  <div className="action-strip mt-3 justify-content-end">
                    <ActionIconButton icon="save" label={remarksSaving ? 'Saving remarks...' : 'Save remarks'} className="action-primary" disabled={!selectedRecord || remarksSaving} onClick={saveRemarks} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdvisorLayout>
  )
}



import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AdvisorLayout } from '../../../layouts/AppShell'
import { PageSpinner } from '../../../components/ui/Spinner'
import { StatusBadge } from '../../../components/ui/Badge'
import { useToast } from '../../../components/ui/Toast'
import { formatCurrency, formatDate } from '../../../utils/formatters'
import { serviceRecordService } from '../services/serviceRecordService'
import '../../../styles/features/service-records/ServiceRecords.css'

function CompleteConfirmModal({ record, hours, saving, onClose, onConfirm }) {
  return (
    <div className="modal fade show d-block advisor-complete-modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-dialog modal-dialog-centered modal-sm">
        <div className="modal-content">
          <div className="modal-header text-white" style={{ background: 'var(--primary-dark-gradient)' }}>
            <h5 className="modal-title fw-semibold">Confirm Completion</h5>
          </div>
          <div className="modal-body text-center py-4">
            <h6 className="fw-bold mb-2">Mark service as completed?</h6>
            <p className="text-muted small mb-0">
              Complete {record?.vehicleInfo || `SR-${record?.serviceId}`} with {hours} actual hours and notify admin for invoice processing.
            </p>
          </div>
          <div className="modal-footer justify-content-center gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={onConfirm}>
              {saving ? 'Completing...' : 'Yes, Complete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function stepClass(done, active) {
  if (done) return 'advisor-complete-step done'
  if (active) return 'advisor-complete-step active'
  return 'advisor-complete-step'
}

function toBomItem(item) {
  return {
    workItemId: item.workItemId || item.workItem?.workItemId,
    itemName: item.itemName || item.workItem?.itemName || `Item #${item.workItemId}`,
    itemType: item.itemType || item.workItem?.itemType || 'PART',
    quantity: Number(item.quantity || 1),
    unitPrice: Number(item.unitPrice || 0),
    totalPrice: Number(item.totalPrice || Number(item.unitPrice || 0) * Number(item.quantity || 1)),
  }
}

export function CompleteServicePage() {
  const nav = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const preselectedId = params.get('serviceId') ? Number(params.get('serviceId')) : null

  const [records, setRecords] = useState([])
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [bom, setBom] = useState([])
  const [loading, setLoading] = useState(true)
  const [actualHours, setActualHours] = useState('')
  const [remarks, setRemarks] = useState('')
  const [errors, setErrors] = useState({})
  const [completing, setCompleting] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [successData, setSuccessData] = useState(null)

  const inProgressRecords = useMemo(
    () => records.filter((record) => record.status === 'IN_PROGRESS'),
    [records],
  )

  const activeRecords = useMemo(
    () => records.filter((record) => !['COMPLETED', 'CANCELLED'].includes(record.status)),
    [records],
  )

  async function loadRecords() {
    setLoading(true)
    try {
      const response = await serviceRecordService.list()
      const nextRecords = response.data || []
      setRecords(nextRecords)

      if (preselectedId) {
        const match = nextRecords.find((record) => record.serviceId === preselectedId && record.status === 'IN_PROGRESS')
        if (match) {
          await selectRecord(match)
        }
      }
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to load advisor services.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRecords()
  }, [])

  async function selectRecord(record) {
    try {
      const [itemsRes, detailRes] = await Promise.all([
        serviceRecordService.getItems(record.serviceId),
        serviceRecordService.getById(record.serviceId),
      ])

      const details = detailRes.data || {}
      setSelectedRecord({ ...record, ...details })
      setBom((itemsRes.data || []).map(toBomItem))
      setActualHours(
        details.actualHours != null
          ? String(details.actualHours)
          : details.estimatedHours != null
            ? String(details.estimatedHours)
            : '',
      )
      setRemarks(details.remarks || '')
      setErrors({})
      setShowConfirmModal(false)
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to load service details.', 'error')
    }
  }

  function resetWorkflow() {
    setSelectedRecord(null)
    setBom([])
    setActualHours('')
    setRemarks('')
    setErrors({})
    setShowConfirmModal(false)
    setSuccessData(null)
  }

  const selectedHours = Number(actualHours)
  const estimatedHours = Number(
    selectedRecord?.estimatedHours
      ?? (selectedRecord?.service?.duration ? selectedRecord.service.duration / 60 : Number.NaN),
  )
  const hoursValid = Number.isFinite(selectedHours) && selectedHours >= 0.1 && selectedHours <= 24
  const overtimeHours = Number.isFinite(estimatedHours) && estimatedHours > 0 && hoursValid && selectedHours > estimatedHours
    ? selectedHours - estimatedHours
    : 0
  const itemsTotal = bom.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0)
  const checklist = {
    selected: Boolean(selectedRecord),
    items: bom.length > 0,
    hours: hoursValid,
  }
  const currentStep = !checklist.selected ? 1 : !checklist.items ? 2 : !checklist.hours ? 3 : 4

  function validateForm() {
    const nextErrors = {}

    if (!selectedRecord) nextErrors.selectedRecord = 'Please select a service record.'
    if (!bom.length) nextErrors.bom = 'Add BOM items before completing the service.'
    if (!hoursValid) nextErrors.actualHours = 'Actual hours must be between 0.1 and 24.'
    if (remarks.trim().length > 300) nextErrors.remarks = 'Remarks must be 300 characters or fewer.'

    setErrors(nextErrors)
    return !Object.keys(nextErrors).length
  }

  function validateHoursField() {
    setErrors((current) => ({
      ...current,
      actualHours: hoursValid ? '' : 'Actual hours must be between 0.1 and 24.',
    }))
  }

  function handleActualHoursChange(value) {
    setActualHours(value)
    setErrors((current) => ({ ...current, actualHours: '' }))
  }

  function handleRemarksChange(value) {
    setRemarks(value)
    if (value.trim().length <= 300) {
      setErrors((current) => ({ ...current, remarks: '' }))
    }
  }

  function handleOpenConfirm() {
    if (!validateForm()) return
    setShowConfirmModal(true)
  }

  async function handleComplete() {
    if (!selectedRecord || !validateForm()) return

    setCompleting(true)
    try {
      const response = await serviceRecordService.complete(selectedRecord.serviceId, {
        actualHours: selectedHours,
        remarks: remarks.trim(),
        items: bom.map(({ workItemId, quantity, unitPrice, totalPrice }) => ({
          workItemId,
          quantity,
          unitPrice,
          totalPrice,
        })),
      })

      setShowConfirmModal(false)
      setSuccessData({
        invoiceId: response.data?.invoiceId,
        actualHours: selectedHours,
        record: selectedRecord,
      })
      toast(response.data?.invoiceId ? `Service completed. Invoice #${response.data.invoiceId} generated.` : 'Service completed successfully.')
      await loadRecords()
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to complete service.', 'error')
    } finally {
      setCompleting(false)
    }
  }

  async function handleCompleteAnother() {
    resetWorkflow()
    await loadRecords()
  }

  return (
    <AdvisorLayout activeKey="complete">
      <div className="advisor-hero advisor-hero--blue">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <h3 className="mb-1 fw-bold">Complete Service</h3>
            <div style={{ opacity: 0.88, fontSize: '0.88rem' }}>Close in-progress services and capture final hours.</div>
          </div>
        </div>
      </div>

      <div className="page-shell">
        {loading ? <PageSpinner /> : successData ? (
          <div className="advisor-success-panel text-center">
            <div className="advisor-complete-success-icon">OK</div>
            <h4 className="fw-bold mb-2">Service Completed</h4>
            <p className="mb-3 text-muted">
              {successData.record.vehicleInfo || `SR-${successData.record.serviceId}`} has been marked as completed with {successData.actualHours} actual hours.
              {successData.invoiceId ? ` Invoice #${successData.invoiceId} is ready for billing.` : ' Admin can now continue invoice processing.'}
            </p>
            <div className="d-flex justify-content-center gap-2 flex-wrap">
              <button type="button" className="btn btn-outline-secondary" onClick={handleCompleteAnother}>Complete Another</button>
            </div>
          </div>
        ) : (
          <div className="advisor-complete-layout">
            <div className="advisor-complete-main">
              <div className="section-card">
                <div className="section-header">
                  <span className="section-title">Completion Workflow</span>
                </div>
                <div className="section-body">
                  <div className="advisor-complete-tracker">
                    {[
                      ['Select', 1],
                      ['BOM', 2],
                      ['Hours', 3],
                      ['Confirm', 4],
                    ].map(([label, step], index, all) => (
                      <div key={label} className="advisor-complete-track-segment">
                        <div className={stepClass(step < currentStep, step === currentStep)}>
                          <div className="advisor-complete-step-circle">{step}</div>
                          <div className="advisor-complete-step-label">{label}</div>
                        </div>
                        {index < all.length - 1 ? (
                          <div className={`advisor-complete-step-line ${step < currentStep ? 'done' : ''}`} />
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="section-card">
                <div className="section-header">
                  <span className="section-title">Step 1 - Select In-Progress Service</span>
                </div>
                <div className="section-body">
                  {errors.selectedRecord ? <div className="alert alert-danger small py-2 mb-3">{errors.selectedRecord}</div> : null}
                  {!inProgressRecords.length ? (
                    <div className="empty-state">
                      <div className="empty-state-icon">Done</div>
                      <p className="mb-2">No in-progress services to complete.</p>
                    </div>
                  ) : (
                    <div className="advisor-complete-list">
                      {inProgressRecords.map((record) => (
                        <button
                          key={record.serviceId}
                          type="button"
                          className={`advisor-complete-select-row ${selectedRecord?.serviceId === record.serviceId ? 'selected' : ''}`}
                          onClick={() => selectRecord(record)}
                        >
                          <span className="advisor-complete-select-bar" />
                          <div className="advisor-complete-select-avatar">
                            {String(record.vehicleInfo || `SR${record.serviceId}`)
                              .split(' ')
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((part) => part[0])
                              .join('')
                              .toUpperCase() || 'SR'}
                          </div>
                          <div className="advisor-complete-select-copy">
                            <div className="advisor-complete-select-title">{record.vehicleInfo || `SR-${record.serviceId}`}</div>
                            <div className="advisor-complete-select-meta">
                              {record.serviceName || 'Service'} | {formatDate(record.serviceStartDate || record.createdAt)}
                            </div>
                            <div className={`advisor-complete-select-note ${record.status === 'IN_PROGRESS' ? 'is-good' : ''}`}>
                              {record.estimatedHours ? `Estimated ${record.estimatedHours} hrs` : 'Service in progress'}
                            </div>
                          </div>
                          <span className="advisor-complete-select-action">
                            {selectedRecord?.serviceId === record.serviceId ? 'Selected' : 'Select'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {selectedRecord ? (
                <>
                  <div className="section-card">
                    <div className="section-header">
                      <span className="section-title">Step 2 - Service Being Completed</span>
                      <StatusBadge status={selectedRecord.status} />
                    </div>
                    <div className="section-body">
                      <div className="advisor-complete-summary-grid">
                        {[
                          ['Vehicle', selectedRecord.vehicleInfo || '-'],
                          ['Service Record', `SR-${selectedRecord.serviceId}`],
                          ['Service', selectedRecord.serviceName || '-'],
                          ['Owner', selectedRecord.ownerName || '-'],
                          ['Start Date', formatDate(selectedRecord.serviceStartDate || selectedRecord.createdAt)],
                          ['Estimated Hours', Number.isFinite(estimatedHours) ? `${estimatedHours.toFixed(1)} hrs` : '-'],
                        ].map(([label, value]) => (
                          <div key={label} className="advisor-complete-info-chip">
                            <div className="advisor-complete-info-label">{label}</div>
                            <div className="advisor-complete-info-value">{value}</div>
                          </div>
                        ))}
                      </div>
                      {remarks ? <div className="advisor-complete-remarks mt-3"><strong>Remarks:</strong> {remarks}</div> : null}
                    </div>
                  </div>

                  <div className="section-card">
                    <div className="section-header">
                      <span className="section-title">Step 2 - Bill Of Materials Review</span>
                      <span className="advisor-complete-total">{bom.length ? formatCurrency(itemsTotal) : ''}</span>
                    </div>
                    <div className={`section-body ${bom.length ? 'p-0' : ''}`}>
                      {bom.length ? (
                        <div className="table-responsive">
                          <table className="vserv-table w-100">
                            <thead>
                              <tr>
                                <th>#</th>
                                <th>Item</th>
                                <th>Type</th>
                                <th className="text-center">Qty</th>
                                <th className="text-end">Unit</th>
                                <th className="text-end">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bom.map((item, index) => (
                                <tr key={`${item.workItemId}_${index}`}>
                                  <td>{index + 1}</td>
                                  <td className="fw-semibold">{item.itemName}</td>
                                  <td>{item.itemType}</td>
                                  <td className="text-center fw-bold">{item.quantity}</td>
                                  <td className="text-end">{formatCurrency(item.unitPrice)}</td>
                                  <td className="text-end fw-bold text-primary">{formatCurrency(item.totalPrice)}</td>
                                </tr>
                              ))}
                              <tr className="advisor-complete-grand-total">
                                <td colSpan={5} className="text-end fw-bold">Grand Total</td>
                                <td className="text-end fw-bold">{formatCurrency(itemsTotal)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="advisor-complete-warning">
                          <div className="fw-semibold mb-1">No service items added yet.</div>
                          <div className="small mb-3">Please add BOM items before completing this service.</div>
                          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => nav(`/advisor/manage-service?serviceId=${selectedRecord.serviceId}`)}>
                            Go to Manage Service Items
                          </button>
                        </div>
                      )}
                      {errors.bom ? <div className={`text-danger small mt-2 ${bom.length ? 'px-3 pb-3' : ''}`}>{errors.bom}</div> : null}
                    </div>
                  </div>

                  <div className="section-card">
                    <div className="section-header">
                      <span className="section-title">Step 3 - Record Actual Hours Worked</span>
                    </div>
                    <div className="section-body">
                      <div className="row g-3 align-items-start">
                        <div className="col-lg-4">
                          <label className="form-label fw-semibold text-xs">Actual Hours</label>
                          <input
                            type="number"
                            min={0.1}
                            max={24}
                            step={0.5}
                            className={`advisor-complete-hours-input ${errors.actualHours ? 'is-invalid' : ''}`}
                            value={actualHours}
                            onChange={(event) => handleActualHoursChange(event.target.value)}
                            onBlur={validateHoursField}
                            placeholder="0.0"
                          />
                          {errors.actualHours ? <div className="invalid-feedback d-block">{errors.actualHours}</div> : null}
                        </div>
                        <div className="col-lg-4">
                          <div className="advisor-complete-info-chip advisor-complete-info-chip-center">
                            <div className="advisor-complete-info-label">Estimated Hours</div>
                            <div className="advisor-complete-info-value">
                              {Number.isFinite(estimatedHours) ? `${estimatedHours.toFixed(1)} hrs` : '-'}
                            </div>
                          </div>
                        </div>
                        <div className="col-lg-4">
                          <div className={`advisor-complete-info-chip advisor-complete-info-chip-center ${overtimeHours ? 'advisor-complete-overtime' : ''}`}>
                            <div className="advisor-complete-info-label">Overtime</div>
                            <div className="advisor-complete-info-value">
                              {overtimeHours ? `+${overtimeHours.toFixed(1)} hrs` : '0 hrs'}
                            </div>
                          </div>
                        </div>
                        <div className="col-12">
                          <label className="form-label fw-semibold text-xs">Remarks / Observations</label>
                          <textarea
                            className={`form-control ${errors.remarks ? 'is-invalid' : ''}`}
                            rows={3}
                            value={remarks}
                            onChange={(event) => handleRemarksChange(event.target.value)}
                            placeholder="Any observations, service updates, or customer recommendations..."
                          />
                          {errors.remarks ? <div className="invalid-feedback">{errors.remarks}</div> : null}
                          <div className="text-muted small mt-1">{remarks.trim().length}/300</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="section-card advisor-complete-confirm-card">
                    <div className="section-header">
                      <span className="section-title">Step 4 - Confirm Completion</span>
                    </div>
                    <div className="section-body">
                      <p className="advisor-complete-confirm-copy">
                        Once marked as completed, admin can generate the invoice and close billing.
                      </p>
                      <div className="d-flex gap-2 flex-wrap">
                        <button
                          type="button"
                          className="btn btn-success"
                          disabled={!checklist.selected || !checklist.items || !checklist.hours}
                          onClick={handleOpenConfirm}
                        >
                          Mark as Completed
                        </button>
                        <button type="button" className="btn btn-outline-secondary" onClick={resetWorkflow}>
                          Cancel
                        </button>
                        <button type="button" className="btn btn-outline-secondary" onClick={() => nav(`/advisor/manage-service?serviceId=${selectedRecord.serviceId}`)}>
                          Edit BOM First
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <div className="advisor-complete-sidebar">
              <div className="section-card">
                <div className="section-body">
                  <div className="section-title mb-2">Services In Progress</div>
                  <div className="advisor-complete-sidebar-number">{inProgressRecords.length}</div>
                  <div className="advisor-queue-sub">Awaiting completion</div>
                </div>
              </div>

              <div className="section-card">
                <div className="section-body">
                  <div className="section-title mb-2">All Active Services</div>
                  {!activeRecords.length ? (
                    <p className="text-muted small mb-0 text-center">No active services.</p>
                  ) : (
                    <div className="advisor-complete-active-list">
                      {activeRecords.slice(0, 6).map((record) => (
                        <div key={record.serviceId} className="advisor-complete-active-row">
                          <div className="min-w-0">
                            <div className="advisor-complete-active-title">{record.vehicleInfo || `SR-${record.serviceId}`}</div>
                            <div className="advisor-complete-active-sub">{record.serviceName || 'Service'}</div>
                          </div>
                          <StatusBadge status={record.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="section-card advisor-complete-checklist-card">
                <div className="section-body">
                  <div className="section-title mb-2">Completion Checklist</div>
                  <div className="advisor-checklist">
                    {[
                      ['Service selected', checklist.selected],
                      ['BOM items added', checklist.items],
                      ['Actual hours entered', checklist.hours],
                    ].map(([label, done]) => (
                      <div key={label} className={`advisor-check ${done ? 'done' : ''}`}>
                        <span className="advisor-check-dot" />
                        <span>{done ? `OK ${label}` : label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showConfirmModal && selectedRecord ? (
        <CompleteConfirmModal
          record={selectedRecord}
          hours={selectedHours}
          saving={completing}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={handleComplete}
        />
      ) : null}
    </AdvisorLayout>
  )
}



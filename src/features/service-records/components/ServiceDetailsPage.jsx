import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AdvisorLayout } from '../../../layouts/AppShell'
import { PageSpinner } from '../../../components/ui/Spinner'
import { StatusBadge } from '../../../components/ui/Badge'
import { useToast } from '../../../components/ui/Toast'
import { formatCurrency, formatDateTime } from '../../../utils/formatters'
import { ActionIconButton } from '../../../components/ui/ActionIconButton'
import { bookingService } from '../../bookings/services/bookingService'
import { serviceRecordService } from '../services/serviceRecordService'
import '../../../styles/features/service-records/ServiceRecords.css'

const TRACKER = ['Booked', 'Assigned', 'In Progress', 'Completed']

function trackerIndex(status) {
  if (status === 'COMPLETED') return 3
  if (status === 'IN_PROGRESS') return 2
  return 1
}

export function ServiceDetailsPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const [record, setRecord] = useState(null)
  const [booking, setBooking] = useState(null)
  const [history, setHistory] = useState([])
  const [items, setItems] = useState([])
  const [allRecords, setAllRecords] = useState([])
  const [selectedId, setSelectedId] = useState(id ? Number(id) : null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    serviceRecordService.list().then((response) => setAllRecords(response.data || []))
  }, [])

  useEffect(() => {
    if (!selectedId) return
    setLoading(true)
    Promise.all([
      serviceRecordService.getById(selectedId),
      serviceRecordService.getItems(selectedId),
    ]).then(async ([recordResponse, itemsResponse]) => {
      const nextRecord = recordResponse.data
      setRecord(nextRecord)
      setItems(itemsResponse.data || [])
      if (nextRecord?.bookingId) {
        const [bookingResponse, historyResponse] = await Promise.all([
          bookingService.getById(nextRecord.bookingId),
          bookingService.getHistory(nextRecord.bookingId),
        ])
        setBooking(bookingResponse.data || null)
        setHistory(historyResponse.data || [])
      } else {
        setBooking(null)
        setHistory([])
      }
    }).catch((error) => {
      toast(error.response?.data?.message || 'Failed to load service details.', 'error')
    }).finally(() => setLoading(false))
  }, [selectedId])

  async function startService() {
    setStarting(true)
    try {
      await serviceRecordService.start(selectedId)
      toast('Service started successfully.')
      nav(`/advisor/manage-service?serviceId=${selectedId}`)
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to start service.', 'error')
    } finally {
      setStarting(false)
    }
  }

  const trackerState = useMemo(() => trackerIndex(record?.status), [record])
  const bomTotal = useMemo(() => items.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0), [items])

  return (
    <AdvisorLayout activeKey="dashboard">
      <div className="advisor-hero">
        <h3 className="mb-1 fw-bold">Service Details</h3>
        <div style={{ opacity: 0.88, fontSize: '0.88rem' }}>Review service progress, customer context, BOM, and next available actions from one advisor screen.</div>
      </div>

      <div className="page-shell">
        <div className="toolbar-card">
          <label className="form-label fw-semibold" style={{ fontSize: '0.8rem' }}>Select Service Record</label>
          <select className="form-select" value={selectedId || ''} onChange={(e) => setSelectedId(Number(e.target.value) || null)}>
            <option value="">Choose a service record</option>
            {allRecords.map((entry) => <option key={entry.serviceId} value={entry.serviceId}>SR-{entry.serviceId} · {entry.vehicleInfo || 'Vehicle'} · {entry.status}</option>)}
          </select>
        </div>

        {loading && selectedId ? <PageSpinner /> : !record ? (
          <div className="empty-state"><div className="empty-state-icon">Details</div><p>Select a service record to continue.</p></div>
        ) : (
          <div className="advisor-layout-grid">
            <div>
              <div className="section-card mb-3">
                <div className="section-header">
                  <span className="section-title">Service Progress</span>
                  <StatusBadge status={record.status} />
                </div>
                <div className="section-body">
                  <div className="tracker">
                    {TRACKER.map((label, index) => (
                      <div key={label} className={`tracker-step ${index <= trackerState ? (index === trackerState ? 'active' : 'done') : ''}`}>
                        <div className="tracker-dot">{index < trackerState ? 'OK' : index + 1}</div>
                        <div className="tracker-label">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="section-card mb-3">
                <div className="section-header">
                  <span className="section-title">Service Summary</span>
                  <span className="advisor-mini-value">SR-{record.serviceId}</span>
                </div>
                <div className="section-body">
                  <div className="advisor-kv-grid">
                    {[
                      ['Vehicle', record.vehicleInfo || '-'],
                      ['Customer', record.ownerName || '-'],
                      ['Service', record.serviceName || '-'],
                      ['Advisor', record.advisorName || '-'],
                      ['Booking Status', booking?.bookingStatus || '-'],
                      ['Time Slot', booking?.timeSlot || '-'],
                      ['Started At', formatDateTime(record.serviceStartDate)],
                      ['Ended At', formatDateTime(record.serviceEndDate)],
                      ['Estimated Hours', record.estimatedHours || '-'],
                      ['Actual Hours', record.actualHours || '-'],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <div className="detail-label">{label}</div>
                        <div className="detail-value">{value}</div>
                      </div>
                    ))}
                  </div>
                  {record.remarks ? <div className="advisor-public-note mt-3"><strong>Remarks:</strong> {record.remarks}</div> : null}
                  <div className="action-strip mt-3">
                    {record.status === 'PENDING' ? <ActionIconButton icon="start" label={starting ? 'Starting...' : 'Start service'} className="action-success" disabled={starting} onClick={startService} /> : null}
                    {record.status === 'IN_PROGRESS' ? <ActionIconButton icon="manage" label="Manage BOM" className="action-primary" onClick={() => nav(`/advisor/manage-service?serviceId=${record.serviceId}`)} /> : null}
                    {record.status === 'IN_PROGRESS' ? <ActionIconButton icon="confirm" label="Complete service" className="action-success" onClick={() => nav(`/advisor/complete-service?serviceId=${record.serviceId}`)} /> : null}
                    <ActionIconButton icon="back" label="Back to dashboard" onClick={() => nav('/advisor/dashboard')} />
                  </div>
                </div>
              </div>

              <div className="section-card">
                <div className="section-header">
                  <span className="section-title">Bill Of Materials</span>
                  <span className="advisor-mini-value">{items.length ? formatCurrency(bomTotal) : ''}</span>
                </div>
                <div className="section-body p-0">
                  {items.length ? (
                    <table className="vserv-table w-100">
                      <thead>
                        <tr><th>#</th><th>Item</th><th>Type</th><th>Qty</th><th>Unit</th><th>Total</th></tr>
                      </thead>
                      <tbody>
                        {items.map((item, index) => (
                          <tr key={`${item.workItemId || index}_${index}`}>
                            <td>{index + 1}</td>
                            <td>{item.itemName || item.workItem?.itemName || 'Item'}</td>
                            <td>{item.itemType || item.workItem?.itemType || '-'}</td>
                            <td>{item.quantity}</td>
                            <td>{formatCurrency(item.unitPrice)}</td>
                            <td style={{ fontWeight: 700, color: 'var(--primary-accent)' }}>{formatCurrency(item.totalPrice)}</td>
                          </tr>
                        ))}
                        <tr style={{ background: '#f8fafc' }}>
                          <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700 }}>Grand Total</td>
                          <td style={{ fontWeight: 700, color: 'var(--primary-accent)' }}>{formatCurrency(bomTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  ) : <div className="empty-sm">{record.status === 'COMPLETED' ? 'No BOM items were recorded.' : 'No BOM items added yet. Use Manage Service to build the BOM.'}</div>}
                </div>
              </div>
            </div>

            <aside className="advisor-sidebar-stack">
              <div className="section-card">
                <div className="section-header"><span className="section-title">Customer Snapshot</span></div>
                <div className="section-body">
                  <div className="advisor-side-row"><span className="advisor-mini-label">Customer</span><span className="advisor-mini-value">{booking?.ownerName || record.ownerName || '-'}</span></div>
                  <div className="advisor-side-row"><span className="advisor-mini-label">Vehicle</span><span className="advisor-mini-value">{booking?.vehicleInfo || record.vehicleInfo || '-'}</span></div>
                  <div className="advisor-side-row"><span className="advisor-mini-label">Slot</span><span className="advisor-mini-value">{booking?.timeSlot || '-'}</span></div>
                  <div className="advisor-side-row"><span className="advisor-mini-label">Booking Date</span><span className="advisor-mini-value">{formatDateTime(booking?.createdAt)}</span></div>
                </div>
              </div>

              <div className="section-card">
                <div className="section-header"><span className="section-title">Booking History</span></div>
                <div className="section-body">
                  {!history.length ? <div className="empty-sm">No booking history available.</div> : (
                    <div className="d-flex flex-column gap-3">
                      {history.slice(0, 6).map((entry) => (
                        <div key={entry.historyId || `${entry.actionType}_${entry.actionDate}`} className="list-item">
                          <div className="list-item-main">
                            <div className="list-item-title">{entry.actionType || 'Update'}</div>
                            <div className="list-item-sub">{entry.reason || 'Workflow update recorded.'}</div>
                          </div>
                          <div className="list-item-meta text-muted small">{formatDateTime(entry.actionDate)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </AdvisorLayout>
  )
}



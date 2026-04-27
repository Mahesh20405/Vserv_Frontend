import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdvisorLayout } from '../../../layouts/AppShell'
import { PageSpinner } from '../../../components/ui/Spinner'
import { StatusBadge } from '../../../components/ui/Badge'
import { useAuth } from '../../auth/hooks/useAuth'
import { useToast } from '../../../components/ui/Toast'
import { formatDateTime } from '../../../utils/formatters'
import { ActionIconButton } from '../../../components/ui/ActionIconButton'
import { PaginationControls } from '../../../components/ui/PaginationControls'
import { PillStat } from '../../../components/ui/PillStat'
import { PillStatRow } from '../../../components/ui/PillStatRow'
import { profileService } from '../../profile/services/profileService'
import { serviceRecordService } from '../../service-records/services/serviceRecordService'
import '../../../styles/features/dashboard/Dashboard.css'

const STATUS_COLORS = {
  PENDING: '#d97706',
  IN_PROGRESS: '#2563eb',
  COMPLETED: '#16a34a',
}
const PAGE_SIZE = 8
const STATUS_PRIORITY = {
  IN_PROGRESS: 0,
  PENDING: 1,
  COMPLETED: 2,
}

function recordSortTime(record) {
  return new Date(record.serviceStartDate || record.serviceEndDate || 0).getTime() || 0
}

export function AdvisorDashboardPage() {
  const { user } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [records, setRecords] = useState([])
  const [advisorMeta, setAdvisorMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState('priority')
  const [starting, setStarting] = useState(null)
  const [page, setPage] = useState(1)

  async function load() {
    setLoading(true)
    try {
      const [recordsResponse, profileResponse] = await Promise.all([
        serviceRecordService.list(),
        profileService.get(),
      ])
      const nextRecords = recordsResponse.data || []
      setRecords(nextRecords)
      setAdvisorMeta(profileResponse.data || null)
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to load advisor dashboard.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function startService(id) {
    setStarting(id)
    try {
      await serviceRecordService.start(id)
      toast('Service started successfully.')
      nav(`/advisor/manage-service?serviceId=${id}`)
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to start service.', 'error')
    } finally {
      setStarting(null)
    }
  }

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const next = records.filter((record) => {
      if (statusFilter && record.status !== statusFilter) return false
      if (!normalizedQuery) return true
      return [record.vehicleInfo, record.ownerName, record.serviceName, record.status]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    })

    next.sort((left, right) => {
      if (sortBy === 'priority') {
        const byStatus = (STATUS_PRIORITY[left.status] ?? 9) - (STATUS_PRIORITY[right.status] ?? 9)
        if (byStatus !== 0) return byStatus
        const leftTime = recordSortTime(left)
        const rightTime = recordSortTime(right)
        if (left.status === 'COMPLETED' && right.status === 'COMPLETED') {
          return rightTime - leftTime || Number(right.serviceId || 0) - Number(left.serviceId || 0)
        }
        return leftTime - rightTime || Number(right.serviceId || 0) - Number(left.serviceId || 0)
      }
      if (sortBy === 'oldest') return new Date(left.serviceStartDate || 0) - new Date(right.serviceStartDate || 0)
      if (sortBy === 'status') {
        const order = { IN_PROGRESS: 0, PENDING: 1, COMPLETED: 2 }
        return (order[left.status] ?? 9) - (order[right.status] ?? 9)
      }
      return new Date(right.serviceStartDate || 0) - new Date(left.serviceStartDate || 0)
    })

    return next
  }, [records, query, statusFilter, sortBy])

  const counts = useMemo(() => ({
    total: records.length,
    pending: records.filter((record) => record.status === 'PENDING').length,
    inProgress: records.filter((record) => record.status === 'IN_PROGRESS').length,
    completed: records.filter((record) => record.status === 'COMPLETED').length,
    todayPending: records.filter((record) => {
      const today = new Date().toDateString()
      return record.status !== 'COMPLETED' && record.serviceStartDate && new Date(record.serviceStartDate).toDateString() === today
    }).length,
  }), [records])

  const queueBreakdown = [
    ['Pending', counts.pending, '#d97706'],
    ['In Progress', counts.inProgress, '#2563eb'],
    ['Completed', counts.completed, '#16a34a'],
  ]

  const availabilityLabel = counts.pending + counts.inProgress > 0 ? 'ASSIGNED' : (advisorMeta?.availabilityStatus || 'AVAILABLE')
  const todayText = counts.todayPending > 0 ? `${counts.todayPending} service${counts.todayPending === 1 ? '' : 's'} scheduled today` : 'No services scheduled today'
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pagedRecords = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [query, statusFilter, sortBy])
  useEffect(() => { setPage((current) => Math.min(current, totalPages)) }, [totalPages])

  return (
    <AdvisorLayout activeKey="dashboard">
      <div className="advisor-hero advisor-hero--blue">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <h3 className="mb-1 fw-bold">Service Advisor Dashboard</h3>
            <div style={{ opacity: 0.88, fontSize: '0.88rem' }}>{greeting}, {user?.fullName?.split(' ')[0] || 'Advisor'} - here's your service queue.</div>
          </div>
          <button type="button" className="customer-hero-btn" onClick={() => nav('/advisor/manage-service')}>Manage Services</button>
        </div>
        <div className="advisor-hero-meta">
          <span className="advisor-chip">{availabilityLabel.replace('_', ' ')}</span>
          <span className="advisor-chip">{todayText}</span>
          <span className="advisor-chip">{records.length} total assigned services</span>
        </div>
      </div>

      <div className="page-shell">
        <PillStatRow>
          {[
            { icon: 'TA', label: 'Total Assigned', value: counts.total },
            { icon: 'PD', label: 'Pending', value: counts.pending },
            { icon: 'IP', label: 'In Progress', value: counts.inProgress },
            { icon: 'CP', label: 'Completed', value: counts.completed },
            { icon: 'TD', label: 'Today Due', value: counts.todayPending },
          ].map((item) => (
            <PillStat key={item.label} label={item.label} value={item.value} />
          ))}
        </PillStatRow>

        <div className="advisor-layout-grid">
          <div>
            <div className="toolbar-card">
              <div className="row g-2 align-items-end">
                <div className="col-md-5">
                  <label className="form-label fw-semibold text-xs">Search Queue</label>
                  <input className="form-control" placeholder="Vehicle, customer, service..." value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold text-xs">Status</label>
                  <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="">All statuses</option>
                    <option value="PENDING">Pending</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold text-xs">Sort</label>
                  <select className="form-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                    <option value="priority">Work priority</option>
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="status">By status</option>
                  </select>
                </div>
                <div className="col-md-1">
                  <button type="button" className="btn btn-outline-secondary w-100" onClick={() => { setQuery(''); setStatusFilter(''); setSortBy('priority') }}>Reset</button>
                </div>
              </div>
            </div>

            {loading ? <PageSpinner /> : (
              <div className="advisor-card-list">
                {pagedRecords.map((record) => (
                  <article key={record.serviceId} className="advisor-queue-card">
                    <div style={{ background: STATUS_COLORS[record.status] || '#94a3b8' }} />
                    <div className="advisor-queue-body">
                      <div className="advisor-queue-top">
                        <div>
                          <div className="advisor-queue-title">{record.vehicleInfo || `SR-${record.serviceId}`}</div>
                          <div className="advisor-queue-sub">{record.ownerName || 'Customer unavailable'} · {record.serviceName || 'Service'}</div>
                        </div>
                        <StatusBadge status={record.status} />
                      </div>

                      <div className="advisor-queue-meta-grid">
                        <div>
                          <div className="advisor-mini-label">Service Record</div>
                          <div className="advisor-mini-value">SR-{record.serviceId}</div>
                        </div>
                        <div>
                          <div className="advisor-mini-label">Start</div>
                          <div className="advisor-mini-value">{formatDateTime(record.serviceStartDate)}</div>
                        </div>
                        <div>
                          <div className="advisor-mini-label">End</div>
                          <div className="advisor-mini-value">{formatDateTime(record.serviceEndDate)}</div>
                        </div>
                        <div>
                          <div className="advisor-mini-label">Estimated Hours</div>
                          <div className="advisor-mini-value">{record.estimatedHours || '-'}</div>
                        </div>
                      </div>

                      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <div className="advisor-queue-sub">Showing {record.status === 'PENDING' ? 'start-first flow' : record.status === 'IN_PROGRESS' ? 'active BOM flow' : 'completed read-only flow'}</div>
                        <div className="action-strip">
                          <ActionIconButton icon="view" label="View details" className="action-primary" onClick={() => nav(`/advisor/service-details/${record.serviceId}`)} />
                          {record.status === 'PENDING' ? <ActionIconButton icon="start" label={starting === record.serviceId ? 'Starting...' : 'Start service'} className="action-success" disabled={starting === record.serviceId} onClick={() => startService(record.serviceId)} /> : null}
                          {record.status === 'IN_PROGRESS' ? <ActionIconButton icon="manage" label="Manage items" onClick={() => nav(`/advisor/manage-service?serviceId=${record.serviceId}`)} /> : null}
                          {record.status === 'IN_PROGRESS' ? <ActionIconButton icon="confirm" label="Complete service" className="action-success" onClick={() => nav(`/advisor/complete-service?serviceId=${record.serviceId}`)} /> : null}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}

                {!filtered.length ? <div className="empty-state"><div className="empty-state-icon">Queue</div><p>No services found. Try adjusting your filters.</p></div> : null}
              </div>
            )}
            <PaginationControls page={page} totalItems={filtered.length} pageSize={PAGE_SIZE} totalPages={totalPages} onPageChange={setPage} />
          </div>

          <aside className="advisor-sidebar-stack">
            <div className="section-card">
              <div className="section-header"><span className="section-title">Queue Breakdown</span></div>
              <div className="section-body">
                <div className="d-flex flex-column gap-3">
                  {queueBreakdown.map(([label, count, color]) => {
                    const total = records.length || 1
                    return (
                      <div key={label}>
                        <div className="d-flex justify-content-between small fw-semibold mb-1"><span>{label}</span><span>{count}</span></div>
                        <div className="advisor-progress"><span style={{ width: `${Math.round((count / total) * 100)}%`, background: color }} /></div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="section-card">
              <div className="section-header"><span className="section-title">Advisor Snapshot</span></div>
              <div className="section-body">
                <div className="advisor-side-row"><span className="advisor-mini-label">Specialization</span><span className="advisor-mini-value">{advisorMeta?.specialization || 'General'}</span></div>
                <div className="advisor-side-row"><span className="advisor-mini-label">Availability</span><span className="advisor-mini-value">{advisorMeta?.availabilityStatus || 'AVAILABLE'}</span></div>
                <div className="advisor-side-row"><span className="advisor-mini-label">Overtime Rate</span><span className="advisor-mini-value">{advisorMeta?.overtimeRate != null ? `Rs.${advisorMeta.overtimeRate}/hr` : '-'}</span></div>
                <div className="advisor-side-row"><span className="advisor-mini-label">Current Load</span><span className="advisor-mini-value">{advisorMeta?.currentLoad ?? counts.pending + counts.inProgress}</span></div>
              </div>
            </div>

            <div className="section-card">
              <div className="section-header"><span className="section-title">Quick Actions</span></div>
              <div className="section-body d-flex flex-column gap-2">
                <button type="button" className="btn btn-sm btn-primary" onClick={() => nav('/advisor/manage-service')}>Manage Service Items</button>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => nav('/advisor/complete-service')}>Complete a Service</button>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => nav('/advisor/service-details')}>Service Details</button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </AdvisorLayout>
  )
}



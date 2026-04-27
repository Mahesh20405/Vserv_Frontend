import { useEffect, useMemo, useState } from 'react'
import { AdminLayout } from '../../../layouts/AppShell'
import { PageHero, PageContent } from '../../../components/common/PageElements'
import { PageSpinner } from '../../../components/ui/Spinner'
import { PillStat } from '../../../components/ui/PillStat'
import { PillStatRow } from '../../../components/ui/PillStatRow'
import { SearchToolbar } from '../../../components/ui/SearchToolbar'
import { ResultsBar } from '../../../components/ui/ResultsBar'
import { EmptyState } from '../../../components/ui/EmptyState'
import { SidebarProgressCard } from '../../../components/ui/SidebarProgressCard'
import { SidebarListCard } from '../../../components/ui/SidebarListCard'
import { PaginationControls } from '../../../components/ui/PaginationControls'
import { useToast } from '../../../components/ui/Toast'
import { formatDate, formatDateTime, timeAgo } from '../../../utils/formatters'
import '../../../styles/features/audit-logs/AuditLogsPage.css'
import { auditLogService } from '../services/auditLogService'

const ACTION_CONFIG = {
  CREATED: { label: 'Created', color: '#16a34a', bg: '#dcfce7' },
  CONFIRMED: { label: 'Confirmed', color: '#2563eb', bg: '#dbeafe' },
  RESCHEDULED: { label: 'Rescheduled', color: '#d97706', bg: '#fef3c7' },
  COMPLETED: { label: 'Completed', color: '#7c3aed', bg: '#ede9fe' },
  CANCELLED: { label: 'Cancelled', color: '#dc2626', bg: '#fee2e2' },
}

const ACTION_ORDER = ['CREATED', 'CONFIRMED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED']
const PAGE_SIZE = 15

const normalizeBookingNumber = (value = '') => value.trim().toUpperCase()

function getActionCount(logs, actionType) {
  return logs.filter((log) => log.actionType === actionType).length
}

function getDetailLabel(log) {
  switch (log.actionType) {
    case 'RESCHEDULED':
      return 'Rescheduled To'
    case 'COMPLETED':
      return 'Completed On'
    case 'CONFIRMED':
      return 'Confirmed On'
    case 'CREATED':
      return 'Service Date'
    case 'CANCELLED':
      return 'Was Scheduled'
    default:
      return 'Date'
  }
}

function getDetailValue(log) {
  if (log.actionType === 'RESCHEDULED') {
    return `${formatDate(log.newDate)}${log.newSlot ? ` · ${log.newSlot}` : ''}`
  }
  if (log.actionType === 'CANCELLED') {
    const date = log.oldDate || log.newDate
    const slot = log.oldSlot || log.newSlot
    return date ? `${formatDate(date)}${slot ? ` · ${slot}` : ''}` : '—'
  }
  if (log.actionType === 'CONFIRMED' || log.actionType === 'COMPLETED') {
    const date = log.newDate || (log.actionDate ? String(log.actionDate).split('T')[0] : '')
    return date ? `${formatDate(date)}${log.newSlot && log.actionType === 'COMPLETED' ? ` · ${log.newSlot}` : ''}` : '—'
  }
  return log.newDate ? `${formatDate(log.newDate)}${log.newSlot ? ` · ${log.newSlot}` : ''}` : '—'
}

function getPreviousValue(log) {
  if (!log.oldDate) return ''
  return `${formatDate(log.oldDate)}${log.oldSlot ? ` · ${log.oldSlot}` : ''}`
}

export function AuditLogsPage() {
  const toast = useToast()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortOrder, setSortOrder] = useState('newest')
  const [page, setPage] = useState(1)
  const [expandedBookings, setExpandedBookings] = useState({})

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const response = await auditLogService.list()
        setLogs(response.data || [])
      } catch (error) {
        toast(error.response?.data?.message || 'Failed to load audit logs.', 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const errors = useMemo(() => {
    const nextErrors = {}
    const trimmedSearch = search.trim()
    if (trimmedSearch && !/^\d+$/.test(trimmedSearch) && !/^BK-\d{4}-\d{4}$/i.test(trimmedSearch)) {
      nextErrors.search = 'Enter a booking ID or booking number like BK-2026-0001.'
    }
    if (dateFrom && dateTo && dateFrom > dateTo) {
      nextErrors.dateTo = '"To" date must be on or after "From" date.'
    }
    return nextErrors
  }, [search, dateFrom, dateTo])

  const filteredLogs = useMemo(() => {
    if (Object.keys(errors).length) return []

    const trimmedSearch = search.trim()
    const normalizedSearch = normalizeBookingNumber(trimmedSearch)
    const next = logs.filter((log) => {
      if (actionFilter && log.actionType !== actionFilter) return false
      if (normalizedSearch) {
        const bookingId = String(log.bookingId || '')
        const bookingNumber = normalizeBookingNumber(log.bookingNumber || '')
        if (!bookingId.includes(normalizedSearch) && !bookingNumber.includes(normalizedSearch)) return false
      }
      const actionDate = log.actionDate ? String(log.actionDate).split('T')[0] : ''
      if (dateFrom && actionDate && actionDate < dateFrom) return false
      if (dateTo && actionDate && actionDate > dateTo) return false
      return true
    })
    next.sort((left, right) => {
      const leftTime = new Date(left.actionDate || 0).getTime()
      const rightTime = new Date(right.actionDate || 0).getTime()
      return sortOrder === 'oldest' ? leftTime - rightTime : rightTime - leftTime
    })
    return next
  }, [logs, search, actionFilter, dateFrom, dateTo, sortOrder, errors])

  useEffect(() => {
    setPage(1)
  }, [search, actionFilter, dateFrom, dateTo, sortOrder])

  const groupedLogs = useMemo(() => {
    const groups = new Map()
    filteredLogs.forEach((log) => {
      const key = log.bookingId || log.bookingNumber || log.id
      if (!groups.has(key)) {
        groups.set(key, {
          bookingId: log.bookingId,
          bookingNumber: log.bookingNumber || `#${log.bookingId}`,
          vehicleInfo: log.vehicleInfo,
          serviceName: log.serviceName,
          latestActionDate: log.actionDate,
          latestActionType: log.actionType,
          logs: [],
        })
      }
      const group = groups.get(key)
      group.logs.push(log)
      if (!group.vehicleInfo && log.vehicleInfo) group.vehicleInfo = log.vehicleInfo
      if (!group.serviceName && log.serviceName) group.serviceName = log.serviceName
      if (!group.latestActionDate || new Date(log.actionDate || 0) > new Date(group.latestActionDate || 0)) {
        group.latestActionDate = log.actionDate
        group.latestActionType = log.actionType
      }
    })
    return [...groups.values()]
  }, [filteredLogs])

  const totalPages = Math.max(1, Math.ceil(groupedLogs.length / PAGE_SIZE))
  const pagedGroups = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return groupedLogs.slice(start, start + PAGE_SIZE)
  }, [groupedLogs, page])

  const kpis = [
    { label: 'Total Events', value: logs.length, bg: '#fff7ed' },
    { label: 'Created', value: getActionCount(logs, 'CREATED'), bg: '#dcfce7' },
    { label: 'Confirmed', value: getActionCount(logs, 'CONFIRMED'), bg: '#dbeafe' },
    { label: 'Completed', value: getActionCount(logs, 'COMPLETED'), bg: '#ede9fe' },
    { label: 'Cancelled', value: getActionCount(logs, 'CANCELLED'), bg: '#fee2e2' },
  ]

  const activePills = []
  if (actionFilter) activePills.push(`Action: ${ACTION_CONFIG[actionFilter]?.label || actionFilter}`)
  if (search.trim()) activePills.push(`Search: "${search.trim()}"`)
  if (dateFrom) activePills.push(`From: ${formatDate(dateFrom)}`)
  if (dateTo) activePills.push(`To: ${formatDate(dateTo)}`)

  const topActors = useMemo(() => {
    const counts = new Map()
    filteredLogs.forEach((log) => {
      const name = log.actionByName || 'System'
      counts.set(name, (counts.get(name) || 0) + 1)
    })
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [filteredLogs])

  const recentLogs = useMemo(() => filteredLogs.slice(0, 6), [filteredLogs])

  function resetFilters() {
    setSearch('')
    setActionFilter('')
    setDateFrom('')
    setDateTo('')
    setSortOrder('newest')
  }

  function toggleBooking(key) {
    setExpandedBookings((previous) => ({ ...previous, [key]: !previous[key] }))
  }

  return (
    <AdminLayout activeKey="audit">
      <div className="audit-page">
        <PageHero
          title="Audit & Booking History"
          subtitle="Track booking creation, confirmation, reschedule, completion, and cancellation activity."
          variant="admin"
          className="audit-hero"
          actions={<div className="d-flex gap-2 align-items-center flex-wrap">{activePills.map((pill) => <span key={pill} className="audit-filter-pill">{pill}</span>)}</div>}
        />

        <PageContent>
          <PillStatRow>
            {kpis.map((item) => (
              <PillStat key={item.label} label={item.label} value={item.value} color={item.bg} />
            ))}
          </PillStatRow>

          <SearchToolbar
            className="audit-toolbar-card mb-3"
            onReset={resetFilters}
            fields={[
              {
                key: 'search',
                label: 'Search',
                colClassName: 'col-md-4',
                error: errors.search,
                render: () => (
                  <input
                    type="text"
                    className={`form-control form-control-sm ${errors.search ? 'is-invalid' : ''}`}
                    placeholder="Booking ID or number..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                ),
              },
              {
                key: 'action',
                label: 'Action',
                colClassName: 'col-md-2',
                render: () => (
                  <select className="form-select form-select-sm" value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
                    <option value="">All Actions</option>
                    {ACTION_ORDER.map((action) => <option key={action} value={action}>{ACTION_CONFIG[action]?.label || action}</option>)}
                  </select>
                ),
              },
              {
                key: 'from',
                label: 'From Date',
                colClassName: 'col-md-2',
                render: () => <input type="date" className="form-control form-control-sm" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />,
              },
              {
                key: 'to',
                label: 'To Date',
                colClassName: 'col-md-2',
                error: errors.dateTo,
                render: () => <input type="date" className={`form-control form-control-sm ${errors.dateTo ? 'is-invalid' : ''}`} value={dateTo} onChange={(event) => setDateTo(event.target.value)} />,
              },
              {
                key: 'sort',
                label: 'Sort',
                colClassName: 'col-md-1',
                render: () => (
                  <select className="form-select form-select-sm" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                  </select>
                ),
              },
            ]}
          />

          <ResultsBar
            total={groupedLogs.length}
            page={page}
            pageSize={PAGE_SIZE}
            itemLabel="bookings"
            emptyLabel="0 bookings"
            className="audit-results-bar"
            left={(
              <div className="d-flex gap-3 flex-wrap align-items-center">
                {ACTION_ORDER.map((action) => (
                  <span key={action} className="audit-legend-item">
                    <span className="audit-legend-dot" style={{ background: ACTION_CONFIG[action]?.color }} />
                    {ACTION_CONFIG[action]?.label || action}
                  </span>
                ))}
              </div>
            )}
          />

          <div className="audit-layout">
            <div>
              {loading ? (
                <div className="section-card"><PageSpinner /></div>
              ) : !pagedGroups.length ? (
                <EmptyState className="audit-empty-state" title="No audit logs found" message="Try adjusting your search or filters." onClear={resetFilters} />
              ) : (
                <>
                  <div className="audit-log-list">
                    {pagedGroups.map((group) => {
                      const latestAction = ACTION_CONFIG[group.latestActionType] || ACTION_CONFIG.CREATED
                      const groupKey = group.bookingId || group.bookingNumber
                      const isExpanded = Boolean(expandedBookings[groupKey])
                      return (
                        <article key={groupKey} className="audit-group-card">
                          <button type="button" className="audit-group-header" onClick={() => toggleBooking(groupKey)}>
                            <div className="audit-group-main">
                              <span className="audit-action-badge" style={{ background: latestAction.bg, color: latestAction.color }}>
                                <span className="audit-action-dot" style={{ background: latestAction.color }} />
                                {latestAction.label}
                              </span>
                              <span className="audit-booking-number">{group.bookingNumber}</span>
                              {group.serviceName ? <span className="audit-service-name">{group.serviceName}</span> : null}
                            </div>
                            <div className="audit-group-meta">
                              <div className="audit-vehicle-text">{group.vehicleInfo || 'Vehicle not available'}</div>
                              <div className="audit-group-summary">{group.logs.length} event{group.logs.length === 1 ? '' : 's'} · {formatDateTime(group.latestActionDate)}</div>
                            </div>
                            <span className={`audit-group-toggle ${isExpanded ? 'expanded' : ''}`}>⌄</span>
                          </button>

                          {isExpanded ? (
                            <div className="audit-group-history">
                              {group.logs.map((log) => {
                                const action = ACTION_CONFIG[log.actionType] || ACTION_CONFIG.CREATED
                                return (
                                  <div key={log.id} className="audit-history-row">
                                    <div className="audit-history-rail">
                                      <span className="audit-history-dot" style={{ background: action.color }} />
                                    </div>
                                    <div className="audit-history-content">
                                      <div className="audit-history-top">
                                        <span className="audit-action-badge" style={{ background: action.bg, color: action.color }}>
                                          <span className="audit-action-dot" style={{ background: action.color }} />
                                          {action.label}
                                        </span>
                                        <span className="audit-history-time">{formatDateTime(log.actionDate)}</span>
                                      </div>
                                      <div className="audit-history-grid">
                                        <div>
                                          <div className="audit-detail-label">{getDetailLabel(log)}</div>
                                          <div className={`audit-detail-value ${log.actionType === 'CANCELLED' ? 'is-strike' : ''}`}>{getDetailValue(log)}</div>
                                          {log.actionType === 'RESCHEDULED' && getPreviousValue(log) ? (
                                            <>
                                              <div className="audit-detail-label mt-2">From</div>
                                              <div className="audit-detail-value is-strike">{getPreviousValue(log)}</div>
                                            </>
                                          ) : null}
                                        </div>
                                        <div>
                                          <div className="audit-detail-label">Action by</div>
                                          <div className="audit-actor-name">{log.actionByName || 'System'}</div>
                                        </div>
                                        <div>
                                          <div className="audit-detail-label">Reason</div>
                                          <div className="audit-detail-value">{log.reason || '—'}</div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          ) : null}
                        </article>
                      )
                    })}
                  </div>

                  <PaginationControls page={page} totalItems={groupedLogs.length} pageSize={PAGE_SIZE} totalPages={totalPages} onPageChange={setPage} />
                </>
              )}
            </div>

            <aside className="audit-sidebar">
              <SidebarProgressCard
                title="Action Breakdown"
                className="audit-sidebar-card"
                items={ACTION_ORDER.map((action) => ({
                  key: action,
                  label: ACTION_CONFIG[action]?.label || action,
                  value: getActionCount(filteredLogs, action),
                  valueLabel: getActionCount(filteredLogs, action),
                  max: filteredLogs.length || 1,
                  color: ACTION_CONFIG[action]?.color,
                }))}
              />

              <SidebarListCard
                title="Distribution"
                className="audit-sidebar-card"
                items={ACTION_ORDER.map((action) => ({
                  key: action,
                  name: ACTION_CONFIG[action]?.label || action,
                  avatar: <span className="audit-legend-dot" style={{ background: ACTION_CONFIG[action]?.color }} />,
                  right: <span>{filteredLogs.length ? Math.round((getActionCount(filteredLogs, action) / filteredLogs.length) * 100) : 0}%</span>,
                }))}
              />

              <SidebarListCard
                title="Recent Activity"
                className="audit-sidebar-card"
                emptyMessage="No activity yet"
                items={recentLogs.map((log) => ({
                  key: `recent-${log.id}`,
                  name: log.bookingNumber || `#${log.bookingId}`,
                  meta: `${ACTION_CONFIG[log.actionType]?.label || log.actionType} · ${log.actionByName || 'System'}`,
                  avatar: <span className="audit-legend-dot" style={{ background: ACTION_CONFIG[log.actionType]?.color }} />,
                  right: <span className="audit-recent-time">{timeAgo(log.actionDate)}</span>,
                }))}
                renderMeta={(item) => <div className="audit-recent-meta">{item.meta}</div>}
              />

              <SidebarListCard
                title="Top Actors"
                className="audit-sidebar-card"
                emptyMessage="No data"
                items={topActors.map(([name, count]) => ({
                  key: name,
                  name,
                  avatarText: name.charAt(0).toUpperCase(),
                  right: <div className="audit-actor-count">{count} actions</div>,
                }))}
              />
            </aside>
          </div>
        </PageContent>
      </div>
    </AdminLayout>
  )
}

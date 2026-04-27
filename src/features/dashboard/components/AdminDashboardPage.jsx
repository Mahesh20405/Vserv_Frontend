import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { AdminLayout } from '../../../layouts/AppShell'
import { AdminPageHero, PageContent } from '../../../components/common/PageElements'
import { PageSpinner } from '../../../components/ui/Spinner'
import { StatusBadge } from '../../../components/ui/Badge'
import { PillStat } from '../../../components/ui/PillStat'
import { PillStatRow } from '../../../components/ui/PillStatRow'
import { useAuth } from '../../auth/hooks/useAuth'
import { bookingService } from '../../bookings/services/bookingService'
import { formatCurrency, formatDate } from '../../../utils/formatters'
import { adminDashboardService } from '../services/adminDashboardService'
import '../../../styles/features/dashboard/Dashboard.css'

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0d9488']
const QUICK_LINKS = [
  { to: '/admin/users', label: 'Manage Users', icon: 'U', bg: '#dbeafe' },
  { to: '/admin/bookings', label: 'All Bookings', icon: 'B', bg: '#d1fae5' },
  { to: '/admin/advisors', label: 'Service Advisors', icon: 'A', bg: '#fef3c7' },
  { to: '/admin/invoices', label: 'Invoices', icon: 'I', bg: '#ede9fe' },
  { to: '/admin/availability', label: 'Availability', icon: 'S', bg: '#fee2e2' },
]

export function AdminDashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [overdueCount, setOverdueCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      adminDashboardService.getStats(),
      bookingService.getOverdueBookings().catch(() => ({ data: [] })),
    ])
      .then(([statsResponse, overdueResponse]) => {
        setStats(statsResponse.data)
        setOverdueCount((overdueResponse.data || []).length)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  if (loading) return <AdminLayout><PageSpinner /></AdminLayout>

  const statusData = Object.entries(stats?.bookingStatusBreakdown || {}).map(([name, value]) => ({ name, value }))
  const activityData = (stats?.bookingActivityByMonth || []).map((month) => ({ month: month.month, created: month.count, completed: 0 }))
  const revenueData = (stats?.revenueByMonth || []).map((month) => ({ month: month.month, revenue: Number(month.amount || month.total || 0) }))
  const serviceMixData = Object.entries(stats?.serviceMix || {}).map(([name, value]) => ({ name, value }))
  const kpis = [
    { label: 'Total Users', value: stats?.totalUsers ?? 0, icon: 'U', delta: `${stats?.totalUsers ?? 0} registered`, bg: '#dbeafe' },
    { label: 'Total Bookings', value: stats?.totalBookings ?? 0, icon: 'B', delta: `${stats?.pendingBookings ?? 0} pending`, bg: '#d1fae5' },
    { label: 'Completed Bookings', value: stats?.completedBookings ?? 0, icon: 'C', delta: `${stats?.cancelledBookings ?? 0} cancelled`, bg: '#fef3c7' },
    { label: 'Pending Invoices', value: stats?.pendingInvoices ?? 0, icon: 'I', delta: stats?.pendingInvoices ? 'Action needed' : 'All clear', bg: '#fee2e2' },
    { label: 'Revenue', value: formatCurrency(stats?.totalRevenue), icon: 'R', delta: 'From paid invoices', bg: '#ede9fe' },
  ]

  return (
    <AdminLayout activeKey="dashboard">
      <AdminPageHero
        title={`${greeting}, ${user?.fullName?.split(' ')[0] || 'Admin'}`}
        subtitle={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        actions={(
          <>
            <Link to="/admin/book-service" className="admin-hero-btn">Book Service</Link>
            <Link to="/admin/availability" className="admin-hero-btn-outline">Manage Availability</Link>
          </>
        )}
      />

      <PageContent>
        <PillStatRow>
          {kpis.map((item) => (
            <PillStat key={item.label} label={item.label} value={item.value} color={item.bg} />
          ))}
        </PillStatRow>

        <div className="row g-3">
          <div className="col-xl-8">
            <div className="row g-3">
              <div className="col-lg-7">
                <div className="section-card">
                  <div className="section-header">
                    <div>
                      <span className="section-title">Booking Activity</span>
                      <div className="page-summary">Monthly overview</div>
                    </div>
                  </div>
                  <div className="section-body" style={{ height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={activityData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="created" fill="#2563eb" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="col-lg-5">
                <div className="section-card">
                  <div className="section-header">
                    <div>
                      <span className="section-title">Booking Status</span>
                      <div className="page-summary">Current distribution</div>
                    </div>
                  </div>
                  <div className="section-body" style={{ height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statusData} cx="50%" cy="50%" outerRadius={78} innerRadius={48} dataKey="value">
                          {statusData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="col-lg-7">
                <div className="section-card">
                  <div className="section-header">
                    <div>
                      <span className="section-title">Revenue</span>
                      <div className="page-summary">Paid invoices by month</div>
                    </div>
                    <span className="badge bg-light text-dark">{formatCurrency(stats?.totalRevenue)}</span>
                  </div>
                  <div className="section-body" style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={revenueData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Line type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={3} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="col-lg-5">
                <div className="section-card">
                  <div className="section-header">
                    <div>
                      <span className="section-title">Service Mix</span>
                      <div className="page-summary">Bookings by category</div>
                    </div>
                  </div>
                  <div className="section-body" style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={serviceMixData} cx="50%" cy="50%" outerRadius={76} dataKey="value">
                          {serviceMixData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="col-12">
                <div className="section-card">
                  <div className="section-header">
                    <span className="section-title">Recent Bookings</span>
                    <Link to="/admin/bookings" className="section-link">View All →</Link>
                  </div>
                  <div className="section-body p-0">
                    <table className="vserv-table w-100">
                      <thead><tr><th>#</th><th>Customer</th><th>Service</th><th>Date</th><th>Status</th></tr></thead>
                      <tbody>
                        {(stats?.recentBookings || []).map((booking) => (
                          <tr key={booking.bookingId}>
                            <td style={{ fontWeight: 600, fontSize: 'var(--fs-meta)' }}>#{booking.bookingId}</td>
                            <td>
                              <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{booking.ownerName || '—'}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--neutral-medium)' }}>{booking.vehicleInfo || '—'}</div>
                            </td>
                            <td className="text-xs">{booking.serviceName || '—'}</td>
                            <td className="text-xs">{formatDate(booking.serviceDate)}</td>
                            <td><StatusBadge status={booking.status} /></td>
                          </tr>
                        ))}
                        {!(stats?.recentBookings?.length) && <tr><td colSpan={5} className="text-center text-muted py-3">No recent bookings</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-4">
            <div className="admin-sidebar-stack">
              <div className={`admin-sidebar-card admin-action-alert${overdueCount ? ' is-active' : ''}`}>
                <div className="admin-action-alert-top">
                  <div>
                    <div className="admin-sidebar-title mb-2">Requires Action</div>
                    <div className="page-summary mb-0">
                      {overdueCount
                        ? `${overdueCount} confirmed booking(s) have passed their service date without the service being started.`
                        : 'No overdue bookings right now. Everything is on track.'}
                    </div>
                  </div>
                  {overdueCount ? <span className="admin-action-alert-badge">Alert</span> : null}
                </div>
                <Link
                  to="/admin/overdue-bookings"
                  className={`admin-action-alert-link${overdueCount ? ' is-active' : ''}`}
                >
                  <span className="admin-action-alert-icon">{overdueCount ? '!' : 'OK'}</span>
                  <span>
                    {overdueCount ? 'Review Overdue Bookings' : 'Open Requires Action'}
                  </span>
                </Link>
              </div>

              {(stats?.pendingInvoices ?? 0) > 0 ? (
                <div className="admin-sidebar-card" style={{ background: '#fff7ed' }}>
                  <div className="admin-sidebar-title">Pending Invoices</div>
                  <div className="page-summary mb-3">{stats.pendingInvoices} invoice(s) need review.</div>
                  <Link to="/admin/invoices" className="section-link">Review →</Link>
                </div>
              ) : null}

              <div className="admin-sidebar-card">
                <div className="admin-sidebar-title">Quick Actions</div>
                <div className="d-flex flex-column gap-2">
                  {QUICK_LINKS.map((link) => (
                    <Link key={link.to} to={link.to} className="admin-quick-link">
                      <span className="admin-quick-link-icon" style={{ background: link.bg }}>{link.icon}</span>
                      <span>{link.label}</span>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="admin-sidebar-card">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div className="admin-sidebar-title mb-0">Service Advisors</div>
                  <Link to="/admin/advisors" className="section-link">All →</Link>
                </div>
                {(stats?.activeAdvisors || []).map((advisor) => (
                  <div key={advisor.advisorId} className="d-flex align-items-center gap-2 py-2" style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 700, color: '#4338ca', flexShrink: 0 }}>
                      {(advisor.fullName || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{advisor.fullName}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--neutral-medium)' }}>{advisor.specialization || 'General'}</div>
                    </div>
                    <StatusBadge status={advisor.status} />
                  </div>
                ))}
                {!(stats?.activeAdvisors?.length) && <div className="empty-sm">No advisors found</div>}
              </div>

              <div className="admin-sidebar-card">
                <div className="admin-sidebar-title">System Overview</div>
                <div className="row g-2">
                  {[
                    ['Users', stats?.totalUsers ?? 0],
                    ['Vehicles', stats?.totalVehicles ?? 0],
                    ['In Progress', stats?.inProgressServices ?? 0],
                    ['Confirmed', stats?.confirmedBookings ?? 0],
                  ].map(([label, value]) => (
                    <div key={label} className="col-6">
                      <div className="users-info-card">
                        <div className="users-info-label">{label}</div>
                        <div className="users-info-value">{value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageContent>
    </AdminLayout>
  )
}



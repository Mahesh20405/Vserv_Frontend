import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CustomerLayout } from '../../../layouts/AppShell'
import { CustomerPageHero, PageContent } from '../../../components/common/PageElements'
import { PillStat } from '../../../components/ui/PillStat'
import { PillStatRow } from '../../../components/ui/PillStatRow'
import { StatusBadge } from '../../../components/ui/Badge'
import { PageSpinner } from '../../../components/ui/Spinner'
import { useAuth } from '../../auth/hooks/useAuth'
import { formatCurrency, formatDate, SERVICE_ICONS, VEHICLE_ICONS, timeAgo } from '../../../utils/formatters'
import { bookingService } from '../../bookings/services/bookingService'
import { invoiceService } from '../../invoices/services/invoiceService'
import { notificationService } from '../../notifications/services/notificationService'
import { vehicleService } from '../../vehicles/services/vehicleService'
import '../../../styles/features/dashboard/Dashboard.css'

const TRACKER_STEPS = ['Booked', 'Assigned', 'In Service', 'Complete']
const PREVIEW_VEHICLES = 3
const QUICK_ACTIONS = [
  { label: 'Book Service', href: '/customer/book-service' },
  { label: 'My Bookings', href: '/customer/bookings' },
  { label: 'Vehicles', href: '/customer/vehicles' },
  { label: 'Invoices', href: '/customer/invoices' },
]

function trackerStateFromBooking(booking) {
  if (!booking) return [0, 0, 0, 0]
  if (booking.bookingStatus === 'COMPLETED') return [1, 1, 1, 1]
  if (booking.bookingStatus === 'CONFIRMED') return [1, 1, 0, 0]
  if (booking.bookingStatus === 'RESCHEDULED') return [1, 0, 0, 0]
  if (booking.bookingStatus === 'CANCELLED') return [1, 0, 0, 0]
  return [1, 0, 0, 0]
}

export function CustomerDashboardPage() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [invoices, setInvoices] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [vehiclesExpanded, setVehiclesExpanded] = useState(false)

  useEffect(() => {
    if (!user?.userId) return

    Promise.all([
      bookingService.list(),
      vehicleService.byUser(user.userId),
      invoiceService.list(),
      notificationService.list(),
    ]).then(([bookingsRes, vehiclesRes, invoicesRes, notificationsRes]) => {
      setBookings((bookingsRes.data || []).slice().sort((a, b) => new Date(b.serviceDate || b.createdAt || 0) - new Date(a.serviceDate || a.createdAt || 0)))
      setVehicles(vehiclesRes.data || [])
      setInvoices((invoicesRes.data || []).slice().sort((a, b) => new Date(b.invoiceDate || 0) - new Date(a.invoiceDate || 0)))
      setNotifications(notificationsRes.data || [])
    }).finally(() => setLoading(false))
  }, [user?.userId])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const activeBooking = useMemo(() => bookings.find((booking) => ['PENDING', 'CONFIRMED', 'RESCHEDULED', 'COMPLETED'].includes(booking.bookingStatus)), [bookings])
  const trackerDone = trackerStateFromBooking(activeBooking)

  const kpis = [
    { icon: 'CR', label: 'CR', value: vehicles.length, bg: '#fff0e6' },
    { icon: 'UP', label: 'UP', value: bookings.filter((booking) => ['PENDING', 'CONFIRMED', 'RESCHEDULED'].includes(booking.bookingStatus)).length, bg: '#dbeafe' },
    { icon: 'CP', label: 'CP', value: bookings.filter((booking) => booking.bookingStatus === 'COMPLETED').length, bg: '#dcfce7' },
    { icon: 'PP', label: 'PP', value: formatCurrency(invoices.filter((invoice) => invoice.paymentStatus !== 'PAID').reduce((sum, invoice) => sum + Number(invoice.remainingBalance || 0), 0)), bg: '#fef3c7' },
    { icon: 'NT', label: 'NT', value: notifications.filter((notification) => !notification.isRead).length, bg: '#ede9fe' },
  ]

  if (loading) return <CustomerLayout activeKey="dashboard"><PageSpinner /></CustomerLayout>

  return (
    <CustomerLayout activeKey="dashboard">
      <div className="customer-dashboard-page">
        <CustomerPageHero
          title={`${greeting}, ${user?.fullName?.split(' ')[0] || 'there'}`}
          subtitle="Monitor your vehicles, bookings, and invoices at a glance."
          actions={<Link to="/customer/book-service" className="customer-hero-btn">Book Service</Link>}
        />
        <PageContent>
          <PillStatRow>
            {kpis.map((item) => (
              <PillStat key={item.label} label={item.label} value={item.value} color={item.bg} />
            ))}
          </PillStatRow>

          <div className="row g-3">
            <div className="col-lg-8">
              <div className="section-card mb-3">
                <div className="section-header">
                  <span className="section-title">Recent Bookings</span>
                  <Link to="/customer/bookings" className="section-link">{'View All ->'}</Link>
                </div>
                <div className="section-body">
                  {bookings.slice(0, 4).map((booking) => (
                    <div key={booking.bookingId} className="list-item">
                      <div className="list-item-icon">{SERVICE_ICONS[booking.serviceType] || 'Svc'}</div>
                      <div className="list-item-main">
                        <div className="list-item-title">{booking.serviceName || 'Service'}</div>
                        <div className="list-item-sub">{booking.vehicleInfo || 'Vehicle'}</div>
                      </div>
                      <div className="list-item-meta">
                        <StatusBadge status={booking.bookingStatus} />
                        <div style={{ fontSize: '0.65rem', color: 'var(--neutral-medium)', marginTop: 2 }}>{formatDate(booking.serviceDate)}</div>
                      </div>
                    </div>
                  ))}
                  {!bookings.length ? <div className="empty-sm">No bookings yet. <Link to="/customer/book-service" style={{ color: 'var(--primary-accent)' }}>{'Book now ->'}</Link></div> : null}
                </div>
              </div>

              <div className="section-card mb-3">
                <div className="section-header">
                  <span className="section-title">My Vehicles</span>
                  <Link to="/customer/vehicles" className="section-link">{'Manage ->'}</Link>
                </div>
                <div className="section-body">
                  {(vehiclesExpanded ? vehicles : vehicles.slice(0, PREVIEW_VEHICLES)).map((vehicle) => (
                    <div key={vehicle.vehicleId} className="list-item">
                      <div className="list-item-icon" style={{ fontSize: '1.1rem' }}>{VEHICLE_ICONS[vehicle.carType] || 'Car'}</div>
                      <div className="list-item-main">
                        <div className="list-item-title">{vehicle.brand} {vehicle.model} ({vehicle.manufactureYear})</div>
                        <div className="list-item-sub">{vehicle.registrationNumber} | {(vehicle.mileage || 0).toLocaleString('en-IN')} km</div>
                      </div>
                      <span className="badge bg-light text-dark" style={{ fontSize: '0.7rem' }}>{vehicle.carType}</span>
                    </div>
                  ))}
                  {vehicles.length > PREVIEW_VEHICLES ? (
                    <button className="btn btn-sm btn-outline-secondary mt-2 w-100" style={{ fontSize: '0.75rem' }} onClick={() => setVehiclesExpanded((value) => !value)}>
                      {vehiclesExpanded ? 'Show Less' : `Show ${vehicles.length - PREVIEW_VEHICLES} More`}
                    </button>
                  ) : null}
                  {!vehicles.length ? <div className="empty-sm">No vehicles added. <Link to="/customer/vehicles" style={{ color: 'var(--primary-accent)' }}>{'Add one ->'}</Link></div> : null}
                </div>
              </div>

              <div className="section-card">
                <div className="section-header">
                  <span className="section-title">Recent Invoices</span>
                  <Link to="/customer/invoices" className="section-link">{'View All ->'}</Link>
                </div>
                <div className="section-body">
                  {invoices.slice(0, 3).map((invoice) => (
                    <div key={invoice.invoiceId} className="list-item">
                      <div className="list-item-main">
                        <div className="list-item-title">Invoice #{invoice.invoiceId}</div>
                        <div className="list-item-sub">{invoice.vehicleInfo || '-'} | {formatDate(invoice.invoiceDate)}</div>
                      </div>
                      <div className="list-item-meta">
                        <div style={{ fontWeight: 700, color: 'var(--primary-accent)', fontSize: '0.88rem' }}>{formatCurrency(invoice.totalAmount)}</div>
                        <StatusBadge status={invoice.paymentStatus} />
                      </div>
                    </div>
                  ))}
                  {!invoices.length ? <div className="empty-sm">No invoices yet.</div> : null}
                </div>
              </div>
            </div>

            <div className="col-lg-4">
              <div className="section-card mb-3">
                <div className="section-header"><span className="section-title">Quick Actions</span></div>
                <div className="section-body">
                  <div className="customer-quick-actions">
                    {QUICK_ACTIONS.map((item) => (
                      <Link key={item.href} to={item.href} className="customer-quick-action">
                        <span>{item.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              {activeBooking ? (
                <div className="section-card mb-3">
                  <div className="section-header"><span className="section-title">Service Tracker</span></div>
                  <div className="section-body">
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 2 }}>{activeBooking.vehicleInfo || 'Your Vehicle'}</div>
                    <div style={{ fontSize: 'var(--fs-fine)', color: 'var(--neutral-medium)', marginBottom: 12 }}>{activeBooking.serviceName || 'Service'} | {formatDate(activeBooking.serviceDate)}</div>
                    <div className="tracker">
                      {TRACKER_STEPS.map((step, index) => {
                        const isDone = trackerDone[index] === 1
                        const isActive = !isDone && (index === 0 || trackerDone[index - 1] === 1)
                        return (
                          <div key={step} className={`tracker-step ${isDone ? 'done' : isActive ? 'active' : ''}`}>
                            <div className="tracker-dot">{isDone ? 'OK' : index + 1}</div>
                            <div className="tracker-label">{step}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="section-card">
                <div className="section-header">
                  <span className="section-title">Notifications</span>
                  <Link to="/customer/notifications" className="section-link">{'View All ->'}</Link>
                </div>
                <div className="section-body">
                  {notifications.slice(0, 4).map((notification) => (
                    <div key={notification.notificationId} className="notif-item">
                      <div className={`notif-dot ${notification.isRead ? 'notif-dot-read' : 'notif-dot-unread'}`} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="notif-title">{notification.title}</div>
                        <div className="notif-msg">{notification.message?.length > 70 ? `${notification.message.slice(0, 67)}...` : notification.message}</div>
                      </div>
                      <div className="notif-time">{timeAgo(notification.sentAt)}</div>
                    </div>
                  ))}
                  {!notifications.length ? <div className="empty-sm">No notifications.</div> : null}
                </div>
              </div>
            </div>
          </div>
        </PageContent>
      </div>
    </CustomerLayout>
  )
}



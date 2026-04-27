import { useEffect, useMemo, useState } from 'react'
import { CustomerLayout } from '../../../layouts/AppShell'
import { CustomerPageHero, PageContent } from '../../../components/common/PageElements'
import { PillStat } from '../../../components/ui/PillStat'
import { PillStatRow } from '../../../components/ui/PillStatRow'
import { useNotifications } from '../hooks/useNotifications'
import { timeAgo } from '../../../utils/formatters'
import { ActionIconButton } from '../../../components/ui/ActionIconButton'
import { PaginationControls } from '../../../components/ui/PaginationControls'
import '../../../styles/features/notifications/Notifications.css'

const CATEGORY_META = {
  BOOKING_CONFIRMATION: { icon: 'Book', label: 'Booking', chipBg: '#dbeafe', chipColor: '#1d4ed8' },
  PAYMENT_REMINDER: { icon: 'Pay', label: 'Payment', chipBg: '#fee2e2', chipColor: '#b91c1c' },
  STATUS_UPDATE: { icon: 'Stat', label: 'Status', chipBg: '#fef3c7', chipColor: '#92400e' },
  SERVICE_REMINDER: { icon: 'Soon', label: 'Reminder', chipBg: '#e0f2fe', chipColor: '#0369a1' },
  COMPLETION: { icon: 'Done', label: 'Completion', chipBg: '#dcfce7', chipColor: '#166534' },
  default: { icon: 'Info', label: 'General', chipBg: '#f1f5f9', chipColor: '#475569' },
}
const PAGE_SIZE = 10

function notificationSortValue(notification = {}) {
  return new Date(notification.sentAt || notification.createdAt || 0).getTime() || 0
}

function getFilterLabel(filter) {
  if (filter === 'all') return 'All notifications'
  if (filter === 'unread') return 'Unread notifications'
  return CATEGORY_META[filter]?.label || 'Notifications'
}

export function NotificationsPage() {
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const { notifications, unreadCount, totalNotifications, totalPages, markRead, markAllRead, remove } = useNotifications({ filter, page, size: PAGE_SIZE })

  const visible = useMemo(() => notifications
    .slice()
    .sort((left, right) => (
      notificationSortValue(right) - notificationSortValue(left) ||
      Number(right.notificationId || 0) - Number(left.notificationId || 0)
    )), [filter, notifications])
  const latestUnread = useMemo(() => [...notifications]
    .filter((notification) => !notification.isRead)
    .sort((left, right) => (
      notificationSortValue(right) - notificationSortValue(left) ||
      Number(right.notificationId || 0) - Number(left.notificationId || 0)
    ))[0] || null, [notifications])

  const summary = {
    total: notifications.length,
    booking: notifications.filter((notification) => notification.notificationType === 'BOOKING_CONFIRMATION').length,
    payment: notifications.filter((notification) => notification.notificationType === 'PAYMENT_REMINDER').length,
    status: notifications.filter((notification) => ['STATUS_UPDATE', 'SERVICE_REMINDER', 'COMPLETION'].includes(notification.notificationType)).length,
  }
  const pagedNotifications = visible

  useEffect(() => { setPage(1) }, [filter])
  useEffect(() => { setPage((current) => Math.min(current, totalPages)) }, [totalPages])

  return (
    <CustomerLayout activeKey="notifications">
      <div className="customer-notifications-page">
        <CustomerPageHero
          title="Notifications"
          subtitle="Stay updated on bookings, reminders, completion alerts, and payment follow-ups."
          actions={unreadCount > 0 ? <button className="customer-hero-btn-secondary" onClick={markAllRead}>Mark All Read</button> : null}
        />
        <PageContent>
        <PillStatRow>
          {[
            { icon: 'TT', label: 'TT', value: summary.total, bg: '#dbeafe' },
            { icon: 'UR', label: 'UR', value: unreadCount, bg: '#fef3c7' },
            { icon: 'BK', label: 'BK', value: summary.booking, bg: '#dcfce7' },
            { icon: 'PY', label: 'PY', value: summary.payment, bg: '#ede9fe' },
            { icon: 'ST', label: 'ST', value: summary.status, bg: '#fee2e2' },
          ].map((item) => (
            <PillStat key={item.label} label={item.label} value={item.value} color={item.bg} />
          ))}
        </PillStatRow>

        <div className="toolbar-card d-flex gap-2 flex-wrap align-items-center mb-3">
          {[
            ['all', 'All'],
            ['unread', 'Unread'],
            ['BOOKING_CONFIRMATION', 'Bookings'],
            ['PAYMENT_REMINDER', 'Payments'],
            ['STATUS_UPDATE', 'Status'],
            ['SERVICE_REMINDER', 'Reminders'],
            ['COMPLETION', 'Completed'],
          ].map(([key, label]) => (
            <button key={key} className={`btn btn-sm ${filter === key ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setFilter(key)}>
              {label}
            </button>
          ))}
          <span className="ms-auto" style={{ fontSize: 'var(--fs-meta)', color: 'var(--neutral-medium)' }}>
            {getFilterLabel(filter)}: {totalNotifications}
          </span>
        </div>

        <div className="row g-3">
          <div className="col-lg-8">
            <div className="section-card">
              <div className="section-body">
                {pagedNotifications.length ? pagedNotifications.map((notification) => {
                  const category = CATEGORY_META[notification.notificationType] || CATEGORY_META.default
                  return (
                    <div
                      key={notification.notificationId}
                      className="d-flex align-items-start gap-3 py-3"
                      style={{
                        borderBottom: '1px solid #f0f0f0',
                        background: notification.isRead ? 'transparent' : '#fffbf5',
                        borderRadius: 6,
                        padding: '12px 10px',
                      }}
                    >
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: '50%',
                          background: category.chipBg,
                          color: category.chipColor,
                          display: 'grid',
                          placeItems: 'center',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {category.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="d-flex justify-content-between gap-2 flex-wrap">
                          <div style={{ fontWeight: notification.isRead ? 500 : 700, fontSize: '0.88rem', color: 'var(--primary-dark)' }}>{notification.title}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--neutral-medium)' }}>{timeAgo(notification.sentAt)}</div>
                        </div>
                        <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--neutral-medium)', marginTop: 4 }}>{notification.message}</div>
                        <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap mt-2">
                          <span className="badge" style={{ background: category.chipBg, color: category.chipColor, fontSize: '0.7rem' }}>
                            {category.label}
                          </span>
                          <div className="action-strip">
                            {!notification.isRead && <ActionIconButton icon="confirm" label="Mark as read" onClick={() => markRead(notification.notificationId)} />}
                            <ActionIconButton icon="delete" label="Delete notification" className="action-danger" onClick={() => remove(notification.notificationId)} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                }) : (
                  <div className="empty-state">
                    <div className="empty-state-icon">Alerts</div>
                    <p className="mb-1">No notifications in this view</p>
                    <small style={{ color: 'var(--neutral-medium)' }}>Try a different filter or check back after your next booking update.</small>
                  </div>
                )}
              </div>
            </div>
            <PaginationControls page={page} totalItems={totalNotifications} pageSize={PAGE_SIZE} totalPages={totalPages} onPageChange={setPage} />
          </div>

          <div className="col-lg-4">
            <div className="section-card mb-3">
              <div className="section-header"><span className="section-title">Notification Summary</span></div>
              <div className="section-body">
                <div className="row g-2">
                  {[
                    ['Booking', summary.booking],
                    ['Payment', summary.payment],
                    ['Status', summary.status],
                    ['Unread', unreadCount],
                  ].map(([label, value]) => (
                    <div key={label} className="col-6">
                      <div className="detail-label">{label}</div>
                      <div className="detail-value">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="section-card">
              <div className="section-header"><span className="section-title">Quick Insight</span></div>
              <div className="section-body">
                <div className="detail-label">Current Filter</div>
                <div className="detail-value mb-3">{getFilterLabel(filter)}</div>
                <div className="detail-label">Visible Count</div>
                <div className="detail-value mb-3">{totalNotifications}</div>
                <div className="detail-label">Latest Unread</div>
                <div className="detail-value" style={{ fontSize: '0.8rem' }}>
                  {latestUnread?.title || 'All caught up'}
                </div>
              </div>
            </div>
          </div>
        </div>
        </PageContent>
      </div>
    </CustomerLayout>
  )
}



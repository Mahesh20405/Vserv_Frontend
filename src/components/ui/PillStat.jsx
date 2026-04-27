const LABEL_MAP = {
  TV: 'Total Vehicles',
  SV: 'SUV Vehicles',
  SD: 'Sedan Vehicles',
  DS: 'Due Soon',
  CR: 'Cars Registered',
  UP: 'Upcoming Bookings',
  CP: 'Completed',
  PP: 'Pending Payments',
  NT: 'New Notifications',
  TT: 'Total Notifications',
  UR: 'Unread',
  BK: 'Booking Alerts',
  PY: 'Payment Alerts',
  ST: 'Status Updates',
  PT: 'Paid Total',
  PB: 'Pending Balance',
  TI: 'Total Invoices',
}

export function PillStat({ label, value, color = '#378ADD', onClick }) {
  return (
    <div
      className="pill-stat"
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      <span className="pill-stat-dot" style={{ background: color }} aria-hidden="true" />
      <span className="pill-stat-value">{value ?? '-'}</span>
      <span className="pill-stat-label">{LABEL_MAP[label] || label}</span>
    </div>
  )
}

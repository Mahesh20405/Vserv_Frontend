import { formatCurrency } from '../../utils/formatters'

export function ServiceCard({
  service,
  selected = false,
  onClick,
  bookingChargeFallback = 299,
}) {
  return (
    <button type="button" className={`service-card ${selected ? 'selected' : ''}`} onClick={onClick}>
      <div className="svc-icon">{service.serviceType?.slice(0, 2) || 'SV'}</div>
      <div className="svc-body">
        <div className="svc-name">{service.serviceName}</div>
        <div className="svc-desc">{service.description || 'No description available'}</div>
        <div className="svc-meta">
          <span className="svc-chip">{service.serviceType}</span>
          <span className="svc-chip">{service.carType}</span>
          <span className="svc-chip">{service.durationHours ? `${service.durationHours}h` : '-'}</span>
        </div>
      </div>
      <div className="svc-price">
        <div>{formatCurrency(service.basePrice)}</div>
        <div style={{ fontSize: '0.68rem', color: 'var(--neutral-medium)' }}>
          Booking: {formatCurrency(service.bookingCharge ?? bookingChargeFallback)}
        </div>
      </div>
    </button>
  )
}

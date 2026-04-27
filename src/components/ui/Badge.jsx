import { STATUS_CONFIG } from '../../utils/formatters'

export function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { cls: 'status-cancelled', label: status || '—' }
  return (
    <span className={`status-badge ${cfg.cls}`}>
      <span className="status-dot" />
      {cfg.label}
    </span>
  )
}

export function Badge({ children, variant = 'secondary', className = '' }) {
  return (
    <span className={`badge bg-${variant} ${className}`}>{children}</span>
  )
}


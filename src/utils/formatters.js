export function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch { return dateStr }
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return dateStr }
}

export function formatCurrency(amount) {
  if (amount == null) return '₹0'
  return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`
}

export function timeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d < 30 ? `${d}d ago` : formatDate(ts)
}

export const STATUS_CONFIG = {
  PENDING:      { cls: 'status-pending',      label: 'Pending'      },
  CONFIRMED:    { cls: 'status-confirmed',     label: 'Confirmed'    },
  COMPLETED:    { cls: 'status-completed',     label: 'Completed'    },
  CANCELLED:    { cls: 'status-cancelled',     label: 'Cancelled'    },
  RESCHEDULED:  { cls: 'status-rescheduled',   label: 'Rescheduled'  },
  IN_PROGRESS:  { cls: 'status-in_progress',   label: 'In Progress'  },
  ACTIVE:       { cls: 'status-active',        label: 'Active'       },
  INACTIVE:     { cls: 'status-inactive',      label: 'Inactive'     },
  PAID:         { cls: 'status-completed',     label: 'Paid'         },
  PARTIALLY_PAID:{ cls: 'status-confirmed',    label: 'Partial'      },
  AVAILABLE:    { cls: 'status-completed',     label: 'Available'    },
  ASSIGNED:     { cls: 'status-confirmed',     label: 'Assigned'     },
  ON_LEAVE:     { cls: 'status-cancelled',     label: 'On Leave'     },
  RESIGNED:     { cls: 'status-inactive',      label: 'Resigned'     },
}

export const SERVICE_ICONS = {
  SERVICING: '🔧', MAINTENANCE: '🛢', INSPECTION: '🔍', REPAIR: '⚙️', default: '🚗',
}

export const VEHICLE_ICONS = {
  SEDAN: '🚗', SUV: '🚙', HATCHBACK: '🚘', COUPE: '🏎️', CONVERTIBLE: '🚗', WAGON: '🚐', MINIVAN: '🚌', default: '🚗',
}

export function vehicleLabel(v) {
  if (!v) return 'Unknown'
  return `${v.brand} ${v.model} (${v.registrationNumber})`
}

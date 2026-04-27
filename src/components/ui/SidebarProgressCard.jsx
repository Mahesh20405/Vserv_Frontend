import { ProgressBar } from './ProgressBar'

export function SidebarProgressCard({ title, items = [], className = '' }) {
  return (
    <div className={`sidebar-card ${className}`.trim()}>
      <div className="sidebar-title">{title}</div>
      <div className="d-flex flex-column gap-3">
        {items.map((item) => (
          <div key={item.key || item.label}>
            <div className="d-flex justify-content-between small fw-semibold mb-1">
              <span>{item.label}</span>
              <span>{item.valueLabel ?? item.value}</span>
            </div>
            <ProgressBar value={item.value} max={item.max} color={item.color} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function NotifBadge({ count }) {
  if (!count) return null
  return (
    <span className="notif-badge">{count > 9 ? '9+' : count}</span>
  )
}

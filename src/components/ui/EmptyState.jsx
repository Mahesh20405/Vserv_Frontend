export function EmptyState({
  title,
  message,
  onClear,
  clearLabel = 'Clear Filters',
  className = '',
  children,
}) {
  return (
    <div className={className || 'section-card text-center py-4'}>
      <h6 className="mb-1">{title}</h6>
      {message ? <p className="mb-3">{message}</p> : null}
      {children}
      {onClear ? <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClear}>{clearLabel}</button> : null}
    </div>
  )
}

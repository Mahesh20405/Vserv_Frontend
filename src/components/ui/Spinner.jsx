export function Spinner({ size = 'md', className = '' }) {
  const sz = size === 'sm' ? 'spinner-border-sm' : ''
  return (
    <div className={`spinner-border text-secondary ${sz} ${className}`} role="status">
      <span className="visually-hidden">Loading…</span>
    </div>
  )
}

export function PageSpinner() {
  return (
    <div className="page-spinner">
      <Spinner />
    </div>
  )
}

export function ResultsBar({
  total = 0,
  page = 1,
  pageSize = total || 1,
  pills = [],
  emptyLabel = '0 results',
  itemLabel = 'results',
  left,
  right,
  className = '',
}) {
  const start = total ? ((page - 1) * pageSize) + 1 : 0
  const end = total ? Math.min(page * pageSize, total) : 0
  const summary = total ? `Showing ${start}-${end} of ${total} ${itemLabel}` : emptyLabel

  return (
    <div className={`results-bar ${className}`.trim()}>
      <div className="d-flex gap-1 flex-wrap align-items-center">
        {left}
        {pills.map((pill) => <span key={pill} className="filter-pill">{pill}</span>)}
      </div>
      <div className="d-flex align-items-center gap-2">
        {right}
        <small className="text-muted">{summary}</small>
      </div>
    </div>
  )
}

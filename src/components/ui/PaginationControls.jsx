import '../../styles/components/PaginationControls.css'

function pageWindow(page, totalPages) {
  const pages = new Set([1, totalPages, page - 1, page, page + 1])
  return [...pages].filter((value) => value >= 1 && value <= totalPages).sort((left, right) => left - right)
}

export function PaginationControls({ page, totalItems, pageSize, totalPages, onPageChange }) {
  if (!totalItems || totalPages <= 1) return null

  const start = ((page - 1) * pageSize) + 1
  const end = Math.min(page * pageSize, totalItems)
  const pages = pageWindow(page, totalPages)

  return (
    <div className="pagination-controls">
      <div className="pagination-summary">Showing {start}-{end} of {totalItems}</div>
      <div className="pagination-actions">
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}>Previous</button>
        <div className="pagination-page-list">
          {pages.map((value) => (
            <button
              key={value}
              type="button"
              className={`pagination-page-btn ${value === page ? 'active' : ''}`}
              onClick={() => onPageChange(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}>Next</button>
      </div>
    </div>
  )
}

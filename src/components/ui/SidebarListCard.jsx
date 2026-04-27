export function SidebarListCard({
  title,
  items = [],
  emptyMessage = 'No data',
  renderRight,
  renderMeta,
  className = '',
}) {
  return (
    <div className={`sidebar-card ${className}`.trim()}>
      <div className="sidebar-title">{title}</div>
      {!items.length ? (
        <p className="text-muted small text-center mb-0">{emptyMessage}</p>
      ) : (
        <div className="d-flex flex-column gap-3">
          {items.map((item) => (
            <div key={item.key || item.id || item.label || item.name} className="d-flex align-items-center gap-3">
              {item.avatar ? item.avatar : (
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: item.avatarBg || '#e2e8f0',
                    color: item.avatarColor || '#0f172a',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {item.avatarText || item.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
              <div className="flex-grow-1 min-w-0">
                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.84rem' }}>{item.name || item.label}</div>
                {renderMeta ? renderMeta(item) : item.meta ? <div className="text-muted small">{item.meta}</div> : null}
              </div>
              {renderRight ? renderRight(item) : item.right ?? null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ProgressBar({ value = 0, max = 100, color = '#2563eb', className = '' }) {
  const safeMax = Math.max(1, Number(max) || 1)
  const safeValue = Math.max(0, Number(value) || 0)
  const pct = Math.min((safeValue / safeMax) * 100, 100)

  return (
    <div className={className} style={{ height: 8, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: color, transition: 'width 160ms ease' }} />
    </div>
  )
}

import { evaluatePasswordStrength } from '../../utils/adminValidation'

export function PasswordStrengthMeter({ password }) {
  const { score, label, color } = evaluatePasswordStrength(password)
  const width = `${Math.max(score, 1) * 20}%`

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ height: 8, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
        <div style={{ width: password ? width : '0%', height: '100%', background: color, transition: 'width 160ms ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 'var(--fs-fine)' }}>
        <span style={{ color: '#64748b' }}>Use 8+ characters with upper, lower, number, and symbol.</span>
        <span style={{ color }}>{label}</span>
      </div>
    </div>
  )
}


import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../../../components/ui/Toast'
import { AuthCard } from '../../../components/ui/AuthCard'
import { PasswordInput } from '../../../components/ui/PasswordInput'
import { authService } from '../services/authService'
import { setTokens, toUser } from '../../../lib/axios'
import { validateLoginForm } from '../../../utils/authValidation'
import '../../../styles/features/auth/Auth.css'

export function LoginPage() {
  const { setUser } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)

  const REDIRECT = { ADMIN: '/admin/dashboard', ADVISOR: '/advisor/dashboard', CUSTOMER: '/customer/dashboard' }

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    const { errors: nextErrors, isValid, normalized } = validateLoginForm(form)
    if (!isValid) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setLoading(true)
    try {
      const res = await authService.login(normalized)
      setTokens(res.data)
      const user = toUser(res.data)
      setUser(user)
      toast(`Welcome back, ${user.fullName?.split(' ')[0] || 'User'}!`)
      nav(REDIRECT[user.role] || '/customer/dashboard', { replace: true })
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard
      subtitle="Sign in to your account"
      error={error}
      footer={(
        <>
          <div className="text-center mt-3 label-sm">
            <Link to="/forgot-password" className="text-muted">Forgot password?</Link>
          </div>
          <hr />
          <div className="text-center label-sm">
            Don't have an account? <Link to="/register" style={{ color: 'var(--primary-accent)' }}>Register</Link>
          </div>
        </>
      )}
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-3">
          <label className="form-label fw-semibold label-sm">Email <span className="required-mark">*</span></label>
          <input
            type="email"
            className={`form-control ${errors.email ? 'is-invalid' : ''}`}
            value={form.email}
            onChange={(event) => updateField('email', event.target.value)}
            placeholder="you@example.com"
            autoFocus
          />
          {errors.email ? <div className="invalid-feedback">{errors.email}</div> : null}
        </div>
        <div className="mb-4">
          <label className="form-label fw-semibold label-sm">Password <span className="required-mark">*</span></label>
          <PasswordInput
            className="form-control"
            invalid={Boolean(errors.password)}
            value={form.password}
            onChange={(event) => updateField('password', event.target.value)}
            placeholder="Password"
            show={showPwd}
            onToggle={() => setShowPwd((current) => !current)}
          />
          {errors.password ? <div className="invalid-feedback d-block">{errors.password}</div> : null}
        </div>
        <button type="submit" className="btn btn-primary w-100" disabled={loading}>
          {loading ? 'Signing in...' : 'Login'}
        </button>
      </form>
    </AuthCard>
  )
}

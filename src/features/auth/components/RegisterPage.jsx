import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useToast } from '../../../components/ui/Toast'
import { AuthCard } from '../../../components/ui/AuthCard'
import { PasswordInput } from '../../../components/ui/PasswordInput'
import { PasswordStrengthMeter } from '../../../components/ui/PasswordStrengthMeter'
import { authService } from '../services/authService'
import { validateRegisterForm } from '../../../utils/authValidation'
import '../../../styles/features/auth/Auth.css'

export function RegisterPage() {
  const nav = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', gender: 'MALE', password: '' })
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const { errors: nextErrors, isValid, normalized } = validateRegisterForm(form)
    if (!isValid) {
      setErrors(nextErrors)
      setError('')
      return
    }
    if (!confirmPassword) {
      setErrors({ confirmPassword: 'Please confirm your password.' })
      setError('')
      return
    }
    if (form.password !== confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match.' })
      setError('')
      return
    }
    setError('')
    setLoading(true)
    try {
      await authService.register({ ...normalized, phone: normalized.phone || null })
      setErrors({})
      toast('Account created! Please log in.')
      nav('/login')
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard
      subtitle="Create your account"
      error={error}
      maxWidth={480}
      footer={(
        <div className="text-center mt-3 label-sm">
          Already have an account? <Link to="/login" style={{ color: 'var(--primary-accent)' }}>Login</Link>
        </div>
      )}
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="row g-3 mb-3">
          <div className="col-12">
            <label className="form-label fw-semibold label-sm">Full Name</label>
            <input className={`form-control ${errors.fullName ? 'is-invalid' : ''}`} value={form.fullName} required onChange={set('fullName')} placeholder="Your full name" />
            {errors.fullName ? <div className="invalid-feedback">{errors.fullName}</div> : null}
          </div>
          <div className="col-md-6">
            <label className="form-label fw-semibold label-sm">Email</label>
            <input type="email" className={`form-control ${errors.email ? 'is-invalid' : ''}`} value={form.email} required onChange={set('email')} />
            {errors.email ? <div className="invalid-feedback">{errors.email}</div> : null}
          </div>
          <div className="col-md-6">
            <label className="form-label fw-semibold label-sm">Phone</label>
            <input
              className={`form-control ${errors.phone ? 'is-invalid' : ''}`}
              value={form.phone}
              onChange={(event) => {
                setForm((current) => ({ ...current, phone: event.target.value.replace(/\D/g, '').slice(0, 10) }))
                setErrors((current) => ({ ...current, phone: undefined }))
                setError('')
              }}
              placeholder="10-digit mobile"
            />
            {errors.phone ? <div className="invalid-feedback">{errors.phone}</div> : null}
          </div>
          <div className="col-12">
            <label className="form-label fw-semibold d-block label-sm">Gender</label>
            <div className="d-flex gap-3 flex-wrap mt-2">
              {[['MALE', 'Male'], ['FEMALE', 'Female'], ['OTHER', 'Other']].map(([value, label]) => (
                <label key={value} className="form-check d-flex align-items-center gap-2 mb-0">
                  <input className="form-check-input m-0" type="radio" name="gender" value={value} checked={form.gender === value} onChange={set('gender')} />
                  <span className="form-check-label">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="col-md-6">
            <label className="form-label fw-semibold label-sm">Password</label>
            <PasswordInput
              className="form-control"
              invalid={Boolean(errors.password)}
              value={form.password}
              required
              minLength={8}
              onChange={set('password')}
              placeholder="Min 8 chars"
              show={showPassword}
              onToggle={() => setShowPassword((current) => !current)}
            />
            {errors.password ? <div className="invalid-feedback d-block">{errors.password}</div> : null}
            <PasswordStrengthMeter password={form.password} />
          </div>
          <div className="col-md-6">
            <label className="form-label fw-semibold label-sm">Confirm Password</label>
            <PasswordInput
              className="form-control"
              invalid={Boolean(errors.confirmPassword)}
              value={confirmPassword}
              required
              onChange={(event) => {
                setConfirmPassword(event.target.value)
                setErrors((current) => ({ ...current, confirmPassword: undefined }))
              }}
              show={showConfirmPassword}
              onToggle={() => setShowConfirmPassword((current) => !current)}
              ariaLabelShow="Show confirm password"
              ariaLabelHide="Hide confirm password"
            />
            {errors.confirmPassword ? <div className="invalid-feedback d-block">{errors.confirmPassword}</div> : null}
          </div>
        </div>
        <button type="submit" className="btn btn-primary w-100" disabled={loading}>{loading ? 'Creating...' : 'Register'}</button>
      </form>
    </AuthCard>
  )
}

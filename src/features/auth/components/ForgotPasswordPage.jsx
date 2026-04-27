import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useToast } from '../../../components/ui/Toast'
import { AuthCard } from '../../../components/ui/AuthCard'
import { PasswordInput } from '../../../components/ui/PasswordInput'
import { authService } from '../services/authService'
import '../../../styles/features/auth/Auth.css'

export function ForgotPasswordPage() {
  const nav = useNavigate()
  const toast = useToast()
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  async function requestOtp(event) {
    event?.preventDefault?.()
    setError('')
    setLoading(true)
    try {
      await authService.requestForgotPasswordOtp({ email: email.trim() })
      setStep(2)
      setOtp('')
      setResetToken('')
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to send OTP right now.')
    } finally {
      setLoading(false)
    }
  }

  async function verifyOtp(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await authService.verifyForgotPasswordOtp({ email: email.trim(), otp: otp.trim() })
      setResetToken(response.data?.resetToken || '')
      setStep(3)
    } catch (err) {
      setError(err.response?.data?.message || 'OTP verification failed.')
    } finally {
      setLoading(false)
    }
  }

  async function resetPassword(event) {
    event.preventDefault()
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setError('')
    setLoading(true)
    try {
      await authService.resetForgotPassword({ resetToken, newPassword })
      toast('Password reset successfully')
      nav('/login')
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard
      subtitle="Reset your password"
      error={error}
      footer={(
        <div className="text-center mt-3 label-sm">
          <Link to="/login" style={{ color: 'var(--primary-accent)' }}>Back to Login</Link>
        </div>
      )}
    >
      {step === 1 ? (
        <form onSubmit={requestOtp}>
          <div className="mb-4">
            <label className="form-label fw-semibold label-sm">Email</label>
            <input type="email" className="form-control" value={email} required onChange={(event) => setEmail(event.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary w-100" disabled={loading}>{loading ? 'Sending...' : 'Send OTP'}</button>
        </form>
      ) : null}

      {step === 2 ? (
        <form onSubmit={verifyOtp}>
          <div className="mb-2">
            <label className="form-label fw-semibold label-sm">Email</label>
            <input type="email" className="form-control" value={email} disabled />
          </div>
          <div className="mb-3">
            <label className="form-label fw-semibold label-sm">OTP</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              className="form-control"
              value={otp}
              required
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </div>
          <button type="submit" className="btn btn-primary w-100" disabled={loading}>{loading ? 'Verifying...' : 'Verify OTP'}</button>
          <button type="button" className="btn btn-outline-secondary w-100 mt-2" disabled={loading} onClick={requestOtp}>Resend OTP</button>
        </form>
      ) : null}

      {step === 3 ? (
        <form onSubmit={resetPassword}>
          <div className="mb-3">
            <label className="form-label fw-semibold label-sm">New Password</label>
            <PasswordInput
              className="form-control"
              value={newPassword}
              required
              minLength={8}
              onChange={(event) => setNewPassword(event.target.value)}
              show={showNewPassword}
              onToggle={() => setShowNewPassword((current) => !current)}
              ariaLabelShow="Show new password"
              ariaLabelHide="Hide new password"
            />
          </div>
          <div className="mb-4">
            <label className="form-label fw-semibold label-sm">Confirm Password</label>
            <PasswordInput
              className="form-control"
              value={confirmPassword}
              required
              onChange={(event) => setConfirmPassword(event.target.value)}
              show={showConfirmPassword}
              onToggle={() => setShowConfirmPassword((current) => !current)}
              ariaLabelShow="Show confirm password"
              ariaLabelHide="Hide confirm password"
            />
          </div>
          <button type="submit" className="btn btn-primary w-100" disabled={loading}>{loading ? 'Resetting...' : 'Reset Password'}</button>
        </form>
      ) : null}
    </AuthCard>
  )
}

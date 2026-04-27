import { useState } from 'react'
import { profileService } from '../services/profileService'
import { useToast } from '../../../components/ui/Toast'
import { hideModal, showModal } from '../../../components/ui/Modal'

function validateOtp(otp = '') {
  if (!otp.trim()) return 'OTP is required.'
  if (!/^\d{6}$/.test(otp.trim())) return 'OTP must be 6 digits.'
  return ''
}

function validateNewPassword(newPassword = '', confirmNewPassword = '') {
  if (!newPassword) return { newPassword: 'New password is required.' }
  if (newPassword.length < 8) return { newPassword: 'Password must be at least 8 characters.' }
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])/.test(newPassword)) {
    return { newPassword: 'Password must include uppercase, lowercase, digit, and special character.' }
  }
  if (newPassword !== confirmNewPassword) return { confirmNewPassword: 'Passwords do not match.' }
  return {}
}

export function useProfilePasswordChange(modalId) {
  const toast = useToast()
  const [step, setStep] = useState('otp')
  const [otp, setOtp] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [sendingOtp, setSendingOtp] = useState(false)
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [otpRequested, setOtpRequested] = useState(false)
  const [fallbackOtp, setFallbackOtp] = useState('')

  function reset() {
    setStep('otp')
    setOtp('')
    setResetToken('')
    setNewPassword('')
    setConfirmNewPassword('')
    setErrors({})
    setSendingOtp(false)
    setVerifyingOtp(false)
    setSavingPassword(false)
    setOtpRequested(false)
    setFallbackOtp('')
  }

  async function open() {
    reset()
    showModal(modalId)
    setSendingOtp(true)
    try {
      const response = await profileService.requestPasswordOtp()
      setOtpRequested(true)
      setFallbackOtp(response.data?.fallbackOtp || '')
      toast(response.data?.fallbackOtp
        ? `Email delivery is unavailable. Use the default OTP: ${response.data.fallbackOtp}`
        : (response.data?.message || 'OTP was sent to your registered email address.'))
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to send OTP.', 'error')
    } finally {
      setSendingOtp(false)
    }
  }

  async function resendOtp() {
    setErrors({})
    setSendingOtp(true)
    try {
      const response = await profileService.requestPasswordOtp()
      setOtpRequested(true)
      setFallbackOtp(response.data?.fallbackOtp || '')
      toast(response.data?.fallbackOtp
        ? `Email delivery is unavailable. Use the default OTP: ${response.data.fallbackOtp}`
        : (response.data?.message || 'A fresh OTP was sent to your registered email address.'))
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to resend OTP.', 'error')
    } finally {
      setSendingOtp(false)
    }
  }

  async function verify() {
    const otpError = validateOtp(otp)
    if (otpError) {
      setErrors({ otp: otpError })
      return
    }

    setVerifyingOtp(true)
    try {
      const response = await profileService.verifyPasswordOtp({ otp: otp.trim() })
      setResetToken(response.data?.resetToken || '')
      setErrors({})
      setStep('password')
      toast('OTP verified. You can now set a new password.')
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to verify OTP.', 'error')
    } finally {
      setVerifyingOtp(false)
    }
  }

  async function submitNewPassword() {
    const nextErrors = validateNewPassword(newPassword, confirmNewPassword)
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }

    setSavingPassword(true)
    try {
      await profileService.changePassword({
        resetToken,
        newPassword,
      })
      toast('Password changed successfully.')
      hideModal(modalId)
      reset()
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to change password.', 'error')
    } finally {
      setSavingPassword(false)
    }
  }

  return {
    step,
    otp,
    newPassword,
    confirmNewPassword,
    errors,
    sendingOtp,
    verifyingOtp,
    savingPassword,
    otpRequested,
    fallbackOtp,
    setOtp: (value) => {
      setOtp(value.replace(/\D/g, '').slice(0, 6))
      setErrors((current) => ({ ...current, otp: undefined }))
    },
    setNewPassword: (value) => {
      setNewPassword(value)
      setErrors((current) => ({ ...current, newPassword: undefined }))
    },
    setConfirmNewPassword: (value) => {
      setConfirmNewPassword(value)
      setErrors((current) => ({ ...current, confirmNewPassword: undefined }))
    },
    open,
    reset,
    resendOtp,
    verify,
    submitNewPassword,
  }
}

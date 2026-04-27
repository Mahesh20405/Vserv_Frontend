import { useState } from 'react'
import { Modal, hideModal } from '../../../components/ui/Modal'
import { PasswordInput } from '../../../components/ui/PasswordInput'

export function PasswordChangeModal({
  id,
  title = 'Change Password',
  step = 'otp',
  otp = '',
  otpRequested = false,
  fallbackOtp = '',
  newPassword = '',
  confirmNewPassword = '',
  errors,
  sendingOtp,
  verifyingOtp,
  savingPassword,
  onOtpChange,
  onNewPasswordChange,
  onConfirmChange,
  onVerifyOtp,
  onResendOtp,
  onSubmitNewPassword,
  onClose,
}) {
  const isPasswordStep = step === 'password'
  const submitLabel = isPasswordStep ? (savingPassword ? 'Updating...' : 'Update Password') : (verifyingOtp ? 'Verifying...' : 'Verify OTP')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  return (
    <Modal
      id={id}
      title={title}
      size="lg"
      onClose={onClose}
      headerClassName="profile-password-modal-header text-white"
      bodyClassName="modal-body"
      footer={(
        <>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => hideModal(id)} disabled={sendingOtp || verifyingOtp || savingPassword}>
            Cancel
          </button>
          <button type="submit" form={`${id}-form`} className="btn btn-sm btn-primary" disabled={sendingOtp || verifyingOtp || savingPassword || (step === 'otp' && !otpRequested)}>
            {submitLabel}
          </button>
        </>
      )}
    >
      <form id={`${id}-form`} onSubmit={(event) => {
        event.preventDefault()
        if (isPasswordStep) onSubmitNewPassword()
        else onVerifyOtp()
      }}>
        <div className="bookings-modal-desc mb-3">
          {isPasswordStep
            ? 'Your OTP has been verified. Choose a new password that meets the platform security rules.'
            : 'We will verify your identity with a one-time password before allowing this password change.'}
        </div>

        <div className="row g-3">
          {!isPasswordStep ? (
            <>
              <div className="col-12">
                <div className={`alert ${fallbackOtp ? 'alert-warning' : otpRequested ? 'alert-info' : 'alert-secondary'} py-2 px-3 mb-0 small`}>
                  {sendingOtp
                    ? 'Sending OTP to your registered email address...'
                    : fallbackOtp
                      ? `Email delivery is unavailable right now. Use the default OTP ${fallbackOtp} to continue.`
                      : otpRequested
                        ? 'An OTP was sent to your registered email address. Enter it below to continue.'
                        : 'Requesting OTP...'}
                </div>
              </div>
              <div className="col-12">
                <label className="modal-form-label">OTP</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className={`form-control modal-form-control ${errors.otp ? 'is-invalid' : ''}`}
                  value={otp}
                  maxLength={6}
                  placeholder="Enter 6-digit OTP"
                  onChange={(event) => onOtpChange(event.target.value)}
                />
                {errors.otp ? <div className="invalid-feedback d-block">{errors.otp}</div> : null}
              </div>
              <div className="col-12">
                <button type="button" className="btn btn-sm btn-link px-0" onClick={onResendOtp} disabled={sendingOtp || verifyingOtp}>
                  {sendingOtp ? 'Resending...' : 'Resend OTP'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="col-12">
                <div className="alert alert-success py-2 px-3 mb-0 small">
                  OTP verified. Set your new password below.
                </div>
              </div>
              <div className="col-12">
                <label className="modal-form-label">New Password</label>
                <PasswordInput
                  className="form-control modal-form-control"
                  value={newPassword}
                  onChange={(event) => onNewPasswordChange(event.target.value)}
                  invalid={Boolean(errors.newPassword)}
                  show={showNewPassword}
                  onToggle={() => setShowNewPassword((current) => !current)}
                  ariaLabelShow="Show new password"
                  ariaLabelHide="Hide new password"
                />
                {errors.newPassword ? <div className="invalid-feedback d-block">{errors.newPassword}</div> : null}
              </div>
              <div className="col-12">
                <label className="modal-form-label">Confirm Password</label>
                <PasswordInput
                  className="form-control modal-form-control"
                  value={confirmNewPassword}
                  onChange={(event) => onConfirmChange(event.target.value)}
                  invalid={Boolean(errors.confirmNewPassword)}
                  show={showConfirmPassword}
                  onToggle={() => setShowConfirmPassword((current) => !current)}
                  ariaLabelShow="Show confirm password"
                  ariaLabelHide="Hide confirm password"
                />
                {errors.confirmNewPassword ? <div className="invalid-feedback d-block">{errors.confirmNewPassword}</div> : null}
              </div>
            </>
          )}
          <div className="col-12">
            <div className="form-text">
              Passwords must be at least 8 characters and include uppercase, lowercase, a number, and a special character.
            </div>
          </div>
        </div>
      </form>
    </Modal>
  )
}

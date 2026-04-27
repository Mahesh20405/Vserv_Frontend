import { useState, useEffect } from 'react'
import { AdminLayout } from '../../../layouts/AppShell'
import { AdminPageHero, PageContent } from '../../../components/common/PageElements'
import { PageSpinner } from '../../../components/ui/Spinner'
import { useToast } from '../../../components/ui/Toast'
import { ActionIconButton } from '../../../components/ui/ActionIconButton'
import { validateProfileForm } from '../../../utils/adminValidation'
import { formatDateTime } from '../../../utils/formatters'
import { useProfilePasswordChange } from '../hooks/useProfilePasswordChange'
import { profileService } from '../services/profileService'
import { PasswordChangeModal } from './PasswordChangeModal'
import '../../../styles/features/profile/Profile.css'

const CHANGE_PASSWORD_MODAL_ID = 'admin-change-password-modal'

function getInitials(name = '') {
  return name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'AD'
}

export function AdminProfilePage() {
  const toast = useToast()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ fullName: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [profileErrors, setProfileErrors] = useState({})
  const passwordChange = useProfilePasswordChange(CHANGE_PASSWORD_MODAL_ID)

  useEffect(() => {
    profileService.get().then((r) => {
      setProfile(r.data)
      setForm({ fullName: r.data.fullName || '', phone: r.data.phone || '' })
    }).finally(() => setLoading(false))
  }, [])

  async function saveProfile(e) {
    e.preventDefault()
    const { errors, isValid } = validateProfileForm(form)
    if (!isValid) {
      setProfileErrors(errors)
      return
    }
    setSaving(true)
    try {
      await profileService.update(form)
      toast('Profile updated!')
      setEditing(false)
      setProfileErrors({})
      const r = await profileService.get()
      setProfile(r.data)
    } catch {
      toast('Update failed.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <AdminLayout activeKey="profile"><PageSpinner /></AdminLayout>

  return (
    <AdminLayout activeKey="profile">
      <div className="admin-profile-page">
        <AdminPageHero
          title="My Profile"
          subtitle="Manage your account details and password in a consistent profile workspace."
          actions={(
            <button type="button" className="btn btn-primary" onClick={passwordChange.open}>
              Change Password
            </button>
          )}
        />
        <PageContent>
          <div className="profile-workspace">
            <div>
              <div className="profile-sidebar-card">
                <div className="profile-sidebar-top">
                  <div className="profile-avatar" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)' }}>{getInitials(profile?.fullName)}</div>
                  <div className="profile-name">{profile?.fullName || 'Admin'}</div>
                  <div className="profile-email">{profile?.email || '-'}</div>
                  <div className="profile-meta">Administrator Account</div>
                  <div className="profile-badges">
                    <span className="profile-chip">{profile?.role || 'ADMIN'}</span>
                    <span className="profile-chip">{profile?.status || 'ACTIVE'}</span>
                  </div>
                </div>

                <div className="profile-detail-list">
                  {[
                    ['Phone', profile?.phone || '-'],
                    ['Last Login', profile?.lastLogin ? formatDateTime(profile.lastLogin) : '-'],
                    ['Access Level', 'System Administrator'],
                  ].map(([label, value]) => (
                    <div key={label} className="profile-detail-item">
                      <span className="profile-detail-key">{label}</span>
                      <span className="profile-detail-text">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="profile-main-stack">
              <div className="section-card">
                <div className="section-header">
                  <div>
                    <div className="profile-section-heading">Personal Information</div>
                    <div className="profile-section-subtitle">Maintain the admin account details used across dashboards, notifications, and secure access flows.</div>
                  </div>
                  {!editing && <ActionIconButton icon="edit" label="Edit profile" onClick={() => setEditing(true)} />}
                </div>
                <div className="section-body">
                  {editing ? (
                    <form onSubmit={saveProfile}>
                      <div className="row g-3">
                        <div className="col-md-6"><label className="form-label label-sm">Full Name</label><input className={`form-control form-control-sm ${profileErrors.fullName ? 'is-invalid' : ''}`} value={form.fullName} onChange={(e) => { setForm((p) => ({ ...p, fullName: e.target.value })); setProfileErrors((p) => ({ ...p, fullName: undefined })) }} required />{profileErrors.fullName ? <div className="invalid-feedback">{profileErrors.fullName}</div> : null}</div>
                        <div className="col-md-6"><label className="form-label label-sm">Phone</label><input className={`form-control form-control-sm ${profileErrors.phone ? 'is-invalid' : ''}`} value={form.phone} onChange={(e) => { setForm((p) => ({ ...p, phone: e.target.value.replace(/\D/g, '') })); setProfileErrors((p) => ({ ...p, phone: undefined })) }} />{profileErrors.phone ? <div className="invalid-feedback">{profileErrors.phone}</div> : null}</div>
                        <div className="col-md-6"><label className="form-label label-sm">Email</label><input className="form-control form-control-sm" value={profile?.email || ''} disabled /></div>
                        <div className="col-md-6"><label className="form-label label-sm">Account Status</label><input className="form-control form-control-sm" value={profile?.status || 'ACTIVE'} disabled /></div>
                      </div>
                      <div className="d-flex gap-2 mt-3">
                        <button type="submit" className="btn btn-sm btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setEditing(false); setProfileErrors({}); setForm({ fullName: profile?.fullName || '', phone: profile?.phone || '' }) }}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <div className="row g-3">
                      {[['Full Name', profile?.fullName], ['Email', profile?.email], ['Phone', profile?.phone || '-'], ['Status', profile?.status || 'ACTIVE']].map(([label, value]) => (
                        <div key={label} className="col-md-6"><div className="detail-label">{label}</div><div className="detail-value">{value}</div></div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="section-card">
                <div className="section-header">
                  <div>
                    <div className="profile-section-heading">Account Summary</div>
                    <div className="profile-section-subtitle">A compact overview of administrator access and the current profile workspace.</div>
                  </div>
                </div>
                <div className="section-body">
                  <div className="row g-3">
                    {[['Role', profile?.role || 'ADMIN'], ['Last Login', profile?.lastLogin ? formatDateTime(profile.lastLogin) : '-'], ['Workspace', 'Admin Console'], ['Security', 'Password managed from the header action']].map(([label, value]) => (
                      <div key={label} className="col-md-6"><div className="detail-label">{label}</div><div className="detail-value">{value}</div></div>
                    ))}
                  </div>
                  <div className="profile-note mt-3">
                    Use this shared profile layout to keep core account details current while sensitive password changes stay isolated in the modal flow.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <PasswordChangeModal
            id={CHANGE_PASSWORD_MODAL_ID}
            title="Change Admin Password"
            step={passwordChange.step}
            otp={passwordChange.otp}
            otpRequested={passwordChange.otpRequested}
            fallbackOtp={passwordChange.fallbackOtp}
            newPassword={passwordChange.newPassword}
            confirmNewPassword={passwordChange.confirmNewPassword}
            errors={passwordChange.errors}
            sendingOtp={passwordChange.sendingOtp}
            verifyingOtp={passwordChange.verifyingOtp}
            savingPassword={passwordChange.savingPassword}
            onOtpChange={passwordChange.setOtp}
            onNewPasswordChange={passwordChange.setNewPassword}
            onConfirmChange={passwordChange.setConfirmNewPassword}
            onVerifyOtp={passwordChange.verify}
            onResendOtp={passwordChange.resendOtp}
            onSubmitNewPassword={passwordChange.submitNewPassword}
            onClose={passwordChange.reset}
          />
        </PageContent>
      </div>
    </AdminLayout>
  )
}

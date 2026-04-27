import { useEffect, useMemo, useState } from 'react'
import { CustomerLayout } from '../../../layouts/AppShell'
import { CustomerPageHero, PageContent } from '../../../components/common/PageElements'
import { PageSpinner } from '../../../components/ui/Spinner'
import { useToast } from '../../../components/ui/Toast'
import { ActionIconButton } from '../../../components/ui/ActionIconButton'
import { formatDate, formatDateTime } from '../../../utils/formatters'
import { validateProfileForm } from '../../../utils/adminValidation'
import { useAuth } from '../../auth/hooks/useAuth'
import { useNavigationGuard } from '../../../hooks/useNavigationGuard'
import { bookingService } from '../../bookings/services/bookingService'
import { invoiceService } from '../../invoices/services/invoiceService'
import { profileService } from '../services/profileService'
import { useProfilePasswordChange } from '../hooks/useProfilePasswordChange'
import { vehicleService } from '../../vehicles/services/vehicleService'
import { PasswordChangeModal } from './PasswordChangeModal'
import '../../../styles/features/profile/Profile.css'

function getInitials(name = '') {
  return name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'CU'
}

const EMPTY_FORM = { fullName: '', phone: '' }
const CHANGE_PASSWORD_MODAL_ID = 'customer-change-password-modal'

export function CustomerProfilePage() {
  const toast = useToast()
  const { user, setUser } = useAuth()
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState({ vehicles: 0, bookings: 0, invoices: 0 })
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [profileErrors, setProfileErrors] = useState({})
  const [savingProfile, setSavingProfile] = useState(false)
  const passwordChange = useProfilePasswordChange(CHANGE_PASSWORD_MODAL_ID)

  useNavigationGuard(
    editing || Boolean(passwordChange.otp || passwordChange.newPassword || passwordChange.confirmNewPassword || savingProfile || passwordChange.sendingOtp || passwordChange.verifyingOtp || passwordChange.savingPassword),
    'Profile changes are still in progress. Leaving now will discard the current updates. Continue?'
  )

  function syncForm(nextProfile) {
    setForm({
      fullName: nextProfile?.fullName || '',
      phone: nextProfile?.phone || '',
    })
  }

  async function refreshProfile() {
    if (!user?.userId) return

    const [profileRes, vehiclesRes, bookingsRes, invoicesRes] = await Promise.all([
      profileService.get(),
      vehicleService.byUser(user.userId),
      bookingService.list(),
      invoiceService.list(),
    ])

    const nextProfile = profileRes.data
    setProfile(nextProfile)
    syncForm(nextProfile)
    setStats({
      vehicles: (vehiclesRes.data || []).length,
      bookings: (bookingsRes.data || []).length,
      invoices: (invoicesRes.data || []).length,
    })
  }

  useEffect(() => {
    if (!user?.userId) return
    refreshProfile().finally(() => setLoading(false))
  }, [user?.userId])

  const sidebarDetails = useMemo(() => ([
    ['Phone', profile?.phone || '-'],
    ['Gender', profile?.gender || '-'],
    ['Member Since', formatDate(profile?.createdAt)],
    ['Last Login', formatDateTime(profile?.lastLogin)],
  ]), [profile])

  async function saveProfile(event) {
    event.preventDefault()
    const { errors, isValid } = validateProfileForm(form)
    if (!isValid) {
      setProfileErrors(errors)
      return
    }

    setSavingProfile(true)
    try {
      const response = await profileService.update({
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
      })
      setProfileErrors({})
      setEditing(false)
      setProfile(response.data)
      if (user) {
        setUser({ ...user, fullName: response.data.fullName, phone: response.data.phone })
      }
      toast('Profile updated!')
      await refreshProfile()
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to update profile.', 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  if (loading) return <CustomerLayout activeKey="profile"><PageSpinner /></CustomerLayout>

  return (
    <CustomerLayout activeKey="profile">
      <div className="customer-profile-page">
        <CustomerPageHero
          title="My Profile"
          subtitle="Manage your account, personal details, and security settings from one consistent workspace."
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
                  <div className="profile-avatar" style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' }}>{getInitials(profile?.fullName)}</div>
                  <div className="profile-name">{profile?.fullName || 'Customer'}</div>
                  <div className="profile-email">{profile?.email || '-'}</div>
                  <div className="profile-meta">Customer Account</div>
                  <div className="profile-badges">
                    <span className="profile-chip">{profile?.role || 'CUSTOMER'}</span>
                    <span className="profile-chip">{profile?.status || 'ACTIVE'}</span>
                    {profile?.loyaltyEligible ? <span className="profile-chip profile-chip-success">Loyalty Badge</span> : null}
                  </div>
                </div>

                <div className="profile-stat-grid">
                  {[
                    ['Vehicles', stats.vehicles],
                    ['Bookings', stats.bookings],
                    ['Invoices', stats.invoices],
                  ].map(([label, value]) => (
                    <div key={label} className="profile-stat-card">
                      <div className="profile-stat-value">{value}</div>
                      <div className="profile-stat-label">{label}</div>
                    </div>
                  ))}
                </div>

                <div className="profile-detail-list">
                  {sidebarDetails.map(([label, value]) => (
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
                    <div className="profile-section-subtitle">Update the customer details used across bookings, invoices, and account communication.</div>
                  </div>
                  {!editing && <ActionIconButton icon="edit" label="Edit profile" onClick={() => { setEditing(true); setProfileErrors({}) }} />}
                </div>
                <div className="section-body">
                  {editing ? (
                    <form onSubmit={saveProfile}>
                      <div className="row g-3">
                        {[['fullName', 'Full Name'], ['phone', 'Phone']].map(([key, label]) => (
                          <div key={key} className="col-md-6">
                            <label className="customer-profile-field-label">{label}</label>
                            <input
                              className={`form-control form-control-sm ${profileErrors[key] ? 'is-invalid' : ''}`}
                              value={form[key]}
                              onChange={(event) => {
                                const value = key === 'phone' ? event.target.value.replace(/\D/g, '') : event.target.value
                                setForm((current) => ({ ...current, [key]: value }))
                                setProfileErrors((current) => ({ ...current, [key]: undefined }))
                              }}
                            />
                            {profileErrors[key] ? <div className="invalid-feedback">{profileErrors[key]}</div> : null}
                          </div>
                        ))}
                        <div className="col-md-6">
                          <label className="customer-profile-field-label">Email Address</label>
                          <input className="form-control form-control-sm" value={profile?.email || ''} disabled />
                        </div>
                        <div className="col-md-6">
                          <label className="customer-profile-field-label">Gender</label>
                          <input className="form-control form-control-sm" value={profile?.gender || ''} disabled />
                        </div>
                      </div>
                      <div className="d-flex gap-2 mt-3">
                        <button type="submit" className="btn btn-sm btn-primary" disabled={savingProfile}>{savingProfile ? 'Saving...' : 'Save Changes'}</button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => {
                            setEditing(false)
                            setProfileErrors({})
                            syncForm(profile)
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="row g-3">
                      {[
                        ['Full Name', profile?.fullName || '-'],
                        ['Email Address', profile?.email || '-'],
                        ['Phone Number', profile?.phone || '-'],
                        ['Gender', profile?.gender || '-'],
                      ].map(([label, value]) => (
                        <div key={label} className="col-md-6">
                          <div className="detail-label">{label}</div>
                          <div className="detail-value">{value}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="section-card">
                <div className="section-header">
                  <div>
                    <div className="profile-section-heading">Account Summary</div>
                    <div className="profile-section-subtitle">A compact overview of account state, membership, and earned customer benefits.</div>
                  </div>
                </div>
                <div className="section-body">
                  <div className="row g-3">
                    {[
                      ['Role', profile?.role || 'CUSTOMER'],
                      ['Account Status', profile?.status || 'ACTIVE'],
                      ['Loyalty Program', profile?.loyaltyEligible ? 'Badge earned' : 'Not earned yet'],
                      ['Membership', formatDate(profile?.createdAt)],
                    ].map(([label, value]) => (
                      <div key={label} className="col-md-6">
                        <div className="detail-label">{label}</div>
                        <div className="detail-value">{value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="profile-note mt-3">
                    Keep your profile current so booking updates, invoices, and service notifications stay consistent everywhere in the system.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <PasswordChangeModal
            id={CHANGE_PASSWORD_MODAL_ID}
            title="Change Customer Password"
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
    </CustomerLayout>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { AdvisorLayout } from '../../../layouts/AppShell'
import { PageSpinner } from '../../../components/ui/Spinner'
import { useToast } from '../../../components/ui/Toast'
import { ActionIconButton } from '../../../components/ui/ActionIconButton'
import { StatusBadge } from '../../../components/ui/Badge'
import { formatDate, formatDateTime } from '../../../utils/formatters'
import { validateProfileForm } from '../../../utils/adminValidation'
import { useAuth } from '../../auth/hooks/useAuth'
import { profileService } from '../services/profileService'
import { useProfilePasswordChange } from '../hooks/useProfilePasswordChange'
import { serviceRecordService } from '../../service-records/services/serviceRecordService'
import { PasswordChangeModal } from './PasswordChangeModal'
import '../../../styles/features/profile/Profile.css'

const AVATAR_COLORS = ['#f97316', '#0f766e', '#2563eb', '#7c3aed', '#16a34a', '#dc2626', '#0ea5e9', '#db2777']
const CHANGE_PASSWORD_MODAL_ID = 'advisor-change-password-modal'

function getInitials(name = '') {
  return name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'AD'
}

function getAvatarColor(name = '') {
  const hash = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

export function AdvisorProfilePage() {
  const toast = useToast()
  const { user, setUser } = useAuth()
  const [profile, setProfile] = useState(null)
  const [advisorMeta, setAdvisorMeta] = useState(null)
  const [activity, setActivity] = useState([])
  const [showAllActivity, setShowAllActivity] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ fullName: '', phone: '' })
  const [profileErrors, setProfileErrors] = useState({})
  const [savingProfile, setSavingProfile] = useState(false)
  const passwordChange = useProfilePasswordChange(CHANGE_PASSWORD_MODAL_ID)

  async function refreshProfile() {
    const [profileRes, recordsRes] = await Promise.all([
      profileService.get(),
      serviceRecordService.list(),
    ])

    const nextProfile = profileRes.data
    const records = recordsRes.data || []

    setProfile(nextProfile)
    setAdvisorMeta(nextProfile || null)
    setForm({
      fullName: nextProfile.fullName || '',
      phone: nextProfile.phone || '',
    })
    setActivity(records.slice().sort((a, b) => new Date(b.serviceDate || b.updatedAt || 0) - new Date(a.serviceDate || a.updatedAt || 0)))
  }

  useEffect(() => {
    refreshProfile().finally(() => setLoading(false))
  }, [])

  const profileRows = useMemo(() => ([
    ['Email', profile?.email || '-'],
    ['Phone', profile?.phone || '-'],
    ['Specialization', advisorMeta?.specialization || '-'],
    ['Overtime Rate', advisorMeta?.overtimeRate != null ? `Rs.${advisorMeta.overtimeRate}/hr` : '-'],
    ['Member Since', formatDate(profile?.createdAt)],
    ['Last Login', formatDateTime(profile?.lastLogin)],
  ]), [profile, advisorMeta])

  const serviceStats = useMemo(() => ([
    ['Assigned', activity.length],
    ['Pending', activity.filter((record) => (record.status || record.serviceStatus) === 'PENDING').length],
    ['Active', activity.filter((record) => (record.status || record.serviceStatus) === 'IN_PROGRESS').length],
    ['Done', activity.filter((record) => (record.status || record.serviceStatus) === 'COMPLETED').length],
  ]), [activity])

  async function saveProfile(e) {
    e.preventDefault()
    const { errors, isValid } = validateProfileForm(form)
    if (!isValid) {
      setProfileErrors(errors)
      return
    }

    setSavingProfile(true)
    try {
      const response = await profileService.update(form)
      setProfileErrors({})
      setEditing(false)
      setProfile(response.data)
      if (user) {
        setUser({ ...user, fullName: response.data.fullName, phone: response.data.phone })
      }
      toast('Profile updated!')
      await refreshProfile()
    } catch (err) {
      toast(err.response?.data?.message || 'Update failed.', 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  if (loading) return <AdvisorLayout><PageSpinner /></AdvisorLayout>

  const visibleActivity = showAllActivity ? activity : activity.slice(0, 3)

  return (
    <AdvisorLayout activeKey="profile">
      <div className="advisor-hero advisor-hero--blue">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <h4 className="mb-0 fw-bold">My Profile</h4>
            <div style={{ opacity: 0.88, fontSize: 'var(--fs-label)', marginTop: 4 }}>Manage your advisor identity, workload snapshot, and account settings in one place.</div>
          </div>
          <button type="button" className="btn btn-primary" onClick={passwordChange.open}>
            Change Password
          </button>
        </div>
      </div>

      <div className="page-shell">
        <div className="profile-workspace">
          <div>
            <div className="profile-sidebar-card">
              <div className="profile-sidebar-top">
                <div className="profile-avatar" style={{ background: `linear-gradient(135deg, ${getAvatarColor(profile?.fullName || '')} 0%, #1e40af 100%)` }}>
                  {getInitials(profile?.fullName)}
                </div>
                <div className="profile-name">{profile?.fullName || 'Advisor'}</div>
                <div className="profile-email">{profile?.email || '-'}</div>
                <div className="profile-meta">Service Advisor Profile</div>
                <div className="profile-badges">
                  <span className="profile-chip">{profile?.role || 'ADVISOR'}</span>
                  <span className="profile-chip">{profile?.status || 'ACTIVE'}</span>
                  {advisorMeta?.availabilityStatus ? <StatusBadge status={advisorMeta.availabilityStatus} /> : null}
                </div>
              </div>

              <div className="profile-stat-grid">
                {serviceStats.map(([label, value]) => (
                  <div key={label} className="profile-stat-card">
                    <div className="profile-stat-value">{value}</div>
                    <div className="profile-stat-label">{label}</div>
                  </div>
                ))}
              </div>

              <div className="profile-detail-list">
                {profileRows.map(([label, value]) => (
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
                  <div className="profile-section-subtitle">Update the advisor account details that appear across assignment, service, and workload views.</div>
                </div>
                {!editing && <ActionIconButton icon="edit" label="Edit profile" onClick={() => { setEditing(true); setProfileErrors({}) }} />}
              </div>
              <div className="section-body">
                {editing ? (
                  <form onSubmit={saveProfile}>
                    <div className="row g-3">
                      {[['fullName', 'Full Name'], ['phone', 'Phone']].map(([key, label]) => (
                        <div key={key} className="col-md-6">
                          <label className="form-label label-sm">{label}</label>
                          <input
                            className={`form-control form-control-sm ${profileErrors[key] ? 'is-invalid' : ''}`}
                            value={form[key]}
                            onChange={(e) => {
                              const value = key === 'phone' ? e.target.value.replace(/\D/g, '') : e.target.value
                              setForm((prev) => ({ ...prev, [key]: value }))
                              setProfileErrors((prev) => ({ ...prev, [key]: undefined }))
                            }}
                          />
                          {profileErrors[key] ? <div className="invalid-feedback">{profileErrors[key]}</div> : null}
                        </div>
                      ))}
                      <div className="col-md-6"><label className="form-label label-sm">Email</label><input className="form-control form-control-sm" value={profile?.email || ''} disabled /></div>
                      <div className="col-md-6"><label className="form-label label-sm">Specialization</label><input className="form-control form-control-sm" value={advisorMeta?.specialization || ''} disabled /></div>
                    </div>
                    <div className="d-flex gap-2 mt-3">
                      <button type="submit" className="btn btn-sm btn-primary" disabled={savingProfile}>{savingProfile ? 'Saving...' : 'Save Changes'}</button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => {
                          setEditing(false)
                          setProfileErrors({})
                          setForm({
                            fullName: profile?.fullName || '',
                            phone: profile?.phone || '',
                          })
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
                      ['Email', profile?.email || '-'],
                      ['Phone', profile?.phone || '-'],
                      ['Specialization', advisorMeta?.specialization || '-'],
                      ['Overtime Rate', advisorMeta?.overtimeRate != null ? `Rs.${advisorMeta.overtimeRate}/hr` : '-'],
                      ['Availability', advisorMeta?.availabilityStatus || '-'],
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
                  <div className="profile-section-heading">Recent Activity</div>
                  <div className="profile-section-subtitle">A live view of recently handled services and the current advisor queue.</div>
                </div>
              </div>
              <div className="section-body">
                {!visibleActivity.length && <div className="empty-sm">No recent service activity.</div>}
                {visibleActivity.map((record) => (
                  <div key={record.serviceId} className="list-item">
                    <div className="list-item-main">
                      <div className="list-item-title">{record.serviceName || 'Service'} - {record.vehicleInfo || 'Vehicle'}</div>
                      <div className="list-item-sub">{record.customerName || 'Customer'} · {formatDate(record.serviceDate)}</div>
                    </div>
                    <div className="list-item-meta">
                      <StatusBadge status={record.status || record.serviceStatus || 'PENDING'} />
                    </div>
                  </div>
                ))}
                {activity.length > 3 ? (
                  <button className="btn btn-sm btn-outline-secondary mt-2 w-100" onClick={() => setShowAllActivity((value) => !value)}>
                    {showAllActivity ? 'View Less' : `View More (${activity.length - 3})`}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <PasswordChangeModal
            id={CHANGE_PASSWORD_MODAL_ID}
            title="Change Advisor Password"
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
      </div>
    </AdvisorLayout>
  )
}

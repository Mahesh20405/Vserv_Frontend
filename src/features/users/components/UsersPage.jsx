import { useEffect, useState } from 'react'
import { AdminLayout } from '../../../layouts/AppShell'
import { PageSpinner } from '../../../components/ui/Spinner'
import { StatusBadge } from '../../../components/ui/Badge'
import { useToast } from '../../../components/ui/Toast'
import { ActionIconButton } from '../../../components/ui/ActionIconButton'
import { PaginationControls } from '../../../components/ui/PaginationControls'
import { PillStat } from '../../../components/ui/PillStat'
import { PillStatRow } from '../../../components/ui/PillStatRow'
import { formatDate, timeAgo } from '../../../utils/formatters'
import { normalizeRegistrationNumber, validateUserForm } from '../../../utils/adminValidation'
import { useNavigationGuard } from '../../../hooks/useNavigationGuard'
import { readPaginatedData } from '../../../services/pagination'
import { CAR_TYPES, ROLES, USER_STATUSES } from '../../../config/constants'
import '../../../styles/features/users/UsersPage.css'
import { userService } from '../services/userService'
import { vehicleService } from '../../vehicles/services/vehicleService'

const ROLE_OPTIONS = Object.values(ROLES)
const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer Not to Say' },
]
const SPECIALIZATION_OPTIONS = ['General', 'Engine Specialist', 'Electrical Systems', 'Brake Systems', 'Transmission']
const AVATAR_COLORS = ['#F97316', '#0d9488', '#2563eb', '#7c3aed', '#16a34a', '#d97706', '#dc2626', '#0ea5e9', '#8b5cf6', '#ec4899']
const PAGE_SIZE = 10

const ROLE_META = {
  CUSTOMER: { label: 'Customer', accent: '#2563eb', bg: '#dbeafe' },
  ADMIN: { label: 'Admin', accent: '#5b21b6', bg: '#ede9fe' },
  ADVISOR: { label: 'Advisor', accent: '#92400e', bg: '#fef3c7' },
}

const EMPTY_FORM = {
  fullName: '',
  email: '',
  phone: '',
  roleName: 'CUSTOMER',
  gender: 'MALE',
  password: '',
  specialization: 'General',
  availabilityStatus: 'AVAILABLE',
  overtimeRate: '500',
  addVehicleNow: false,
  vehicleCarType: '',
  vehicleRegistrationNumber: '',
  vehicleBrand: '',
  vehicleModel: '',
  vehicleManufactureYear: '',
  vehicleMileage: '',
  vehicleServiceIntervalKm: '',
  lowMileageConsent: false,
}

function initialsFor(name = '?') {
  return name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?'
}

function userColor(user) {
  const key = Number(user?.userId || 0)
  return AVATAR_COLORS[key % AVATAR_COLORS.length]
}

function roleMeta(role) {
  return ROLE_META[role] || { label: role || 'User', accent: '#6b7280', bg: '#f3f4f6' }
}

export function UsersPage() {
  const toast = useToast()
  const [users, setUsers] = useState([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [showUserModal, setShowUserModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [viewingUser, setViewingUser] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [confirmState, setConfirmState] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [page, setPage] = useState(1)
  const guardNavigation = useNavigationGuard(
    Boolean(showUserModal && (
      form.fullName || form.email || form.phone || form.password || form.gender || form.specialization || form.overtimeRate ||
      form.vehicleCarType || form.vehicleRegistrationNumber || form.vehicleBrand || form.vehicleModel ||
      form.vehicleManufactureYear || form.vehicleMileage || form.vehicleServiceIntervalKm
    )),
    'A user form is still in progress. Leaving now will discard the current changes. Continue?'
  )

  async function loadData() {
    setLoading(true)
    try {
      const [usersResponse, vehiclesResponse] = await Promise.all([
        userService.list({
          page,
          size: PAGE_SIZE,
          q: query.trim() || undefined,
          role: roleFilter || undefined,
          status: statusFilter || undefined,
          sort: sortBy,
        }),
        vehicleService.list(),
      ])
      const usersPage = readPaginatedData(usersResponse.data, { page, size: PAGE_SIZE })
      setUsers(usersPage.content)
      setTotalUsers(usersPage.totalElements)
      setTotalPages(usersPage.totalPages)
      setVehicles(vehiclesResponse.data || [])
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to load users.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [page, query, roleFilter, statusFilter, sortBy])

  const counts = {
    total: totalUsers,
    customer: users.filter((user) => user.role === 'CUSTOMER').length,
    advisor: users.filter((user) => user.role === 'ADVISOR').length,
    admin: users.filter((user) => user.role === 'ADMIN').length,
    active: users.filter((user) => user.status === 'ACTIVE').length,
  }

  const activePills = []
  if (roleFilter) activePills.push(roleMeta(roleFilter).label)
  if (statusFilter) activePills.push(statusFilter === 'ACTIVE' ? 'Active' : 'Inactive')
  if (query.trim()) activePills.push(`"${query.trim()}"`)

  const recentUsers = [...users].filter((user) => user.createdAt).sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt)).slice(0, 6)
  const pagedUsers = users
  const showAdvisorFields = form.roleName === 'ADVISOR'
  const canAttachVehicle = !editingUser && form.roleName === 'CUSTOMER'
  const showVehicleFields = canAttachVehicle && form.addVehicleNow
  const vehicleMileage = Number(form.vehicleMileage)
  const showLowMileageWarning = showVehicleFields && Number.isInteger(vehicleMileage) && vehicleMileage < 10000

  function updateForm(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }))
    setErrors((previous) => ({ ...previous, [key]: undefined }))
  }

  function resetFilters() {
    setQuery('')
    setRoleFilter('')
    setStatusFilter('')
    setSortBy('newest')
    setPage(1)
  }

  useEffect(() => { setPage(1) }, [query, roleFilter, statusFilter, sortBy])
  useEffect(() => { setPage((current) => Math.min(current, totalPages)) }, [totalPages])

  function openCreateModal() {
    setEditingUser(null)
    setForm(EMPTY_FORM)
    setErrors({})
    setShowUserModal(true)
  }

  async function openEditModal(user) {
    const source = (await userService.getById(user.userId)).data
    setEditingUser(source)
    setForm({
      ...EMPTY_FORM,
      fullName: source.fullName || '',
      email: source.email || '',
      phone: source.phone || '',
      roleName: source.role || 'CUSTOMER',
      gender: source.gender || '',
      specialization: source.specialization || 'General',
      availabilityStatus: source.availabilityStatus || 'AVAILABLE',
      overtimeRate: source.overtimeRate != null ? String(source.overtimeRate) : '500',
    })
    setErrors({})
    setShowUserModal(true)
  }

  async function openViewUser(user) {
    const source = (await userService.getById(user.userId)).data
    setViewingUser(source)
    setShowViewModal(true)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const { errors: nextErrors, isValid } = validateUserForm(form, users, editingUser?.userId ?? null, vehicles)
    if (!isValid) {
      setErrors(nextErrors)
      return
    }

    setSaving(true)
    try {
      if (editingUser) {
        await userService.update(editingUser.userId, {
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          gender: editingUser.gender || null,
          roleName: form.roleName,
          password: form.password ? form.password : null,
          specialization: form.roleName === 'ADVISOR' ? form.specialization.trim() : null,
          availabilityStatus: editingUser.availabilityStatus || null,
          overtimeRate: form.roleName === 'ADVISOR' ? Number(form.overtimeRate || 0) : null,
        })
        toast('User updated successfully.')
      } else {
        const createResponse = await userService.create({
          fullName: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          gender: form.gender || null,
          password: form.password,
          roleName: form.roleName,
          specialization: form.roleName === 'ADVISOR' ? form.specialization.trim() : null,
          availabilityStatus: form.roleName === 'ADVISOR' ? form.availabilityStatus : null,
          overtimeRate: form.roleName === 'ADVISOR' ? Number(form.overtimeRate || 0) : null,
        })

        if (form.addVehicleNow && form.roleName === 'CUSTOMER') {
          try {
            await vehicleService.create({
              userId: createResponse.data.userId,
              brand: form.vehicleBrand.trim(),
              model: form.vehicleModel.trim(),
              registrationNumber: normalizeRegistrationNumber(form.vehicleRegistrationNumber),
              manufactureYear: Number(form.vehicleManufactureYear),
              carType: form.vehicleCarType,
              mileage: Number(form.vehicleMileage),
              serviceIntervalKm: form.vehicleServiceIntervalKm === '' ? null : Number(form.vehicleServiceIntervalKm),
            })
            toast('User and vehicle created successfully.')
          } catch (vehicleError) {
            toast(vehicleError.response?.data?.message || 'User created, but vehicle could not be added.', 'warning')
          }
        } else {
          toast('User created successfully.')
        }
      }

      setShowUserModal(false)
      setErrors({})
      await loadData()
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to save user.', 'error')
    } finally {
      setSaving(false)
    }
  }

  function requestToggle(user) {
    if (user.canToggleStatus === false) {
      toast(user.statusToggleReason || 'This user cannot be deactivated right now.', 'error')
      return
    }
    const nextStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    setConfirmState({
      user,
      title: `${nextStatus === 'ACTIVE' ? 'Activate' : 'Deactivate'} ${user.fullName}?`,
      body: `Are you sure you want to ${nextStatus === 'ACTIVE' ? 'activate' : 'deactivate'} this user account?`,
      buttonLabel: nextStatus === 'ACTIVE' ? 'Activate' : 'Deactivate',
      nextStatus,
    })
  }

  async function confirmToggle() {
    if (!confirmState?.user) return
    setConfirming(true)
    try {
      await userService.toggleStatus(confirmState.user.userId)
      toast(`User ${confirmState.nextStatus === 'ACTIVE' ? 'activated' : 'deactivated'} successfully.`)
      setConfirmState(null)
      await loadData()
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to update user status.', 'error')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <AdminLayout activeKey="users">
      <div className="users-page">
        <section className="page-header users-hero">
          <div className="container-fluid px-4">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
              <div>
                <h2 className="text-white mb-0">User Management</h2>
                <p className="mb-0 page-subtitle">Manage customer, advisor, and admin accounts.</p>
              </div>
              <button className="users-add-btn" onClick={() => guardNavigation(openCreateModal)}>Add User</button>
            </div>
          </div>
        </section>

        <div className="container-fluid px-4 py-3">
          <PillStatRow>
            {[
              { label: 'Total Users', value: counts.total, icon: 'TU', bg: '#fff0e6', cls: 'kpi-blue' },
              { label: 'Customers', value: counts.customer, icon: 'CU', bg: '#dbeafe', cls: 'kpi-green' },
              { label: 'Advisors', value: counts.advisor, icon: 'AD', bg: '#fef3c7', cls: 'kpi-amber' },
              { label: 'Admins', value: counts.admin, icon: 'AM', bg: '#ede9fe', cls: 'kpi-purple' },
              { label: 'Active Users', value: counts.active, icon: 'AC', bg: '#dcfce7', cls: 'kpi-green' },
            ].map((item) => (
              <PillStat key={item.label} label={item.label} value={item.value} color={item.bg} />
            ))}
          </PillStatRow>

          <div className="toolbar-card users-toolbar-card">
            <div className="row g-2 align-items-end">
              <div className="col-md-4">
                <label className="toolbar-label">Search</label>
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-white border-end-0 users-toolbar-icon">Find</span>
                  <input type="text" className="form-control border-start-0 toolbar-input" placeholder="Name, email, phone..." value={query} onChange={(event) => setQuery(event.target.value)} />
                </div>
              </div>
              <div className="col-md-2">
                <label className="toolbar-label">Role</label>
                <select className="form-select form-select-sm toolbar-select" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                  <option value="">All Roles</option>
                  {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{roleMeta(role).label}</option>)}
                </select>
              </div>
              <div className="col-md-2">
                <label className="toolbar-label">Status</label>
                <select className="form-select form-select-sm toolbar-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="">All Statuses</option>
                  {USER_STATUSES.map((status) => <option key={status} value={status}>{status === 'ACTIVE' ? 'Active' : 'Inactive'}</option>)}
                </select>
              </div>
              <div className="col-md-2">
                <label className="toolbar-label">Sort</label>
                <select className="form-select form-select-sm toolbar-select" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="name-az">Name A-Z</option>
                  <option value="name-za">Name Z-A</option>
                </select>
              </div>
              <div className="col-md-2">
                <button className="btn-reset w-100" onClick={resetFilters}>Reset</button>
              </div>
            </div>
          </div>

          <div className="users-layout">
            <div>
              <div className="results-bar">
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <small className="text-muted">
                    {totalUsers
                      ? `Showing ${((page - 1) * PAGE_SIZE) + 1}-${Math.min(page * PAGE_SIZE, totalUsers)} of ${totalUsers} user${totalUsers !== 1 ? 's' : ''}`
                      : '0 users'}
                  </small>
                  <div className="d-flex gap-1 flex-wrap">
                    {activePills.map((pill) => <span key={pill} className="filter-pill">{pill}</span>)}
                  </div>
                </div>
              </div>

              <div className="users-grid-header">
                <span />
                <span>User</span>
                <span>Phone</span>
                <span>Role</span>
                <span>Status</span>
                <span>Joined</span>
                <span>Actions</span>
              </div>

              {loading ? (
                <div className="section-card"><PageSpinner /></div>
              ) : !pagedUsers.length ? (
                <div className="users-empty-state">
                  <h6 className="mb-1">No users found</h6>
                  <p className="mb-3">Try adjusting your search or filters.</p>
                  <button className="btn btn-sm btn-outline-secondary" onClick={resetFilters}>Clear Filters</button>
                </div>
              ) : (
                <div className="users-list">
                  {pagedUsers.map((user) => {
                    const meta = roleMeta(user.role)
                    return (
                      <article key={user.userId} className="user-row-card">
                        <div className="user-row-accent" style={{ background: meta.accent }} />
                        <div className="user-row-body">
                          <div className="user-avatar" style={{ background: userColor(user) }}>{initialsFor(user.fullName)}</div>
                          <div className="min-w-0">
                            <div className="user-name">{user.fullName}</div>
                            <div className="user-email">{user.email}</div>
                            {user.designation ? <div className="user-designation">{user.designation}</div> : null}
                          </div>
                          <div className="user-phone">{user.phone || '—'}</div>
                          <div><span className={`users-role-pill users-role-${user.role?.toLowerCase()}`}>{meta.label}</span></div>
                          <div><StatusBadge status={user.status} /></div>
                          <div className="user-joined">{formatDate(user.createdAt)}</div>
                          <div className="user-actions">
                            <ActionIconButton icon="view" label="View user" onClick={() => openViewUser(user)} />
                            <ActionIconButton icon="edit" label="Edit user" onClick={() => openEditModal(user)} />
                            <ActionIconButton
                              icon={user.status === 'ACTIVE' ? 'deactivate' : 'activate'}
                              label={user.status === 'ACTIVE' ? 'Deactivate user' : 'Activate user'}
                              className={`${user.status === 'ACTIVE' ? 'action-warning' : 'action-success'} ${user.canToggleStatus === false ? 'is-disabled' : ''}`}
                              onClick={() => requestToggle(user)}
                            />
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
              <PaginationControls page={page} totalItems={totalUsers} pageSize={PAGE_SIZE} totalPages={totalPages} onPageChange={setPage} />
            </div>

            <aside className="users-sidebar">
              <div className="sidebar-card">
                <div className="sidebar-title">Role Distribution</div>
                <div className="d-flex flex-column gap-3">
                  {ROLE_OPTIONS.map((role) => {
                    const total = users.length || 1
                    const count = users.filter((user) => user.role === role).length
                    const meta = roleMeta(role)
                    return (
                      <div key={role}>
                        <div className="d-flex justify-content-between small fw-semibold mb-1">
                          <span>{meta.label}</span>
                          <span>{count}</span>
                        </div>
                        <div className="users-progress-track">
                          <div className="users-progress-fill" style={{ width: `${Math.round((count / total) * 100)}%`, background: meta.accent }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="sidebar-card">
                <div className="sidebar-title">Status Overview</div>
                <div className="users-status-grid">
                  <div className="users-status-stat">
                    <div className="users-status-value text-success">{users.filter((user) => user.status === 'ACTIVE').length}</div>
                    <div className="users-status-label">Active</div>
                  </div>
                  <div className="users-status-stat">
                    <div className="users-status-value text-secondary">{users.filter((user) => user.status !== 'ACTIVE').length}</div>
                    <div className="users-status-label">Inactive</div>
                  </div>
                </div>
              </div>

              <div className="sidebar-card">
                <div className="sidebar-title">Recently Joined</div>
                {!recentUsers.length ? (
                  <p className="text-muted small mb-0 text-center">No data</p>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {recentUsers.map((user) => (
                      <div key={user.userId} className="recent-user-item">
                        <div className="user-avatar user-avatar-sm" style={{ background: userColor(user) }}>{initialsFor(user.fullName)}</div>
                        <div className="flex-grow-1 min-w-0">
                          <div className="recent-user-name">{user.fullName}</div>
                          <div className="recent-user-meta">{roleMeta(user.role).label} · {user.email}</div>
                        </div>
                        <span className="recent-user-time">{timeAgo(user.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </div>

          {showUserModal ? (
            <div className="modal fade show d-block users-modal-backdrop">
              <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                  <div className="modal-header users-modal-header">
                    <h5 className="modal-title text-white">{editingUser ? 'Edit User' : 'Add New User'}</h5>
                  </div>
                  <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                      <div className="row g-3">
                        <div className="col-12">
                          <label className="form-label users-form-label">Full Name <span className="required-mark">*</span></label>
                          <input className={`form-control ${errors.fullName ? 'is-invalid' : ''}`} value={form.fullName} onChange={(event) => updateForm('fullName', event.target.value)} />
                          {errors.fullName ? <div className="invalid-feedback">{errors.fullName}</div> : null}
                        </div>
                        <div className="col-md-6">
                          <label className="form-label users-form-label">Email Address <span className="required-mark">*</span></label>
                          <input type="email" className={`form-control ${errors.email ? 'is-invalid' : ''}`} value={form.email} disabled={Boolean(editingUser)} onChange={(event) => updateForm('email', event.target.value)} />
                          {errors.email ? <div className="invalid-feedback">{errors.email}</div> : null}
                        </div>
                        <div className="col-md-6">
                          <label className="form-label users-form-label">Phone Number <span className="required-mark">*</span></label>
                          <input className={`form-control ${errors.phone ? 'is-invalid' : ''}`} value={form.phone} maxLength={10} onChange={(event) => updateForm('phone', event.target.value.replace(/\D/g, ''))} />
                          {errors.phone ? <div className="invalid-feedback">{errors.phone}</div> : null}
                        </div>
                        <div className="col-md-6">
                          <label className="form-label users-form-label">Role <span className="required-mark">*</span></label>
                          <select className="form-select" value={form.roleName} onChange={(event) => updateForm('roleName', event.target.value)}>
                            {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{roleMeta(role).label}</option>)}
                          </select>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label users-form-label">Gender</label>
                          {editingUser ? (
                            <>
                              <input className="form-control" value={form.gender || 'Not set'} disabled />
                              <small className="text-muted">Gender cannot be changed after user creation.</small>
                            </>
                          ) : (
                            <select className="form-select" value={form.gender} onChange={(event) => updateForm('gender', event.target.value)}>
                              {GENDER_OPTIONS.map((option) => <option key={option.value || 'empty'} value={option.value}>{option.label}</option>)}
                            </select>
                          )}
                        </div>

                        {showAdvisorFields ? (
                          <div className="col-12">
                            <hr className="my-1" />
                            <p className="users-section-heading mb-2">Service Advisor Details</p>
                            <div className="row g-2">
                              <div className="col-md-6">
                                <label className="form-label users-form-label">Specialization</label>
                                <select className={`form-select ${errors.specialization ? 'is-invalid' : ''}`} value={form.specialization} onChange={(event) => updateForm('specialization', event.target.value)}>
                                  {SPECIALIZATION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                                </select>
                                {errors.specialization ? <div className="invalid-feedback">{errors.specialization}</div> : null}
                              </div>
                              <div className="col-md-6">
                                <label className="form-label users-form-label">Overtime Rate (Rs./hr)</label>
                                <input type="number" min="0" className={`form-control ${errors.overtimeRate ? 'is-invalid' : ''}`} value={form.overtimeRate} onChange={(event) => updateForm('overtimeRate', event.target.value)} />
                                {errors.overtimeRate ? <div className="invalid-feedback">{errors.overtimeRate}</div> : null}
                              </div>
                            </div>
                          </div>
                        ) : null}

                        <div className="col-12">
                          <label className="form-label users-form-label">Password {!editingUser ? <span className="required-mark">*</span> : ''}</label>
                          <input type="password" className={`form-control ${errors.password ? 'is-invalid' : ''}`} value={form.password} onChange={(event) => updateForm('password', event.target.value)} />
                          {errors.password ? <div className="invalid-feedback">{errors.password}</div> : null}
                          {editingUser ? <small className="text-muted">Leave blank to keep the existing password.</small> : null}
                        </div>

                        {canAttachVehicle ? (
                          <div className="col-12">
                            <hr className="my-1" />
                            <div className="form-check">
                              <input id="users-add-vehicle-now" className="form-check-input" type="checkbox" checked={form.addVehicleNow} onChange={(event) => updateForm('addVehicleNow', event.target.checked)} />
                              <label className="form-check-label small" htmlFor="users-add-vehicle-now">
                                Add vehicle for this customer now (optional)
                              </label>
                            </div>
                          </div>
                        ) : null}

                        {showVehicleFields ? (
                          <div className="col-12">
                            <p className="users-section-heading mb-2">Vehicle Details</p>
                            <div className="row g-2">
                              <div className="col-md-6">
                                <label className="form-label users-form-label">Car Type <span className="required-mark">*</span></label>
                                <select className={`form-select ${errors.vehicleCarType ? 'is-invalid' : ''}`} value={form.vehicleCarType} onChange={(event) => updateForm('vehicleCarType', event.target.value)}>
                                  <option value="">Select</option>
                                  {CAR_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                                </select>
                                {errors.vehicleCarType ? <div className="invalid-feedback">{errors.vehicleCarType}</div> : null}
                              </div>
                              <div className="col-md-6">
                                <label className="form-label users-form-label">Registration Number <span className="required-mark">*</span></label>
                                <input className={`form-control text-uppercase ${errors.vehicleRegistrationNumber ? 'is-invalid' : ''}`} value={form.vehicleRegistrationNumber} maxLength={10} onChange={(event) => updateForm('vehicleRegistrationNumber', normalizeRegistrationNumber(event.target.value))} />
                                {errors.vehicleRegistrationNumber ? <div className="invalid-feedback">{errors.vehicleRegistrationNumber}</div> : null}
                              </div>
                              <div className="col-md-6">
                                <label className="form-label users-form-label">Brand <span className="required-mark">*</span></label>
                                <input className={`form-control ${errors.vehicleBrand ? 'is-invalid' : ''}`} value={form.vehicleBrand} onChange={(event) => updateForm('vehicleBrand', event.target.value)} />
                                {errors.vehicleBrand ? <div className="invalid-feedback">{errors.vehicleBrand}</div> : null}
                              </div>
                              <div className="col-md-6">
                                <label className="form-label users-form-label">Model <span className="required-mark">*</span></label>
                                <input className={`form-control ${errors.vehicleModel ? 'is-invalid' : ''}`} value={form.vehicleModel} onChange={(event) => updateForm('vehicleModel', event.target.value)} />
                                {errors.vehicleModel ? <div className="invalid-feedback">{errors.vehicleModel}</div> : null}
                              </div>
                              <div className="col-md-4">
                                <label className="form-label users-form-label">Manufacture Year <span className="required-mark">*</span></label>
                                <input type="number" className={`form-control ${errors.vehicleManufactureYear ? 'is-invalid' : ''}`} value={form.vehicleManufactureYear} onChange={(event) => updateForm('vehicleManufactureYear', event.target.value)} />
                                {errors.vehicleManufactureYear ? <div className="invalid-feedback">{errors.vehicleManufactureYear}</div> : null}
                              </div>
                              <div className="col-md-4">
                                <label className="form-label users-form-label">Mileage (km) <span className="required-mark">*</span></label>
                                <input type="number" className={`form-control ${errors.vehicleMileage ? 'is-invalid' : ''}`} value={form.vehicleMileage} onChange={(event) => updateForm('vehicleMileage', event.target.value)} />
                                {errors.vehicleMileage ? <div className="invalid-feedback">{errors.vehicleMileage}</div> : null}
                              </div>
                              <div className="col-md-4">
                                <label className="form-label users-form-label">Service Interval (km)</label>
                                <input type="number" className={`form-control ${errors.vehicleServiceIntervalKm ? 'is-invalid' : ''}`} value={form.vehicleServiceIntervalKm} onChange={(event) => updateForm('vehicleServiceIntervalKm', event.target.value)} />
                                {errors.vehicleServiceIntervalKm ? <div className="invalid-feedback">{errors.vehicleServiceIntervalKm}</div> : null}
                                <small className="text-muted">Suggested default: 10,000 km</small>
                              </div>
                              {showLowMileageWarning ? (
                                <div className="col-12">
                                  <div className="alert alert-warning py-2 px-3 mb-2 small">
                                    This vehicle is below 10,000 km and may still be under brand service care. Proceeding can affect free brand service eligibility and warranty.
                                  </div>
                                  <div className="form-check">
                                    <input className="form-check-input" id="users-low-mileage-agree" type="checkbox" checked={form.lowMileageConsent} onChange={(event) => updateForm('lowMileageConsent', event.target.checked)} />
                                    <label className="form-check-label small" htmlFor="users-low-mileage-agree">
                                      I understand and agree to add this vehicle anyway.
                                    </label>
                                  </div>
                                  {errors.lowMileageConsent ? <div className="invalid-feedback d-block">{errors.lowMileageConsent}</div> : null}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="modal-footer">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => guardNavigation(() => setShowUserModal(false))}>Cancel</button>
                      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => { setForm(editingUser ? { ...form, password: '' } : EMPTY_FORM); setErrors({}) }}>Reset</button>
                      <button type="submit" className="users-save-btn" disabled={saving}>{saving ? 'Saving...' : 'Save User'}</button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          ) : null}

          {showViewModal && viewingUser ? (
            <div className="modal fade show d-block users-modal-backdrop">
              <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                  <div className="modal-header users-modal-header">
                    <h5 className="modal-title text-white">User Profile</h5>
                  </div>
                  <div className="modal-body">
                    <div className="text-center mb-4">
                      <div className="users-profile-avatar" style={{ background: userColor(viewingUser) }}>{initialsFor(viewingUser.fullName)}</div>
                      <h5 className="fw-bold mb-1">{viewingUser.fullName}</h5>
                      <div className="text-muted small">{viewingUser.email}</div>
                    </div>
                    <div className="row g-2">
                      {[
                        ['Role', roleMeta(viewingUser.role).label],
                        ['Status', <StatusBadge key="status" status={viewingUser.status} />],
                        ['Phone', viewingUser.phone || '—'],
                        ['Gender', viewingUser.gender || '—'],
                        ['Joined', formatDate(viewingUser.createdAt)],
                        ...(viewingUser.role === 'ADVISOR'
                          ? [['Specialization', viewingUser.specialization || '—'], ['Availability', viewingUser.availabilityStatus || '—']]
                          : []),
                      ].map(([label, value]) => (
                        <div key={label} className="col-6">
                          <div className="users-info-card">
                            <div className="users-info-label">{label}</div>
                            <div className="users-info-value">{value}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowViewModal(false)}>Close</button>
                    <button type="button" className="users-save-btn users-save-btn-sm" onClick={() => { setShowViewModal(false); openEditModal(viewingUser) }}>Edit User</button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {confirmState ? (
            <div className="modal fade show d-block users-modal-backdrop">
              <div className="modal-dialog modal-dialog-centered modal-sm">
                <div className="modal-content">
                  <div className="modal-header users-danger-header">
                    <h5 className="modal-title text-white">Confirm Action</h5>
                  </div>
                  <div className="modal-body text-center py-4">
                    <h6 className="fw-bold mb-2">{confirmState.title}</h6>
                    <p className="text-muted small mb-0">{confirmState.body}</p>
                  </div>
                  <div className="modal-footer justify-content-center gap-2">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirmState(null)}>Cancel</button>
                    <button type="button" className={`btn btn-sm ${confirmState.nextStatus === 'ACTIVE' ? 'btn-success' : 'btn-warning'}`} disabled={confirming} onClick={confirmToggle}>
                      {confirming ? 'Working...' : confirmState.buttonLabel}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </AdminLayout>
  )
}



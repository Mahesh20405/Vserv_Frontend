import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { PageSpinner } from '../../../components/ui/Spinner'
import { ROLE_HOMES } from '../../../config/constants'

export function AuthGuard({ children, role }) {
  const { user, loading } = useAuth()
  if (loading) return <PageSpinner />
  if (!user) return <Navigate to="/login" replace />
  if (role && user.role !== role) return <Navigate to={ROLE_HOMES[user.role] || '/login'} replace />
  return children
}

export function GuestGuard({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <PageSpinner />
  if (user) return <Navigate to={ROLE_HOMES[user.role] || '/customer/dashboard'} replace />
  return children
}



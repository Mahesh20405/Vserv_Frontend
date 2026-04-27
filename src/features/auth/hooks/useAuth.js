import { useDispatch, useSelector } from 'react-redux'
import { setUser, clearUser, setLoading } from '../slices/authSlice'

export function useAuth() {
  const dispatch = useDispatch()
  const { user, loading } = useSelector((state) => state.auth)

  return {
    user,
    loading,
    setUser:    (u) => dispatch(setUser(u)),
    clearUser:  ()  => dispatch(clearUser()),
    setLoading: (v) => dispatch(setLoading(v)),
  }
}

import { createSlice } from '@reduxjs/toolkit'
import { ACCESS_TOKEN_KEY, USER_STORAGE_KEY } from '../../../config/constants'

function readStoredUser() {
  try {
    const raw = sessionStorage.getItem(USER_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeStoredUser(user) {
  try {
    if (user) sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
    else sessionStorage.removeItem(USER_STORAGE_KEY)
  } catch {}
}

const initialUser = readStoredUser()
const hasStoredSession = Boolean(initialUser || sessionStorage.getItem(ACCESS_TOKEN_KEY))

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: initialUser,
    loading: hasStoredSession,
  },
  reducers: {
    setUser(state, action) {
      state.user = action.payload
      state.loading = false
      writeStoredUser(action.payload)
    },
    clearUser(state) {
      state.user = null
      state.loading = false
      writeStoredUser(null)
    },
    setLoading(state, action) {
      state.loading = action.payload
    },
  },
})

export const { setUser, clearUser, setLoading } = authSlice.actions
export default authSlice.reducer


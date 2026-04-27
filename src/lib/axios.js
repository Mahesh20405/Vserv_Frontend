import axios from 'axios'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from '../config/constants'

// ─── Token helpers ────────────────────────────────────────────────────────────

export function getAccessToken() {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken() {
  return sessionStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setTokens({ accessToken, refreshToken }) {
  if (accessToken) sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  if (refreshToken) sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

export function clearTokens() {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  sessionStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function toUser(payload) {
  if (!payload) return null
  const { userId, fullName, email, role } = payload
  return { userId, fullName, email, role }
}

// ─── Axios instance ───────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
})

const PUBLIC_ROUTES = ['/api/auth/forgot-password', '/api/auth/login', '/api/auth/register', '/api/auth/refresh']

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  const isPublic = PUBLIC_ROUTES.some(route => config.url?.includes(route))
  if (token && !isPublic) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let refreshPromise = null

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config ?? {}
    const isUnauthorized = error.response?.status === 401
    const refreshToken = getRefreshToken()
    const isRefreshRequest = originalRequest.url?.includes('/api/auth/refresh')

    if (!isUnauthorized) return Promise.reject(error)

    if (!refreshToken || isRefreshRequest || originalRequest._retry) {
      clearTokens()
      if (window.location.pathname !== '/login') window.location.replace('/login')
      return Promise.reject(error)
    }

    originalRequest._retry = true

    try {
      refreshPromise ??= axios.post(
        `${API_BASE_URL}/api/auth/refresh`,
        { refreshToken },
        { withCredentials: true },
      )
      const { data } = await refreshPromise
      setTokens(data)
      originalRequest.headers = originalRequest.headers ?? {}
      originalRequest.headers.Authorization = `Bearer ${data.accessToken}`
      return api(originalRequest)
    } catch (refreshError) {
      clearTokens()
      if (window.location.pathname !== '/login') window.location.replace('/login')
      return Promise.reject(refreshError)
    } finally {
      refreshPromise = null
    }
  },
)

export default api

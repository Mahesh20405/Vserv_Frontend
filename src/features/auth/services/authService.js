import api from '../../../lib/axios'
export const authService = {
  login:                      (body) => api.post('/api/auth/login', body),
  logout:                     (body) => api.post('/api/auth/logout', body),
  me:                         () => api.get('/api/auth/me'),
  register:                   (body) => api.post('/api/auth/register', body),
  requestForgotPasswordOtp:   (body) => api.post('/api/auth/forgot-password/request', body),
  verifyForgotPasswordOtp:    (body) => api.post('/api/auth/forgot-password/verify', body),
  resetForgotPassword:        (body) => api.post('/api/auth/forgot-password/reset', body),
}


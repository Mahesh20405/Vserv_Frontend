import api from '../../../lib/axios'
export const profileService = {
  get:                ()      => api.get('/api/profile'),
  update:             (body)  => api.put('/api/profile', body),
  requestPasswordOtp: ()      => api.post('/api/profile/change-password/request-otp'),
  verifyPasswordOtp:  (body)  => api.post('/api/profile/change-password/verify-otp', body),
  changePassword:     (body)  => api.post('/api/profile/change-password', body),
}


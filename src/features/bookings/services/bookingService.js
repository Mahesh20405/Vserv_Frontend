import api from '../../../lib/axios'
export const bookingService = {
  list:            (params)   => api.get('/api/bookings', { params }),
  getOverdueBookings:         () => api.get('/api/bookings/overdue'),
  getById:         (id)       => api.get(`/api/bookings/${id}`),
  create:          (body)     => api.post('/api/bookings', body),
  confirm:         (id, body) => api.patch(`/api/bookings/${id}/confirm`, body),
  cancel:          (id, body) => api.patch(`/api/bookings/${id}/cancel`, body),
  reschedule:      (id, body) => api.patch(`/api/bookings/${id}/reschedule`, body),
  reassignAdvisor: (id, body) => api.patch(`/api/bookings/${id}/reassign-advisor`, body),
  getHistory:      (id)       => api.get(`/api/bookings/${id}/history`),
}


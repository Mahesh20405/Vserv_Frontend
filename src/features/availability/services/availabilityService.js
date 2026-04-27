import api from '../../../lib/axios'
export const availabilityService = {
  list:     (params)   => api.get('/api/availability', { params }),
  bookable: (params)   => api.get('/api/availability/bookable', { params }),
  create:   (body)     => api.post('/api/availability', body),
  bulk:     (body)     => api.post('/api/availability/bulk', body),
  update:   (id, body) => api.put(`/api/availability/${id}`, body),
  toggle:   (id)       => api.patch(`/api/availability/${id}/toggle`),
  delete:   (id)       => api.delete(`/api/availability/${id}`),
}


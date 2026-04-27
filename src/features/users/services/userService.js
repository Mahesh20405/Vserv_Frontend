import api from '../../../lib/axios'
export const userService = {
  list:         (params)   => api.get('/api/users', { params }),
  getById:      (id)       => api.get(`/api/users/${id}`),
  create:       (body)     => api.post('/api/users', body),
  update:       (id, body) => api.put(`/api/users/${id}`, body),
  toggleStatus: (id)       => api.patch(`/api/users/${id}/status`),
}


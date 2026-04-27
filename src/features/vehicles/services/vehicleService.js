import api from '../../../lib/axios'
export const vehicleService = {
  list:    (params)   => api.get('/api/vehicles', { params }),
  getById: (id)       => api.get(`/api/vehicles/${id}`),
  byUser:  (userId, params) => api.get(`/api/vehicles/by-user/${userId}`, { params }),
  create:  (body)     => api.post('/api/vehicles', body),
  update:  (id, body) => api.put(`/api/vehicles/${id}`, body),
  toggleStatus: (id)  => api.patch(`/api/vehicles/${id}/status`),
}


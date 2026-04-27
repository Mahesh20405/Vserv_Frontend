import api from '../../../lib/axios'
export const catalogService = {
  list:    (params)   => api.get('/api/catalog', { params }),
  getById: (id)       => api.get(`/api/catalog/${id}`),
  create:  (body)     => api.post('/api/catalog', body),
  update:  (id, body) => api.put(`/api/catalog/${id}`, body),
  toggle:  (id)       => api.patch(`/api/catalog/${id}/toggle`),
}


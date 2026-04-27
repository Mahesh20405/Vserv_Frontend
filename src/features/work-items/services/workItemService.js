import api from '../../../lib/axios'
export const workItemService = {
  list:    (params)   => api.get('/api/work-items', { params }),
  getById: (id)       => api.get(`/api/work-items/${id}`),
  create:  (body)     => api.post('/api/work-items', body),
  update:  (id, body) => api.put(`/api/work-items/${id}`, body),
  toggle:  (id)       => api.patch(`/api/work-items/${id}/toggle`),
}


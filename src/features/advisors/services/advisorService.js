import api from '../../../lib/axios'
export const advisorService = {
  list:         (params)    => api.get('/api/advisors', { params }),
  available:    (params)    => api.get('/api/advisors/available', { params }),
  getById:      (id)        => api.get(`/api/advisors/${id}`),
  update:       (id, body)  => api.put(`/api/advisors/${id}`, body),
  toggleStatus: (id)        => api.patch(`/api/advisors/${id}/status`),
}


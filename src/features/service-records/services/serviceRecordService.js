import api from '../../../lib/axios'
export const serviceRecordService = {
  list:          (params)   => api.get('/api/service-records', { params }),
  getById:       (id)       => api.get(`/api/service-records/${id}`),
  getItems:      (id)       => api.get(`/api/service-records/${id}/items`),
  start:         (id)       => api.patch(`/api/service-records/${id}/start`),
  updateRemarks: (id, body) => api.patch(`/api/service-records/${id}/remarks`, body),
  saveItems:     (id, body) => api.put(`/api/service-records/${id}/items`, body),
  complete:      (id, body) => api.patch(`/api/service-records/${id}/complete`, body),
}


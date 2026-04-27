import api from '../../../lib/axios'
export const serviceFeedbackService = {
  list:      ()                => api.get('/api/service-feedback'),
  getStatus: (serviceId)       => api.get(`/api/service-feedback/service/${serviceId}`),
  create:    (serviceId, body) => api.post(`/api/service-feedback/service/${serviceId}`, body),
}


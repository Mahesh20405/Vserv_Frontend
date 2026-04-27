import api from '../../../lib/axios'
export const notificationService = {
  list:        (params) => api.get('/api/notifications', { params }),
  markRead:    (id) => api.patch(`/api/notifications/${id}/read`),
  markAllRead: ()   => api.patch('/api/notifications/read-all'),
  delete:      (id) => api.delete(`/api/notifications/${id}`),
}


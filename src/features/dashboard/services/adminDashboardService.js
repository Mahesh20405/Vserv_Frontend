import api from '../../../lib/axios'
export const adminDashboardService = {
  getStats: () => api.get('/api/dashboard'),
}


import api from '../../../lib/axios'
export const auditLogService = {
  list: (params) => api.get('/api/audit-logs', { params }),
}


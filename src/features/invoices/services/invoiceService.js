import api from '../../../lib/axios'
export const invoiceService = {
  list:               (params)   => api.get('/api/invoices', { params }),
  getById:            (id)       => api.get(`/api/invoices/${id}`),
  pay:                (id, body) => api.post(`/api/invoices/${id}/pay`, body),
  createCheckoutOrder: (id, body) => api.post(`/api/invoices/${id}/checkout/order`, body),
  verifyCheckout:      (id, body) => api.post(`/api/invoices/${id}/checkout/verify`, body),
}


import api from '../../../lib/axios'

export const paymentGatewayService = {
  createBookingChargeOrder: (body) => api.post('/api/payments/booking-charge/order', body),
  verifyBookingCharge: (body) => api.post('/api/payments/booking-charge/verify', body),
}

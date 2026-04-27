export function getInvoiceBreakdown(invoice = {}) {
  const baseServicePrice = Number(invoice.baseServicePrice || 0)
  const bookingCharge = Number(invoice.bookingCharge || 0)
  const itemsTotal = Number(invoice.itemsTotal || 0)
  const overtimeCharge = Number(invoice.overtimeCharge || 0)
  const grossTotal = Number(invoice.totalAmount || 0)
  const bookingChargePaidAmount = Number(invoice.bookingChargePaidAmount || 0)
  const finalInvoicePaidAmount = Number(invoice.finalInvoicePaidAmount || 0)
  const totalPaidAmount = Number(invoice.totalPaidAmount || 0)
  const remainingBalance = Number(invoice.remainingBalance || 0)
  const netAmountAfterAdvance = Number(invoice.netAmountAfterAdvance || 0)

  return {
    baseServicePrice,
    bookingCharge,
    itemsTotal,
    overtimeCharge,
    grossTotal,
    bookingChargePaidAmount,
    finalInvoicePaidAmount,
    totalPaidAmount,
    remainingBalance,
    netAmountAfterAdvance,
  }
}

export function canCustomerPayInvoice(invoice = {}) {
  const paymentStatus = String(invoice.paymentStatus || '').toUpperCase()
  const bookingStatus = String(invoice.bookingStatus || '').toUpperCase()
  const serviceStatus = String(invoice.serviceStatus || '').toUpperCase()

  if (bookingStatus === 'CANCELLED') return false
  if (serviceStatus === 'CANCELLED') return false

  return Number(invoice.remainingBalance || 0) > 0 && paymentStatus !== 'PAID'
}

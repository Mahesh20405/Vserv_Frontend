import { formatCurrency, formatDate, formatDateTime } from '../../../utils/formatters'
import { getInvoiceBreakdown } from './invoiceBreakdown'

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const MARGIN = 16

function line(doc, x1, y1, x2, y2, color = [226, 232, 240]) {
  doc.setDrawColor(...color)
  doc.line(x1, y1, x2, y2)
}

function ensureSpace(doc, y, needed = 10) {
  if (y + needed <= PAGE_HEIGHT - MARGIN) return y
  doc.addPage()
  return MARGIN
}

function writePairs(doc, rows, startY) {
  let y = startY
  rows.forEach(([label, value]) => {
    y = ensureSpace(doc, y, 8)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139)
    doc.text(String(label), MARGIN, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    const text = String(value ?? '-')
    doc.text(text, PAGE_WIDTH - MARGIN, y, { align: 'right' })
    y += 7
  })
  return y
}

export async function downloadInvoicePdf(invoice, options = {}) {
  const { jsPDF } = await import('jspdf')
  const detailed = invoice || {}
  const breakdown = getInvoiceBreakdown(detailed)
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = MARGIN

  doc.setFillColor(37, 99, 235)
  doc.roundedRect(MARGIN, y, PAGE_WIDTH - (MARGIN * 2), 24, 3, 3, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('VServ Invoice', MARGIN + 6, y + 10)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(String(options.heading || 'Vehicle service invoice summary'), MARGIN + 6, y + 17)
  doc.setFont('helvetica', 'bold')
  doc.text(String(options.invoiceNumber || detailed.invoiceNumber || `INV-${String(detailed.invoiceId || '').padStart(4, '0')}`), PAGE_WIDTH - MARGIN - 6, y + 10, { align: 'right' })
  y += 32

  y = writePairs(doc, [
    ['Invoice Date', formatDate(detailed.invoiceDate)],
    ['Customer', detailed.customerName || detailed.ownerName || '-'],
    ['Vehicle', detailed.vehicleInfo || '-'],
    ['Service', detailed.serviceName || '-'],
    ['Status', detailed.paymentStatus || '-'],
    ['Latest Payment Method', detailed.paymentMethod || 'Pending'],
    ['Transaction Reference', detailed.transactionReference || detailed.bookingChargeTransactionReference || '-'],
    ['Paid At', detailed.paidAt ? formatDateTime(detailed.paidAt) : '-'],
  ], y)

  y += 3
  line(doc, MARGIN, y, PAGE_WIDTH - MARGIN, y)
  y += 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(15, 23, 42)
  doc.text('Price Summary', MARGIN, y)
  y += 8

  y = writePairs(doc, [
    ['Base Service', formatCurrency(breakdown.baseServicePrice)],
    ['Added BOM / Items', formatCurrency(breakdown.itemsTotal)],
    ['Overtime', formatCurrency(breakdown.overtimeCharge)],
    ['Booking Charge', formatCurrency(breakdown.bookingCharge)],
    ['Advance Paid At Booking', formatCurrency(breakdown.bookingChargePaidAmount)],
    ['Net After Advance', formatCurrency(breakdown.netAmountAfterAdvance)],
    ['Final Invoice Paid', formatCurrency(breakdown.finalInvoicePaidAmount)],
    ['Total Paid So Far', formatCurrency(breakdown.totalPaidAmount)],
    ['Remaining Balance', formatCurrency(breakdown.remainingBalance)],
    ['Gross Invoice Total', formatCurrency(breakdown.grossTotal)],
  ], y)

  y += 3
  line(doc, MARGIN, y, PAGE_WIDTH - MARGIN, y)
  y += 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Line Items', MARGIN, y)
  y += 8

  const items = detailed.items || []
  if (!items.length) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139)
    doc.text('No additional line items.', MARGIN, y)
    y += 7
  } else {
    doc.setFontSize(9)
    items.forEach((item) => {
      y = ensureSpace(doc, y, 14)
      doc.setDrawColor(226, 232, 240)
      doc.roundedRect(MARGIN, y - 4, PAGE_WIDTH - (MARGIN * 2), 12, 2, 2)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(15, 23, 42)
      doc.text(String(item.itemName || 'Item'), MARGIN + 3, y + 1)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 116, 139)
      doc.text(`Qty ${item.quantity || 1} • ${formatCurrency(item.unitPrice || 0)} each`, MARGIN + 3, y + 6)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(15, 23, 42)
      doc.text(formatCurrency(item.total || 0), PAGE_WIDTH - MARGIN - 3, y + 4, { align: 'right' })
      y += 15
    })
  }

  if (options.feedbackText || options.feedbackMeta) {
    y += 2
    y = ensureSpace(doc, y, 20)
    line(doc, MARGIN, y, PAGE_WIDTH - MARGIN, y)
    y += 8
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(15, 23, 42)
    doc.text('Feedback', MARGIN, y)
    y += 7
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139)
    if (options.feedbackMeta) {
      doc.text(String(options.feedbackMeta), MARGIN, y)
      y += 6
    }
    const feedbackLines = doc.splitTextToSize(String(options.feedbackText), PAGE_WIDTH - (MARGIN * 2))
    doc.setTextColor(15, 23, 42)
    doc.text(feedbackLines, MARGIN, y)
  }

  doc.save(`${options.invoiceNumber || detailed.invoiceNumber || `INV-${String(detailed.invoiceId || '').padStart(4, '0')}`}.pdf`)
}

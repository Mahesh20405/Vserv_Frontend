import { useEffect, useMemo, useState } from 'react'
import { AdminLayout } from '../../../layouts/AppShell'
import { AdminPageHero, PageContent } from '../../../components/common/PageElements'
import { PageSpinner } from '../../../components/ui/Spinner'
import { StatusBadge } from '../../../components/ui/Badge'
import { ActionIconButton } from '../../../components/ui/ActionIconButton'
import { useToast } from '../../../components/ui/Toast'
import { formatCurrency, formatDate, formatDateTime } from '../../../utils/formatters'
import { getInvoiceBreakdown } from '../utils/invoiceBreakdown'
import { validateInvoicePaymentForm } from '../../../utils/adminValidation'
import { PaginationControls } from '../../../components/ui/PaginationControls'
import { PillStat } from '../../../components/ui/PillStat'
import { PillStatRow } from '../../../components/ui/PillStatRow'
import { downloadInvoicePdf } from '../utils/invoicePdf'
import { useNavigationGuard } from '../../../hooks/useNavigationGuard'
import '../../../styles/features/invoices/InvoicesAdminPage.css'
import { invoiceService } from '../services/invoiceService'
import { PAYMENT_METHODS } from '../../../config/constants'
import { serviceFeedbackService } from '../services/serviceFeedbackService'

const METHOD_ICONS = { UPI: 'UPI', CARD: 'CARD', NET_BANKING: 'BANK', CASH: 'CASH' }
const EMPTY_PAY = { paymentMethod: '', amount: '', transactionReference: '' }
const PAGE_SIZE = 10
const invoiceNumber = (invoice) => invoice.invoiceNumber || `INV-${String(invoice.invoiceId || '').padStart(4, '0')}`
const statusKey = (invoice) => String(invoice.status || invoice.paymentStatus || 'pending').toLowerCase()
const isPaid = (invoice) => statusKey(invoice) === 'paid'
const isPendingGroup = (invoice) => ['pending', 'partially_paid'].includes(statusKey(invoice))
const isCancelledInvoice = (invoice) => ['CANCELLED'].includes(String(invoice.bookingStatus || invoice.serviceStatus || '').toUpperCase())
const canProcessPayment = (invoice) => !isPaid(invoice) && !isCancelledInvoice(invoice) && Number(invoice.remainingBalance || invoice.totalAmount || 0) > 0

function isVisibleServiceInvoice(invoice = {}) {
  const serviceStatus = String(invoice.serviceStatus || '').toUpperCase()
  const bookingStatus = String(invoice.bookingStatus || '').toUpperCase()

  if (serviceStatus) return serviceStatus === 'COMPLETED'
  if (bookingStatus) return bookingStatus === 'COMPLETED'

  const baseServicePrice = Number(invoice.baseServicePrice || 0)
  const itemsTotal = Number(invoice.itemsTotal || 0)
  const overtimeCharge = Number(invoice.overtimeCharge || 0)
  const bookingCharge = Number(invoice.bookingCharge || 0)
  const totalAmount = Number(invoice.totalAmount || 0)
  const itemCount = Array.isArray(invoice.items) ? invoice.items.length : 0

  return baseServicePrice > 0 || itemsTotal > 0 || overtimeCharge > 0 || itemCount > 0 || totalAmount > bookingCharge
}

function csvEscape(value) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function downloadBlob(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(href)
}

function Modal({ title, subtitle, children, onClose, size = '' }) {
  return <div className="modal fade show d-block invoices-modal-backdrop"><div className={`modal-dialog modal-dialog-centered ${size}`}><div className="modal-content"><div className="modal-header invoices-modal-header"><div><h5 className="modal-title fw-semibold text-white mb-0">{title}</h5>{subtitle ? <div className="invoices-modal-desc text-white-50">{subtitle}</div> : null}</div></div>{children}</div></div></div>
}

export function InvoicesAdminPage() {
  const toast = useToast()
  const [invoices, setInvoices] = useState([])
  const [feedbacks, setFeedbacks] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [method, setMethod] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [selected, setSelected] = useState(null)
  const [showPay, setShowPay] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [payForm, setPayForm] = useState(EMPTY_PAY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(1)
  const guardNavigation = useNavigationGuard(
    Boolean(showPay || saving),
    'A payment flow is still in progress. Leaving now may interrupt it. Continue?'
  )

  async function load() {
    setLoading(true)
    try {
      const [invoiceRes, feedbackRes] = await Promise.all([
        invoiceService.list(),
        serviceFeedbackService.list(),
      ])
      setInvoices((invoiceRes.data || []).filter(isVisibleServiceInvoice))
      setFeedbacks(feedbackRes.data || [])
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to load invoices.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filteredInvoices = useMemo(() => {
    const lowerSearch = search.trim().toLowerCase()
    return invoices.filter((invoice) => {
      if (tab === 'pending' && !isPendingGroup(invoice)) return false
      if (tab === 'paid' && !isPaid(invoice)) return false
      if (tab === 'partial' && statusKey(invoice) !== 'partially_paid') return false
      if (method && invoice.paymentMethod !== method) return false
      if (!lowerSearch) return true
      const hay = [invoiceNumber(invoice), invoice.vehicleInfo, invoice.serviceName, invoice.customerName, invoice.ownerName, invoice.transactionReference].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(lowerSearch)
    }).sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.invoiceDate) - new Date(b.invoiceDate)
      if (sortBy === 'amount-high') return Number(b.remainingBalance || b.totalAmount || 0) - Number(a.remainingBalance || a.totalAmount || 0)
      if (sortBy === 'amount-low') return Number(a.remainingBalance || a.totalAmount || 0) - Number(b.remainingBalance || b.totalAmount || 0)
      return new Date(b.invoiceDate) - new Date(a.invoiceDate)
    })
  }, [invoices, method, search, sortBy, tab])

  const counts = {
    all: invoices.length,
    pending: invoices.filter(isPendingGroup).length,
    partial: invoices.filter((invoice) => statusKey(invoice) === 'partially_paid').length,
    paid: invoices.filter(isPaid).length,
  }
  const paidInvoices = invoices.filter(isPaid)
  const pendingInvoices = invoices.filter(isPendingGroup)
  const totalRevenue = paidInvoices.reduce((sum, invoice) => sum + Number(invoice.totalPaidAmount || invoice.totalAmount || 0), 0)
  const pendingAmount = pendingInvoices.reduce((sum, invoice) => sum + Number(invoice.remainingBalance || invoice.totalAmount || 0), 0)
  const averageRating = feedbacks.length ? (feedbacks.reduce((sum, feedback) => sum + Number(feedback.rating || 0), 0) / feedbacks.length).toFixed(1) : null
  const topServices = Object.entries(paidInvoices.reduce((acc, invoice) => { const key = invoice.serviceName || 'Unknown'; acc[key] = (acc[key] || 0) + Number(invoice.totalPaidAmount || invoice.totalAmount || 0); return acc }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const feedbackForService = (serviceId) => feedbacks.find((feedback) => Number(feedback.serviceId) === Number(serviceId))
  const selectedBreakdown = getInvoiceBreakdown(selected || {})
  const selectedPriceSummaryRows = selected ? [
    ['Base Service', formatCurrency(selectedBreakdown.baseServicePrice)],
    ['Added BOM / Items', formatCurrency(selectedBreakdown.itemsTotal)],
    ['Overtime', formatCurrency(selectedBreakdown.overtimeCharge)],
    ['Advance Paid At Booking', formatCurrency(selectedBreakdown.bookingChargePaidAmount)],
    ['Net After Advance', formatCurrency(selectedBreakdown.netAmountAfterAdvance)],
    ['Final Invoice Paid', formatCurrency(selectedBreakdown.finalInvoicePaidAmount)],
    ['Remaining Balance', formatCurrency(selected.remainingBalance)],
    ['Gross Invoice Total', formatCurrency(selected.totalAmount)],
  ] : []
  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / PAGE_SIZE))
  const pagedInvoices = filteredInvoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function resetFilters() { setSearch(''); setMethod(''); setSortBy('newest'); setPage(1) }

  useEffect(() => { setPage(1) }, [search, method, sortBy, tab])
  useEffect(() => { setPage((current) => Math.min(current, totalPages)) }, [totalPages])

  async function withInvoiceDetails(invoice) {
    const response = await invoiceService.getById(invoice.invoiceId)
    return response.data || invoice
  }

  async function selectInvoice(invoice) {
    try {
      setSelected(await withInvoiceDetails(invoice))
      setShowDetail(true)
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to load invoice details.', 'error')
    }
  }

  async function openPay(invoice) {
    if (!canProcessPayment(invoice)) {
      toast('Payment is not available for cancelled invoices.', 'error')
      return
    }
    try {
      const detailed = await withInvoiceDetails(invoice)
      if (!canProcessPayment(detailed)) {
        toast('Payment is not available for cancelled invoices.', 'error')
        return
      }
      setSelected(detailed)
      setPayForm({ paymentMethod: '', amount: String(Number(detailed.remainingBalance || detailed.totalAmount || 0)), transactionReference: '' })
      setErrors({})
      setShowPay(true)
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to load invoice.', 'error')
    }
  }

  async function submitPayment(event) {
    event.preventDefault()
    const isCashPayment = payForm.paymentMethod === 'CASH'
    const nextErrors = validateInvoicePaymentForm(payForm, selected, {
      allowCash: true,
      requireTransactionRef: false,
    }).errors
    if (Object.keys(nextErrors).length) return setErrors(nextErrors)

    if (!isCashPayment) {
      startDigitalPayment()
      return
    }

    setSaving(true)
    try {
      await invoiceService.pay(selected.invoiceId, { ...payForm, amount: Number(payForm.amount) })
      toast('Payment processed successfully.')
      setShowPay(false)
      setSelected(null)
      await load()
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to process payment.', 'error')
    } finally {
      setSaving(false)
    }
  }

  function startDigitalPayment() {
    const amountValue = Number(payForm.amount)
    const amountInPaise = Math.round(amountValue * 100)

    if (!window.Razorpay) {
      toast('Razorpay SDK failed to load.', 'error')
      return
    }

    if (!selected?.invoiceId || !payForm.paymentMethod) {
      toast('Choose a payment method first.', 'error')
      return
    }

    if (!Number.isFinite(amountValue) || amountValue <= 0 || amountInPaise <= 0) {
      toast('Invalid payment amount.', 'error')
      return
    }

    setSaving(true)

    invoiceService.createCheckoutOrder(selected.invoiceId, {
      paymentMethod: payForm.paymentMethod,
      amount: amountValue,
      description: 'Admin Invoice Payment',
    }).then((orderResponse) => {
      const order = orderResponse.data || {}
      let checkoutFinalized = false
      let failureToastTimer = null

      function clearFailureToastTimer() {
        if (!failureToastTimer) return
        clearTimeout(failureToastTimer)
        failureToastTimer = null
      }

      const razorpay = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount || amountInPaise,
        currency: order.currency || 'INR',
        name: order.name || 'VServ',
        description: order.description || 'Admin Invoice Payment',
        handler: (response) => {
          if (checkoutFinalized) return
          checkoutFinalized = true
          clearFailureToastTimer()
          const txRef = response?.razorpay_payment_id || ''
          if (!txRef) {
            setSaving(false)
            toast('Payment completed but transaction reference is missing.', 'error')
            return
          }
          setPayForm((current) => ({ ...current, transactionReference: txRef }))
          invoiceService.verifyCheckout(selected.invoiceId, {
            paymentMethod: payForm.paymentMethod,
            amount: amountValue,
            razorpayOrderId: response?.razorpay_order_id || order.orderId,
            razorpayPaymentId: txRef,
            razorpaySignature: response?.razorpay_signature || '',
          }).then(async () => {
            toast('Payment processed successfully.')
            setShowPay(false)
            setSelected(null)
            await load()
          }).catch((error) => {
            toast(error.response?.data?.message || 'Failed to process payment.', 'error')
          }).finally(() => {
            setSaving(false)
          })
        },
        modal: {
          ondismiss: () => {
            if (checkoutFinalized) return
            checkoutFinalized = true
            clearFailureToastTimer()
            setSaving(false)
            toast('Admin invoice payment was cancelled.', 'error')
          },
        },
      })

      razorpay.on('payment.failed', () => {
        if (checkoutFinalized) return
        clearFailureToastTimer()
        failureToastTimer = setTimeout(() => {
          if (checkoutFinalized) return
          checkoutFinalized = true
          setSaving(false)
          toast('Payment failed. Please try again.', 'error')
        }, 250)
      })

      razorpay.open()
    }).catch((error) => {
      setSaving(false)
      toast(error.response?.data?.message || 'Unable to open Razorpay checkout right now.', 'error')
    })
  }

  async function downloadInvoice(invoice) {
    try {
      const detailed = invoice.items ? invoice : await withInvoiceDetails(invoice)
      const feedback = feedbackForService(detailed.serviceId)
      await downloadInvoicePdf(detailed, {
        invoiceNumber: invoiceNumber(detailed),
        feedbackText: feedback?.feedbackText || '',
        feedbackMeta: feedback ? `Rating ${feedback.rating}/5 • By ${feedback.customerName || 'Customer'} on ${formatDateTime(feedback.submittedAt)}` : '',
      })
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to download invoice.', 'error')
    }
  }

  function downloadAll() {
    const rows = [['Invoice Number', 'Date', 'Customer', 'Vehicle', 'Service', 'Status', 'Gross Total', 'Remaining Balance', 'Payment Method', 'Transaction Ref']]
    invoices.forEach((invoice) => rows.push([invoiceNumber(invoice), formatDate(invoice.invoiceDate), invoice.customerName || invoice.ownerName || '', invoice.vehicleInfo || '', invoice.serviceName || '', invoice.paymentStatus || '', Number(invoice.totalAmount || 0), Number(invoice.remainingBalance || 0), invoice.paymentMethod || '', invoice.transactionReference || '']))
    downloadBlob(rows.map((row) => row.map(csvEscape).join(',')).join('\n'), `all_invoices_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8')
  }

  return (
    <AdminLayout activeKey="invoices">
      <div className="invoices-admin-page">
        <AdminPageHero
          title="Invoices & Payments"
          subtitle="Review the full invoice calculation and payment progress. Generated invoices are settled digitally by customers from their portal."
          actions={<><button type="button" className="admin-hero-btn-outline" onClick={downloadAll}>Download All</button></>}
        />
        <PageContent>
          <PillStatRow>{[{ label: 'Total Invoices', value: invoices.length, tone: 'blue', icon: 'TI', bg: '#dbeafe' }, { label: 'Paid Invoices', value: counts.paid, tone: 'green', icon: 'PD', bg: '#dcfce7' }, { label: 'Pending Invoices', value: counts.pending, tone: 'amber', icon: 'PN', bg: '#fef3c7' }, { label: 'Partial Payments', value: counts.partial, tone: 'purple', icon: 'PT', bg: '#f3e8ff' }, { label: 'Revenue Generated', value: formatCurrency(totalRevenue), tone: 'purple', icon: 'RV', bg: '#f3e8ff' }, { label: 'Pending Amount', value: formatCurrency(pendingAmount), tone: 'red', icon: 'PA', bg: '#fee2e2' }, { label: 'Feedback Entries', value: feedbacks.length, tone: 'blue', icon: 'FB', bg: '#e0f2fe' }, { label: 'Average Rating', value: averageRating ? `${averageRating}/5` : 'N/A', tone: 'green', icon: 'RT', bg: '#dcfce7' }].map((card) => <PillStat key={card.label} label={card.label} value={card.value} color={card.bg} />)}</PillStatRow>
          <div className="toolbar-card mb-3">
            <div className="invoice-tabs">{[{ key: 'all', label: 'All Invoices', count: counts.all }, { key: 'pending', label: 'Pending', count: counts.pending }, { key: 'partial', label: 'Partial', count: counts.partial }, { key: 'paid', label: 'Paid', count: counts.paid }].map((item) => <button type="button" key={item.key} className={`invoice-tab ${tab === item.key ? 'active' : ''}`} onClick={() => setTab(item.key)}>{item.label}<span>{item.count}</span></button>)}</div>
            <div className="row g-2 align-items-end mt-1"><div className="col-md-4"><label className="toolbar-label">Search</label><input type="text" className="form-control form-control-sm toolbar-input" placeholder="Invoice #, vehicle, service, customer..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="col-md-2"><label className="toolbar-label">Payment Method</label><select className="form-select form-select-sm toolbar-select" value={method} onChange={(event) => setMethod(event.target.value)}><option value="">All Methods</option>{PAYMENT_METHODS.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><div className="col-md-2"><label className="toolbar-label">Sort</label><select className="form-select form-select-sm toolbar-select" value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="newest">Newest First</option><option value="oldest">Oldest First</option><option value="amount-high">Amount: High to Low</option><option value="amount-low">Amount: Low to High</option></select></div><div className="col-md-2"><button type="button" className="btn-reset w-100" onClick={resetFilters}>Reset</button></div></div>
          </div>
          <div className="invoices-layout">{loading ? <div className="section-card"><PageSpinner /></div> : <>
            <div className="invoice-main-column">
              <div className="invoice-results-bar"><small>{filteredInvoices.length ? `Showing ${((page - 1) * PAGE_SIZE) + 1}-${Math.min(page * PAGE_SIZE, filteredInvoices.length)} of ${filteredInvoices.length} invoice(s)` : '0 invoice(s)'}</small><div className="invoice-active-filters">{tab !== 'all' ? <span className="invoice-filter-pill">Status: {tab}</span> : null}{method ? <span className="invoice-filter-pill">Method: {method}</span> : null}{search ? <span className="invoice-filter-pill">Search: "{search}"</span> : null}</div></div>
              <div className="invoice-col-header"><span>Status</span><span>Invoice #</span><span>Vehicle / Service</span><span>Customer</span><span>Date</span><span>Balance Due</span><span>Actions</span></div>
              <div className="invoice-list">{!filteredInvoices.length ? <div className="empty-state"><div className="empty-state-icon">Bills</div><p>No invoices found.</p></div> : pagedInvoices.map((invoice) => <article key={invoice.invoiceId} className="invoice-card"><div className={`invoice-accent invoice-accent-${statusKey(invoice).replace(/_/g, '-')}`} /><div className="invoice-body"><div><StatusBadge status={invoice.paymentStatus} />{invoice.paymentMethod ? <div className="invoice-method-chip">{METHOD_ICONS[invoice.paymentMethod] || invoice.paymentMethod}</div> : null}</div><div className="invoice-number">{invoiceNumber(invoice)}</div><div className="invoice-main"><div className="invoice-row-title">{invoice.serviceName || 'Service'}</div><div className="invoice-row-sub">{invoice.vehicleInfo || 'Vehicle not available'}</div><div className="invoice-row-sub">Booking charge: {formatCurrency(invoice.bookingCharge || 0)}{invoice.bookingChargePaymentMethod ? ` - ${invoice.bookingChargePaymentMethod}` : ''}</div></div><div className="invoice-customer">{invoice.customerName || invoice.ownerName || 'Unknown customer'}</div><div className="invoice-date">{formatDate(invoice.invoiceDate)}{invoice.paidAt ? <div className="invoice-date-sub">Paid: {formatDateTime(invoice.paidAt)}</div> : null}</div><div className="invoice-amount">{formatCurrency(invoice.remainingBalance || invoice.totalAmount)}</div><div className="invoice-actions"><ActionIconButton icon="view" label="View details" onClick={() => selectInvoice(invoice)} /><ActionIconButton icon="download" label="Download invoice" onClick={() => downloadInvoice(invoice)} />{canProcessPayment(invoice) ? <ActionIconButton icon="pay" label="Process payment" className="action-success" onClick={() => openPay(invoice)} /> : null}</div></div></article>)}</div>
              <PaginationControls page={page} totalItems={filteredInvoices.length} pageSize={PAGE_SIZE} totalPages={totalPages} onPageChange={setPage} />
            </div>
            <aside className="invoice-sidebar stats-sidebar"><div className="stats-card availability-card"><div className="stats-card-title availability-card-title">Revenue Breakdown</div><div className="invoice-breakdown-row"><span>Paid</span><strong>{formatCurrency(totalRevenue)}</strong></div><div className="invoice-breakdown-track"><span className="invoice-breakdown-fill green" style={{ width: `${invoices.length ? Math.round((counts.paid / invoices.length) * 100) : 0}%` }} /></div><div className="invoice-breakdown-row mt-3"><span>Pending</span><strong>{formatCurrency(pendingAmount)}</strong></div><div className="invoice-breakdown-track"><span className="invoice-breakdown-fill amber" style={{ width: `${invoices.length ? Math.round((counts.pending / invoices.length) * 100) : 0}%` }} /></div></div><div className="stats-card availability-card"><div className="stats-card-title availability-card-title">Recent Payments</div>{paidInvoices.slice().sort((a, b) => new Date(b.paidAt || b.invoiceDate) - new Date(a.paidAt || a.invoiceDate)).slice(0, 5).map((invoice) => <div key={invoice.invoiceId} className="invoice-side-row"><div className="invoice-side-main"><div className="invoice-row-title">{invoiceNumber(invoice)}</div><div className="invoice-row-sub">{invoice.serviceName || 'Service'}{invoice.paymentMethod ? ` - ${invoice.paymentMethod}` : ''}</div></div><strong>{formatCurrency(invoice.totalPaidAmount || invoice.totalAmount)}</strong></div>)}</div><div className="stats-card availability-card"><div className="stats-card-title availability-card-title">Top Services</div>{topServices.length ? topServices.map(([name, revenue]) => <div key={name} className="invoice-side-row"><div className="invoice-side-main"><div className="invoice-row-title">{name}</div></div><strong>{formatCurrency(revenue)}</strong></div>) : <div className="text-muted small text-center">No data yet.</div>}</div></aside>
          </>}</div>
        </PageContent>
        {showPay && selected ? <Modal title="Process Payment" subtitle={invoiceNumber(selected)} onClose={() => setShowPay(false)}><form onSubmit={submitPayment}><div className="modal-body"><div className="invoice-pay-summary"><div><div className="invoice-row-title">{selected.vehicleInfo || 'Vehicle not available'}</div><div className="invoice-row-sub">{selected.serviceName || 'Service'}{selected.customerName ? ` - ${selected.customerName}` : ''}</div><div className="invoice-row-sub">Remaining balance: {formatCurrency(selected.remainingBalance || selected.totalAmount)}</div></div><div className="invoice-pay-amount">{formatCurrency(selected.remainingBalance || selected.totalAmount)}</div></div><div className="mb-3"><label className="modal-form-label">Payment Method</label><select className={`form-select modal-form-control ${errors.paymentMethod ? 'is-invalid' : ''}`} value={payForm.paymentMethod} onChange={(event) => setPayForm((current) => ({ ...current, paymentMethod: event.target.value, transactionReference: '' }))}><option value="">Select method</option>{PAYMENT_METHODS.map((item) => <option key={item} value={item}>{item}</option>)}</select>{errors.paymentMethod ? <div className="invalid-feedback d-block">{errors.paymentMethod}</div> : null}</div><div className="mb-3"><label className="modal-form-label">Amount</label><input type="number" className={`form-control modal-form-control ${errors.amount ? 'is-invalid' : ''}`} value={payForm.amount} min={1} onChange={(event) => setPayForm((current) => ({ ...current, amount: event.target.value }))} />{errors.amount ? <div className="invalid-feedback d-block">{errors.amount}</div> : null}</div><div><label className="modal-form-label">Transaction Reference</label><input className={`form-control modal-form-control ${errors.transactionReference ? 'is-invalid' : ''}`} value={payForm.transactionReference} placeholder={payForm.paymentMethod === 'CASH' ? 'Optional for cash' : 'Filled automatically after Razorpay payment'} readOnly={payForm.paymentMethod && payForm.paymentMethod !== 'CASH'} onChange={(event) => setPayForm((current) => ({ ...current, transactionReference: event.target.value }))} />{payForm.paymentMethod && payForm.paymentMethod !== 'CASH' ? <div className="form-text">Digital payments open Razorpay checkout and populate this reference automatically after payment.</div> : null}{errors.transactionReference ? <div className="invalid-feedback d-block">{errors.transactionReference}</div> : null}</div></div><div className="modal-footer"><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => guardNavigation(() => setShowPay(false))}>Cancel</button><button type="submit" className="invoices-pay-btn" disabled={saving}>{saving ? 'Processing...' : payForm.paymentMethod && payForm.paymentMethod !== 'CASH' ? 'Pay with Razorpay' : 'Confirm Payment'}</button></div></form></Modal> : null}
        {showDetail && selected ? <Modal title="Invoice Details" subtitle={`${invoiceNumber(selected)} - ${(selected.paymentStatus || '').replace(/_/g, ' ')}`} onClose={() => setShowDetail(false)} size="modal-lg"><div className="modal-body"><div className="detail-grid"><div className="detail-cell"><div className="dc-label">Vehicle</div><div className="dc-value">{selected.vehicleInfo || '-'}</div></div><div className="detail-cell"><div className="dc-label">Service</div><div className="dc-value">{selected.serviceName || '-'}</div></div><div className="detail-cell"><div className="dc-label">Customer</div><div className="dc-value">{selected.customerName || selected.ownerName || '-'}</div></div><div className="detail-cell"><div className="dc-label">Invoice Date</div><div className="dc-value">{formatDate(selected.invoiceDate)}</div></div><div className="detail-cell"><div className="dc-label">Latest Payment Method</div><div className="dc-value">{selected.paymentMethod || 'Pending'}</div></div><div className="detail-cell"><div className="dc-label">Latest Paid At</div><div className="dc-value">{selected.paidAt ? formatDateTime(selected.paidAt) : '-'}</div></div><div className="detail-cell">{selected.transactionReference ? <><div className="dc-label">Latest Transaction Ref</div><div className="dc-value">{selected.transactionReference}</div></> : selected.bookingChargeTransactionReference ? <><div className="dc-label">Booking Charge Ref</div><div className="dc-value">{selected.bookingChargeTransactionReference}</div></> : <><div className="dc-label">Status</div><div className="dc-value">{selected.paymentStatus || '-'}</div></>}</div><div className="detail-cell"><div className="dc-label">Status</div><div className="dc-value">{selected.paymentStatus || '-'}</div></div><div className="detail-cell full"><div className="dc-label">Price Summary</div><div className="p-3 rounded" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}><div className="d-flex flex-column gap-2">{selectedPriceSummaryRows.map(([label, value]) => <div key={label} className="d-flex justify-content-between align-items-start gap-3" style={{ fontSize: '0.84rem' }}><span style={{ color: '#64748b' }}>{label}</span><span style={{ fontWeight: label === 'Gross Invoice Total' || label === 'Remaining Balance' ? 700 : 600, textAlign: 'right', color: '#0f172a' }}>{value}</span></div>)}</div></div></div><div className="detail-cell full"><div className="dc-label">Line Items</div>{selected.items?.length ? <table className="line-items-table"><thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead><tbody>{selected.items.map((item) => <tr key={item.itemId}><td>{item.itemName}</td><td>{item.quantity}</td><td>{formatCurrency(item.unitPrice)}</td><td>{formatCurrency(item.total)}</td></tr>)}</tbody></table> : <div className="dc-value">No line items available.</div>}</div><div className="detail-cell full"><div className="dc-label">Customer Feedback</div>{feedbackForService(selected.serviceId) ? <div className="dc-value"><div style={{ fontWeight: 700 }}>{feedbackForService(selected.serviceId).rating}/5</div><div>{feedbackForService(selected.serviceId).feedbackText || 'No written feedback provided.'}</div><div className="text-muted mt-2">By {feedbackForService(selected.serviceId).customerName || 'Customer'} on {formatDateTime(feedbackForService(selected.serviceId).submittedAt)}</div></div> : <div className="dc-value">No feedback submitted for this service yet.</div>}</div></div></div><div className="modal-footer"><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => downloadInvoice(selected)}>Download</button><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowDetail(false)}>Close</button></div></Modal> : null}
      </div>
    </AdminLayout>
  )
}

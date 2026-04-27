import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CustomerLayout } from '../../../layouts/AppShell'
import { CustomerPageHero, PageContent } from '../../../components/common/PageElements'
import { PageSpinner } from '../../../components/ui/Spinner'
import { StatusBadge } from '../../../components/ui/Badge'
import { PillStat } from '../../../components/ui/PillStat'
import { PillStatRow } from '../../../components/ui/PillStatRow'
import { useToast } from '../../../components/ui/Toast'
import { formatCurrency, formatDate, formatDateTime } from '../../../utils/formatters'
import { ActionIconButton } from '../../../components/ui/ActionIconButton'
import { canCustomerPayInvoice, getInvoiceBreakdown } from '../utils/invoiceBreakdown'
import { PaginationControls } from '../../../components/ui/PaginationControls'
import { downloadInvoicePdf } from '../utils/invoicePdf'
import { useNavigationGuard } from '../../../hooks/useNavigationGuard'
import { bookingService } from '../../bookings/services/bookingService'
import { invoiceService } from '../services/invoiceService'
import { serviceFeedbackService } from '../services/serviceFeedbackService'

const INVOICE_PAYMENT_DRAFT_KEY = 'vserv_customer_invoice_payment_draft'
const PAGE_SIZE = 10
const INVOICE_STATUS_PRIORITY = {
  PARTIALLY_PAID: 0,
  PENDING: 1,
  PAID: 2,
}

function invoiceSortValue(invoice = {}) {
  return new Date(invoice.invoiceDate || invoice.createdAt || 0).getTime() || 0
}

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

function invoiceNumber(invoice) {
  return invoice.invoiceNumber || `INV-${String(invoice.invoiceId).padStart(4, '0')}`
}

function downloadCsv(rows, fileName) {
  const csv = rows.map((row) => row.map((value) => {
    const text = String(value ?? '')
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function FeedbackModal({ form, errors, saving, onClose, onChange, onSubmit }) {
  return (
    <div className="modal fade show d-block">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header text-white" style={{ background: 'var(--primary-dark-gradient)' }}>
            <h5 className="modal-title">Share Service Feedback</h5>
          </div>
          <form onSubmit={onSubmit}>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Rating</label>
                <div className={`d-flex flex-wrap gap-3 ${errors.rating ? 'is-invalid' : ''}`}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <label key={value} className="form-check form-check-inline m-0 d-flex align-items-center gap-2">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="feedbackRating"
                        value={value}
                        checked={String(form.rating) === String(value)}
                        onChange={(event) => onChange('rating', event.target.value)}
                      />
                      <span className="form-check-label">{value}</span>
                    </label>
                  ))}
                </div>
                {errors.rating ? <div className="invalid-feedback d-block">{errors.rating}</div> : null}
              </div>
              <div>
                <label className="form-label">Feedback</label>
                <textarea className={`form-control ${errors.feedbackText ? 'is-invalid' : ''}`} rows={4} maxLength={2000} value={form.feedbackText} onChange={(event) => onChange('feedbackText', event.target.value)} placeholder="Tell us about your service experience" />
                {errors.feedbackText ? <div className="invalid-feedback">{errors.feedbackText}</div> : null}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Submitting...' : 'Submit Feedback'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export function CustomerInvoicesPage() {
  const toast = useToast()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [processingPayment, setProcessingPayment] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState(null)
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [showViewModal, setShowViewModal] = useState(false)
  const [feedbackStatus, setFeedbackStatus] = useState(null)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [feedbackForm, setFeedbackForm] = useState({ rating: '', feedbackText: '' })
  const [feedbackErrors, setFeedbackErrors] = useState({})
  const [savingFeedback, setSavingFeedback] = useState(false)
  const [page, setPage] = useState(1)
  const guardNavigation = useNavigationGuard(
    processingPayment || savingFeedback || showFeedbackModal,
    'A payment or feedback flow is still in progress. Leaving now may interrupt it. Continue?'
  )

  async function loadInvoices(activeStatus = statusFilter) {
    setLoading(true)
    try {
      const response = await invoiceService.list({ status: activeStatus || undefined })
      setInvoices((response.data || []).filter(isVisibleServiceInvoice))
    } finally {
      setLoading(false)
    }
  }

  async function loadInvoiceDetails(invoiceId) {
    const response = await invoiceService.getById(invoiceId)
    const invoice = response.data
    setSelected(invoice)

    if (invoice?.bookingId) {
      try {
        const bookingResponse = await bookingService.getById(invoice.bookingId)
        setSelectedBooking(bookingResponse.data || null)
      } catch {
        setSelectedBooking(null)
      }
    } else {
      setSelectedBooking(null)
    }

    if (invoice?.serviceId) {
      try {
        const feedbackRes = await serviceFeedbackService.getStatus(invoice.serviceId)
        setFeedbackStatus(feedbackRes.data)
      } catch (error) {
        setFeedbackStatus(null)
        toast(error.response?.data?.message || 'Unable to load feedback status.', 'error')
      }
    } else {
      setFeedbackStatus(null)
    }
    return invoice
  }

  useEffect(() => {
    loadInvoices(statusFilter)
  }, [statusFilter])

  useEffect(() => {
    const status = (params.get('paymentStatus') || '').toLowerCase()
    if (!status) return

    const draft = JSON.parse(sessionStorage.getItem(INVOICE_PAYMENT_DRAFT_KEY) || 'null')
    const invoiceId = Number(params.get('invoiceId') || draft?.invoiceId || 0)

    if (status === 'cancelled') {
      sessionStorage.removeItem(INVOICE_PAYMENT_DRAFT_KEY)
      toast('Invoice payment was cancelled.', 'error')
      nav(invoiceId ? `/customer/invoices?invoiceId=${invoiceId}` : '/customer/invoices', { replace: true })
      return
    }

    if (status !== 'success' || !invoiceId) return

    async function completePaymentUi() {
      setProcessingPayment(true)
      try {
        sessionStorage.removeItem(INVOICE_PAYMENT_DRAFT_KEY)
        await loadInvoices(statusFilter)
        await loadInvoiceDetails(invoiceId)
        toast('Invoice payment completed successfully.')
      } catch (error) {
        toast(error.response?.data?.message || 'Failed to refresh invoice payment details.', 'error')
      } finally {
        setProcessingPayment(false)
        nav(`/customer/invoices?invoiceId=${invoiceId}`, { replace: true })
      }
    }

    completePaymentUi()
  }, [nav, params, statusFilter, toast])

  useEffect(() => {
    const invoiceId = Number(params.get('invoiceId') || 0)
    if (!invoiceId || loading || processingPayment) return
    loadInvoiceDetails(invoiceId)
  }, [loading, params, processingPayment])

  async function openInvoice(invoice) {
    await loadInvoiceDetails(invoice.invoiceId)
    setShowViewModal(true)
  }

  function exportInvoices() {
    downloadCsv([
      ['Invoice ID', 'Date', 'Service', 'Vehicle', 'Status', 'Gross Total', 'Remaining Balance'],
      ...invoices.map((inv) => [
        inv.invoiceId,
        formatDate(inv.invoiceDate),
        inv.serviceName || '-',
        inv.vehicleInfo || '-',
        inv.paymentStatus || '-',
        inv.totalAmount || 0,
        inv.remainingBalance || 0,
      ]),
    ], `my_invoices_${new Date().toISOString().slice(0, 10)}.csv`)
  }

  async function printInvoice() {
    if (!selected) return
    await downloadInvoicePdf(selected, {
      invoiceNumber: invoiceNumber(selected),
      feedbackText: feedbackStatus?.feedback?.feedbackText || '',
      feedbackMeta: feedbackStatus?.feedback
        ? `Rating ${feedbackStatus.feedback.rating}/5 • Submitted on ${formatDate(feedbackStatus.feedback.submittedAt)}`
        : '',
    })
  }

  function startInvoicePayment(invoice) {
    if (!canCustomerPayInvoice(invoice)) {
      toast('Payment is not available for cancelled invoices.', 'error')
      return
    }
    const remainingBalance = Number(invoice.remainingBalance || 0)
    if (remainingBalance <= 0) {
      toast('This invoice is already fully paid.', 'error')
      return
    }

    sessionStorage.setItem(INVOICE_PAYMENT_DRAFT_KEY, JSON.stringify({
      invoiceId: invoice.invoiceId,
      amount: remainingBalance,
      paymentMethod: 'UPI',
    }))

    const returnUrl = encodeURIComponent(`/customer/invoices?invoiceId=${invoice.invoiceId}`)
    nav(`/customer/payment?purpose=invoice&invoiceId=${invoice.invoiceId}&amount=${remainingBalance}&returnUrl=${returnUrl}`)
  }

  function updateFeedbackField(field, value) {
    setFeedbackForm((current) => ({ ...current, [field]: value }))
  }

  function validateFeedbackForm() {
    const errors = {}
    if (!feedbackForm.rating) errors.rating = 'Rating is required.'
    if ((feedbackForm.feedbackText || '').length > 2000) errors.feedbackText = 'Feedback must be at most 2000 characters.'
    setFeedbackErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function submitFeedback(event) {
    event.preventDefault()
    if (!selected?.serviceId || !validateFeedbackForm()) return
    setSavingFeedback(true)
    try {
      await serviceFeedbackService.create(selected.serviceId, {
        rating: Number(feedbackForm.rating),
        feedbackText: feedbackForm.feedbackText.trim() || null,
      })
      await loadInvoiceDetails(selected.invoiceId)
      setShowFeedbackModal(false)
      setFeedbackForm({ rating: '', feedbackText: '' })
      setFeedbackErrors({})
      toast('Feedback submitted successfully.')
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to submit feedback.', 'error')
    } finally {
      setSavingFeedback(false)
    }
  }

  const totalPaid = invoices.reduce((sum, invoice) => sum + Number(invoice.totalPaidAmount || 0), 0)
  const totalPending = invoices.reduce((sum, invoice) => sum + Number(invoice.remainingBalance || 0), 0)
  const visibleInvoices = useMemo(() => invoices
    .filter((invoice) => {
      if (!search.trim()) return true
      return `${invoice.invoiceId} ${invoice.serviceName || ''} ${invoice.vehicleInfo || ''}`.toLowerCase().includes(search.trim().toLowerCase())
    })
    .sort((left, right) => (
      (INVOICE_STATUS_PRIORITY[String(left.paymentStatus || '').toUpperCase()] ?? 99) -
      (INVOICE_STATUS_PRIORITY[String(right.paymentStatus || '').toUpperCase()] ?? 99) ||
      invoiceSortValue(right) - invoiceSortValue(left) ||
      Number(right.invoiceId || 0) - Number(left.invoiceId || 0)
    )), [invoices, search])
  const totalPages = Math.max(1, Math.ceil(visibleInvoices.length / PAGE_SIZE))
  const pagedInvoices = visibleInvoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const breakdown = getInvoiceBreakdown(selected || {})
  const bookingDetails = selectedBooking || {}
  const priceSummaryRows = selected ? [
    ['Base Service', formatCurrency(breakdown.baseServicePrice)],
    ['Added BOM / Items', formatCurrency(breakdown.itemsTotal)],
    ['Overtime', formatCurrency(breakdown.overtimeCharge)],
    ['Booking Charge', `${formatCurrency(breakdown.bookingCharge)}${selected.bookingChargePaymentMethod ? ` - ${selected.bookingChargePaymentMethod}` : ''}`],
    ['Gross Invoice Total', formatCurrency(breakdown.grossTotal)],
    ['Advance Paid At Booking', selected.advancePaid ? `${formatCurrency(breakdown.bookingChargePaidAmount)}${selected.bookingChargePaidAt ? ` on ${formatDateTime(selected.bookingChargePaidAt)}` : ''}` : 'No'],
    ['Net After Booking Advance', formatCurrency(breakdown.netAmountAfterAdvance)],
    ['Final Invoice Payments Received', formatCurrency(breakdown.finalInvoicePaidAmount)],
    ['Total Paid So Far', formatCurrency(breakdown.totalPaidAmount)],
    ['Balance Due', formatCurrency(breakdown.remainingBalance)],
  ] : []

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter])

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages))
  }, [totalPages])

  return (
    <CustomerLayout activeKey="invoices">
      <div className="customer-invoices-page">
        <CustomerPageHero
          title="My Invoices"
          subtitle="View and download your service invoices."
        />
        <PageContent>
          <PillStatRow>
            {[
              { icon: 'PT', label: 'Paid', value: formatCurrency(totalPaid), bg: '#dcfce7' },
              { icon: 'PB', label: 'Pending', value: formatCurrency(totalPending), bg: '#fef3c7' },
              { icon: 'TI', label: 'Invoices', value: invoices.length, bg: '#dbeafe' },
            ].map((k) => (
              <PillStat key={k.label} label={k.label} value={k.value} color={k.bg} />
            ))}
          </PillStatRow>

          <div className="toolbar-card customer-toolbar mb-3">
            <div className="row g-2 align-items-end">
              <div className="col-md-5">
                <label className="toolbar-label">Search</label>
                <input className="form-control form-control-sm" placeholder="Invoice, service, vehicle..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="col-md-5 d-flex gap-2 flex-wrap">
                {[{ k: '', l: 'All' }, { k: 'PENDING', l: 'Pending' }, { k: 'PARTIALLY_PAID', l: 'Partial' }, { k: 'PAID', l: 'Paid' }].map((t) => (
                  <button key={t.k} className={`btn btn-sm ${statusFilter === t.k ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setStatusFilter(t.k)}>{t.l}</button>
                ))}
              </div>
              <div className="col-md-2">
                <button className="btn btn-sm btn-outline-secondary w-100" disabled={!invoices.length} onClick={exportInvoices}>Download CSV</button>
              </div>
            </div>
          </div>

          <div className="row g-3">
            <div className="col-12">
              {(loading || processingPayment) ? <PageSpinner /> : (
                <div className="customer-invoice-list">
                  {pagedInvoices.map((inv) => (
                    <article
                      key={inv.invoiceId}
                      className={`customer-legacy-card customer-invoice-card ${selected?.invoiceId === inv.invoiceId && showViewModal ? 'is-active' : ''}`}
                      onClick={() => openInvoice(inv)}
                    >
                      <div className={`customer-legacy-accent invoice-${String(inv.paymentStatus || 'PENDING').toLowerCase()}`} />
                      <div className="customer-invoice-card-body">
                        <div className="customer-invoice-icon">{String(inv.paymentStatus || '').toUpperCase() === 'PAID' ? 'PAID' : 'DUE'}</div>
                        <div className="customer-booking-main">
                          <div className="customer-booking-title">{invoiceNumber(inv)}</div>
                          <div className="customer-booking-sub">{inv.serviceName || 'Service'}</div>
                          <div className="customer-booking-subtle">{inv.vehicleInfo || 'Vehicle not available'}</div>
                        </div>
                        <div className="customer-booking-date">
                          <div className="customer-booking-date-value">{formatDate(inv.invoiceDate)}</div>
                          <div className="customer-booking-subtle">{formatCurrency(inv.totalAmount || 0)} total</div>
                        </div>
                        <div className="customer-invoice-balance">
                          <div className="customer-invoice-balance-value">{formatCurrency(inv.remainingBalance ?? inv.totalAmount ?? 0)}</div>
                          <div className="customer-booking-subtle">Balance due</div>
                        </div>
                        <div className="customer-booking-status">
                          <StatusBadge status={inv.paymentStatus} />
                        </div>
                        <div className="customer-card-actions" onClick={(event) => event.stopPropagation()}>
                          <ActionIconButton icon="view" label="View invoice" onClick={() => openInvoice(inv)} />
                          {canCustomerPayInvoice(inv) ? <ActionIconButton icon="pay" label={`Pay ${formatCurrency(inv.remainingBalance)}`} className="action-success" onClick={() => startInvoicePayment(inv)} /> : null}
                          <ActionIconButton icon="download" label="Download invoice PDF" onClick={async () => {
                            await openInvoice(inv)
                            printInvoice()
                          }} />
                        </div>
                      </div>
                    </article>
                  ))}
                  {!visibleInvoices.length ? <div className="empty-state"><div className="empty-state-icon">Invoices</div><p>No invoices found</p></div> : null}
                </div>
              )}
              <PaginationControls page={page} totalItems={visibleInvoices.length} pageSize={PAGE_SIZE} totalPages={totalPages} onPageChange={setPage} />
            </div>

          </div>
          {showViewModal && selected ? (
            <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.4)' }}>
              <div className="modal-dialog modal-dialog-centered modal-xl">
                <div className="modal-content">
                  <div className="modal-header text-white" style={{ background: 'var(--primary-dark-gradient)' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem' }}>{invoiceNumber(selected)}</div>
                      <StatusBadge status={selected.paymentStatus} />
                    </div>
                  </div>
                  <div className="modal-body">
                    <div className="row g-3">
                      <div className="col-lg-6">
                        <div className="p-3 rounded h-100" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 10 }}>Invoice Summary</div>
                          <div className="d-flex flex-column gap-2">
                            {priceSummaryRows.map(([label, value]) => (
                              <div key={label} className="d-flex justify-content-between align-items-start gap-3 label-sm">
                                <span style={{ color: '#64748b' }}>{label}</span>
                                <span style={{ fontWeight: label === 'Gross Invoice Total' || label === 'Balance Due' ? 700 : 600, textAlign: 'right', color: '#0f172a' }}>{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="col-lg-6">
                        <div className="p-3 rounded h-100" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 10 }}>Booking & Service Details</div>
                          <div className="row g-2">
                            {[
                              ['Customer', selected.customerName || '-'],
                              ['Vehicle', selected.vehicleInfo || '-'],
                              ['Service', selected.serviceName || '-'],
                              ['Booking #', bookingDetails.bookingId ? `BK-${String(bookingDetails.bookingId).padStart(4, '0')}` : '-'],
                              ['Service Date', formatDate(bookingDetails.serviceDate || selected.invoiceDate)],
                              ['Time Slot', bookingDetails.timeSlot || '-'],
                              ['Advisor', bookingDetails.advisorName || 'Not assigned'],
                              ['Latest Payment', selected.paymentMethod || 'Pending'],
                              ['Latest Payment Ref', selected.transactionReference || '-'],
                              ['Paid At', formatDateTime(selected.paidAt)],
                            ].map(([label, value]) => (
                              <div key={label} className="col-sm-6">
                                <div className="detail-label">{label}</div>
                                <div className="detail-value" style={{ fontSize: '0.8rem' }}>{value}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 p-3 rounded" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <div className="detail-label mb-2">Line Items</div>
                      <div className="d-flex flex-column gap-2">
                        {(selected.items || []).length ? selected.items.map((item) => (
                          <div key={item.itemId || item.itemName} className="d-flex justify-content-between gap-3 p-2 rounded" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>{item.itemName || 'Item'}</div>
                              <div style={{ fontSize: 'var(--fs-fine)', color: '#64748b' }}>Qty {item.quantity || 1} - {formatCurrency(item.unitPrice || 0)} each</div>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{formatCurrency(item.total || 0)}</div>
                          </div>
                        )) : <div className="text-muted text-xs">No additional line items.</div>}
                      </div>
                    </div>

                    <div className="mt-3 p-3 rounded" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Service Feedback</div>
                          {feedbackStatus?.feedback ? (
                            <>
                              <div style={{ fontSize: '0.8rem', marginTop: 6 }}>Rating: <strong>{feedbackStatus.feedback.rating}/5</strong></div>
                              <div style={{ fontSize: 'var(--fs-meta)', color: '#475569', marginTop: 6 }}>{feedbackStatus.feedback.feedbackText || 'No written feedback provided.'}</div>
                              <div style={{ fontSize: 'var(--fs-fine)', color: '#64748b', marginTop: 8 }}>Submitted on {formatDate(feedbackStatus.feedback.submittedAt)}</div>
                            </>
                          ) : feedbackStatus?.eligible ? (
                            <div style={{ fontSize: 'var(--fs-meta)', color: '#475569', marginTop: 6 }}>This completed and fully paid service is ready for your feedback.</div>
                          ) : (
                            <div style={{ fontSize: 'var(--fs-meta)', color: '#64748b', marginTop: 6 }}>
                              {feedbackStatus?.paymentStatus !== 'PAID'
                                ? 'Feedback opens after the invoice is fully paid.'
                                : feedbackStatus?.serviceStatus !== 'COMPLETED'
                                  ? 'Feedback opens after the service is completed.'
                                  : 'No feedback available for this service yet.'}
                            </div>
                          )}
                        </div>
                        {feedbackStatus?.eligible ? <button className="btn btn-sm btn-primary" onClick={() => setShowFeedbackModal(true)}>Leave Feedback</button> : null}
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    {canCustomerPayInvoice(selected) ? <ActionIconButton icon="pay" label={`Pay ${formatCurrency(breakdown.remainingBalance)}`} className="action-success" onClick={() => startInvoicePayment(selected)} /> : null}
                    <ActionIconButton icon="download" label="Download invoice PDF" onClick={printInvoice} />
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setShowViewModal(false)}>Close</button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </PageContent>
      </div>
      {showFeedbackModal ? <FeedbackModal form={feedbackForm} errors={feedbackErrors} saving={savingFeedback} onClose={() => guardNavigation(() => setShowFeedbackModal(false))} onChange={updateFeedbackField} onSubmit={submitFeedback} /> : null}
    </CustomerLayout>
  )
}



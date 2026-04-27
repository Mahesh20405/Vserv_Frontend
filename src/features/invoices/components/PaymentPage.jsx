import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CustomerLayout } from '../../../layouts/AppShell'
import { CustomerPageHero, PageContent } from '../../../components/common/PageElements'
import { useToast } from '../../../components/ui/Toast'
import { useNavigationGuard } from '../../../hooks/useNavigationGuard'
import { invoiceService } from '../services/invoiceService'
import { paymentGatewayService } from '../services/paymentGatewayService'

const METHODS = [
  { id: 'UPI', label: 'UPI', icon: 'PAY' },
  { id: 'CARD', label: 'Credit/Debit Card', icon: 'CARD' },
  { id: 'NET_BANKING', label: 'Net Banking', icon: 'BANK' },
]

function resolvePaymentMethod(value) {
  return METHODS.some((item) => item.id === value) ? value : 'UPI'
}

export function PaymentPage() {
  const nav = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const amount = params.get('amount') || '0'
  const returnUrl = params.get('returnUrl') || '/customer/dashboard'
  const purpose = params.get('purpose') || 'booking'
  const invoiceId = Number(params.get('invoiceId') || 0)
  const presetPaymentMethod = params.get('paymentMethod') || ''
  const isPaymentMethodLocked = Boolean(presetPaymentMethod)
  const [paymentMethod, setPaymentMethod] = useState(resolvePaymentMethod(presetPaymentMethod))
  const [processing, setProcessing] = useState(false)
  const guardNavigation = useNavigationGuard(
    processing,
    'A payment is currently being processed. Leaving now may interrupt the payment flow. Continue?'
  )

  function buildReturnUrl(status, txRef = '') {
    const separator = returnUrl.includes('?') ? '&' : '?'
    const txRefParam = txRef ? `&txRef=${txRef}` : ''
    return `${returnUrl}${separator}paymentStatus=${status}&paymentMethod=${paymentMethod}${txRefParam}`
  }

  function cancel() {
    nav(buildReturnUrl('cancelled'), { replace: true })
  }

  async function pay() {
    const amountValue = Number(amount)

    if (!window.Razorpay) {
      toast('Razorpay SDK failed to load.', 'error')
      return
    }

    const amountInPaise = Math.round(amountValue * 100)

    if (!Number.isFinite(amountValue) || amountValue <= 0 || amountInPaise <= 0) {
      toast('Invalid payment amount.', 'error')
      return
    }

    if (purpose === 'invoice' && !invoiceId) {
      toast('Invoice reference is missing.', 'error')
      return
    }

    setProcessing(true)

    try {
      const orderResponse = purpose === 'invoice'
        ? await invoiceService.createCheckoutOrder(invoiceId, {
          paymentMethod,
          amount: amountValue,
          description: 'Invoice Payment',
        })
        : await paymentGatewayService.createBookingChargeOrder({
          paymentMethod,
          amount: amountValue,
          description: 'Booking Charge',
        })

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
        amount: order.amount,
        currency: order.currency || 'INR',
        name: order.name || 'VServ',
        description: order.description || (purpose === 'invoice' ? 'Invoice Payment' : 'Booking Charge'),
        handler: async (response) => {
          if (checkoutFinalized) return
          checkoutFinalized = true
          clearFailureToastTimer()
          try {
            const verificationPayload = {
              paymentMethod,
              amount: amountValue,
              razorpayOrderId: response?.razorpay_order_id || order.orderId,
              razorpayPaymentId: response?.razorpay_payment_id || '',
              razorpaySignature: response?.razorpay_signature || '',
            }

            if (purpose === 'invoice') {
              await invoiceService.verifyCheckout(invoiceId, verificationPayload)
            } else {
              await paymentGatewayService.verifyBookingCharge(verificationPayload)
            }

            const txRef = verificationPayload.razorpayPaymentId
            nav(buildReturnUrl('success', txRef), { replace: true })
          } catch (error) {
            setProcessing(false)
            toast(error.response?.data?.message || 'Payment verification failed. Please try again.', 'error')
          }
        },
        modal: {
          ondismiss: () => {
            if (checkoutFinalized) return
            checkoutFinalized = true
            clearFailureToastTimer()
            setProcessing(false)
            nav(buildReturnUrl('cancelled'), { replace: true })
          },
        },
      })

      razorpay.on('payment.failed', () => {
        if (checkoutFinalized) return
        clearFailureToastTimer()
        failureToastTimer = setTimeout(() => {
          if (checkoutFinalized) return
          checkoutFinalized = true
          setProcessing(false)
          toast('Payment failed. Please try again.', 'error')
        }, 250)
      })

      razorpay.open()
    } catch (error) {
      setProcessing(false)
      toast(error.response?.data?.message || 'Unable to open Razorpay checkout right now.', 'error')
    }
  }

  return (
    <CustomerLayout>
      <div className="customer-payment-page">
        <CustomerPageHero
          title={purpose === 'invoice' ? 'Invoice Payment' : 'Booking Charge Payment'}
          subtitle={purpose === 'invoice'
            ? 'Secure digital payment for your generated invoice'
            : 'Secure digital payment to reserve your service slot'}
        />
        <PageContent padded={false}>
          <div className="container-fluid px-4 py-4">
            <div style={{ maxWidth: 400, margin: '0 auto' }}>
              <div className="section-card">
                <div className="section-header"><span className="section-title">{isPaymentMethodLocked ? 'Confirm Payment' : 'Select Digital Payment Method'}</span></div>
                <div className="section-body">
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary-accent)', textAlign: 'center', marginBottom: 20 }}>
                    Amount: Rs {Number(amount).toLocaleString('en-IN')}
                  </div>
                  {isPaymentMethodLocked ? (
                    <div className="vehicle-card selected mb-4">
                      <div className="d-flex align-items-center gap-3">
                        <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{METHODS.find((item) => item.id === paymentMethod)?.icon || 'PAY'}</span>
                        <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{METHODS.find((item) => item.id === paymentMethod)?.label || paymentMethod}</span>
                        <span className="ms-auto" style={{ color: 'var(--primary-accent)' }}>Selected in booking</span>
                      </div>
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-2 mb-4">
                      {METHODS.map((item) => (
                        <div key={item.id} className={`vehicle-card ${paymentMethod === item.id ? 'selected' : ''}`} onClick={() => setPaymentMethod(item.id)}>
                          <div className="d-flex align-items-center gap-3">
                            <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{item.icon}</span>
                            <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{item.label}</span>
                            {paymentMethod === item.id ? <span className="ms-auto" style={{ color: 'var(--primary-accent)' }}>OK</span> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button className="btn btn-success w-100" disabled={processing} onClick={pay}>
                    {processing ? 'Opening checkout...' : `Pay Rs ${Number(amount).toLocaleString('en-IN')}`}
                  </button>
                  <button className="btn btn-outline-secondary w-100 mt-2" onClick={() => guardNavigation(cancel)}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        </PageContent>
      </div>
    </CustomerLayout>
  )
}



import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PublicLayout } from '../../../layouts/AppShell'
import { useAuth } from '../../auth/hooks/useAuth'
import { validateContactForm } from '../../../utils/authValidation'

const CONTACT_ITEMS = [
  ['Email', ['support@vserv.com', 'info@vserv.com'], '#f97316', 'Email'],
  ['Phone', ['+91 98765 43210', '+91 98765 43211'], '#0f766e', 'Phone'],
  ['Business Hours', ['Mon-Fri: 9:00 AM - 6:00 PM', 'Saturday: 9:00 AM - 2:00 PM'], '#d97706', 'Hours'],
]

const FAQS = [
  ['How do I book a service?', 'Create an account, add your vehicle, choose a service, select a slot, and confirm your booking in a few steps.'],
  ['Can I reschedule or cancel?', 'Yes. The dashboard flow supports booking updates, subject to your booking timing and slot availability.'],
  ['How do I track service progress?', 'Customers receive progress visibility as the booking moves through confirmation, in-progress work, and completion.'],
  ['Do services include warranty?', 'Warranty coverage depends on the service and invoice details, which are provided after completion.'],
]

export function ContactPage() {
  const { user } = useAuth()
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', subject: '', message: '' })
  const [errors, setErrors] = useState({})
  const [success, setSuccess] = useState(false)
  const [openFaq, setOpenFaq] = useState(0)

  const primaryCta = user
    ? user.role === 'ADMIN'
      ? '/admin/dashboard'
      : user.role === 'ADVISOR'
        ? '/advisor/dashboard'
        : '/customer/dashboard'
    : '/'

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    setSuccess(false)
  }

  function submit(event) {
    event.preventDefault()
    const { errors: nextErrors, isValid } = validateContactForm(form)
    if (!isValid) {
      setErrors(nextErrors)
      return
    }
    setForm({ fullName: '', email: '', phone: '', subject: '', message: '' })
    setErrors({})
    setSuccess(true)
  }

  return (
    <PublicLayout>
      <section className="public-hero text-center">
        <div className="container">
          <h1 className="display-4 fw-bold mb-3">Get In Touch</h1>
          <p className="lead mb-0" style={{ maxWidth: 720, margin: '0 auto', opacity: 0.9 }}>
            Have questions? Send us a message and we will get back to you as soon as possible.
          </p>
        </div>
      </section>

      <section className="container py-5">
        <div className="row g-4">
          <div className="col-lg-6">
            <div className="public-contact-card">
              <h3 className="fw-bold mb-4">Send Us A Message</h3>
              {success ? <div className="public-contact-success mb-4"><strong>Message sent.</strong> Our team will reach out shortly.</div> : null}
              <form onSubmit={submit} noValidate>
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label fw-semibold">Full Name</label>
                    <input className={`form-control ${errors.fullName ? 'is-invalid' : ''}`} value={form.fullName} onChange={(e) => update('fullName', e.target.value)} maxLength={80} />
                    {errors.fullName ? <div className="invalid-feedback">{errors.fullName}</div> : null}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Email Address</label>
                    <input type="email" className={`form-control ${errors.email ? 'is-invalid' : ''}`} value={form.email} onChange={(e) => update('email', e.target.value)} maxLength={100} />
                    {errors.email ? <div className="invalid-feedback">{errors.email}</div> : null}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Phone Number</label>
                    <input className={`form-control ${errors.phone ? 'is-invalid' : ''}`} value={form.phone} onChange={(e) => update('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} />
                    {errors.phone ? <div className="invalid-feedback">{errors.phone}</div> : null}
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold">Subject</label>
                    <select className={`form-select ${errors.subject ? 'is-invalid' : ''}`} value={form.subject} onChange={(e) => update('subject', e.target.value)}>
                      <option value="">Select a subject</option>
                      <option value="General Inquiry">General Inquiry</option>
                      <option value="Technical Support">Technical Support</option>
                      <option value="Partnership">Partnership</option>
                      <option value="Feedback">Feedback</option>
                      <option value="Other">Other</option>
                    </select>
                    {errors.subject ? <div className="invalid-feedback">{errors.subject}</div> : null}
                  </div>
                  <div className="col-12">
                    <div className="d-flex justify-content-between">
                      <label className="form-label fw-semibold">Message</label>
                      <span className={`small ${form.message.length > 1000 ? 'text-danger fw-semibold' : 'text-muted'}`}>{form.message.length} / 1000</span>
                    </div>
                    <textarea className={`form-control ${errors.message ? 'is-invalid' : ''}`} rows={5} value={form.message} onChange={(e) => update('message', e.target.value)} maxLength={1000} />
                    {errors.message ? <div className="invalid-feedback">{errors.message}</div> : null}
                  </div>
                  <div className="col-12">
                    <button type="submit" className="btn btn-primary w-100">Send Message</button>
                  </div>
                </div>
              </form>
            </div>
          </div>

          <div className="col-lg-6">
            <div className="public-contact-card h-100">
              <h3 className="fw-bold mb-4">Contact Information</h3>
              <div className="d-flex flex-column gap-3">
                {CONTACT_ITEMS.map(([label, details, color, mark]) => (
                  <div key={label} className="d-flex gap-3 py-2 border-bottom">
                    <div className="public-icon-slab mb-0" style={{ background: color, width: 48, height: 48 }}>{mark}</div>
                    <div>
                      <div className="fw-bold">{label}</div>
                      {details.map((detail) => <div key={detail} className="text-muted small">{detail}</div>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-5">
        <div className="text-center mb-4">
          <h2 className="fw-bold">Frequently Asked Questions</h2>
          <p className="text-muted">Quick answers to common questions.</p>
        </div>
        <div className="mx-auto d-flex flex-column gap-3" style={{ maxWidth: 760 }}>
          {FAQS.map(([question, answer], index) => (
            <div key={question} className="public-faq-item">
              <button type="button" className="public-faq-toggle" onClick={() => setOpenFaq((current) => current === index ? -1 : index)}>
                <span>{question}</span>
                <span>{openFaq === index ? '-' : '+'}</span>
              </button>
              {openFaq === index ? <p className="text-muted mb-0 mt-3">{answer}</p> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="container pb-5">
        <div className="public-cta-band text-center">
          <h2 className="fw-bold text-white mb-2">Ready To Join?</h2>
          <p className="mb-4">Our team is here to help you get started.</p>
          <div className="d-flex gap-3 justify-content-center flex-wrap">
            <Link to={primaryCta} className="btn btn-light btn-lg">{user ? 'Go to Dashboard' : 'Go to Homepage'}</Link>
            <Link to={user ? '/services' : '/login'} className="btn btn-outline-light btn-lg">{user ? 'Browse Services' : 'Login To Dashboard'}</Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}



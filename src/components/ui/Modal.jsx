import { useEffect, useRef } from 'react'

export function Modal({
  id,
  title,
  subtitle,
  children,
  footer,
  size = '',
  onClose,
  open = true,
  danger = false,
  contentClassName = '',
  headerClassName = '',
  bodyClassName = '',
  footerClassName = '',
}) {
  const modalRef = useRef(null)

  useEffect(() => {
    const el = modalRef.current
    if (!el || !window.bootstrap) return
    const handler = () => {
      onClose?.()
    }
    el.addEventListener('hidden.bs.modal', handler)
    return () => el.removeEventListener('hidden.bs.modal', handler)
  }, [onClose])

  const normalizedSize = String(size).replace('modal-', '')
  const sizeClass = normalizedSize === 'lg' ? 'modal-lg' : normalizedSize === 'xl' ? 'modal-xl' : normalizedSize === 'sm' ? 'modal-sm' : ''
  const isBootstrapManaged = Boolean(id)
  const modalClassName = isBootstrapManaged
    ? 'modal fade'
    : `modal fade ${open ? 'show d-block' : ''}`.trim()
  const resolvedHeaderClassName = `modal-header ${danger ? 'bg-danger text-white' : ''} ${headerClassName}`.trim()
  const resolvedBodyClassName = bodyClassName || (!isBootstrapManaged && !footer ? '' : undefined)
  const resolvedFooterClassName = `modal-footer ${footerClassName}`.trim()

  return (
    <div className={modalClassName} id={id} tabIndex="-1" ref={modalRef} style={!isBootstrapManaged && open ? { background: 'rgba(15, 23, 42, 0.42)' } : undefined}>
      <div className={`modal-dialog modal-dialog-centered ${sizeClass}`}>
        <div className={`modal-content ${contentClassName}`.trim()}>
          {title && (
            <div className={resolvedHeaderClassName}>
              <div>
                <h5 className="modal-title fw-semibold mb-0">{title}</h5>
                {subtitle ? <div className={danger ? 'text-white-50 small mt-1' : 'text-muted small mt-1'}>{subtitle}</div> : null}
              </div>
              {!footer && onClose ? <button type="button" className={`btn-close ${danger ? 'btn-close-white' : ''}`} aria-label="Close" onClick={onClose} /> : null}
            </div>
          )}
          <div className={resolvedBodyClassName}>{children}</div>
          {footer ? <div className={resolvedFooterClassName}>{footer}</div> : null}
        </div>
      </div>
    </div>
  )
}

export function showModal(id) {
  const el = document.getElementById(id)
  if (el && window.bootstrap) new window.bootstrap.Modal(el).show()
}

export function hideModal(id) {
  const el = document.getElementById(id)
  if (el && window.bootstrap) {
    const m = window.bootstrap.Modal.getInstance(el)
    m?.hide()
  }
}

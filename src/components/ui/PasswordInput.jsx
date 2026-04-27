function EyeIcon({ open }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.06 12.35a1 1 0 0 1 0-.7C3.98 7.3 7.7 4 12 4s8.02 3.3 9.94 7.65a1 1 0 0 1 0 .7C20.02 16.7 16.3 20 12 20s-8.02-3.3-9.94-7.65Z" />
      <circle cx="12" cy="12" r="3" />
      {open ? null : <line x1="4" y1="20" x2="20" y2="4" />}
    </svg>
  )
}

export function PasswordInput({
  value,
  onChange,
  placeholder,
  className = '',
  invalid = false,
  show,
  onToggle,
  ariaLabelShow = 'Show password',
  ariaLabelHide = 'Hide password',
  ...props
}) {
  return (
    <div className="input-group">
      <input
        type={show ? 'text' : 'password'}
        className={`${className} ${invalid ? 'is-invalid' : ''}`.trim()}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        {...props}
      />
      <button
        type="button"
        className="btn btn-outline-secondary d-flex align-items-center justify-content-center"
        style={{ width: 46 }}
        onClick={onToggle}
        aria-label={show ? ariaLabelHide : ariaLabelShow}
        title={show ? ariaLabelHide : ariaLabelShow}
      >
        <EyeIcon open={show} />
      </button>
    </div>
  )
}

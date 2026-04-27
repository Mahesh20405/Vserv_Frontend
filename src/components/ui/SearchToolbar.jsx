export function SearchToolbar({
  fields = [],
  onReset,
  resetLabel = 'Reset',
  className = '',
  children,
}) {
  return (
    <section className={`toolbar-card ${className}`.trim()}>
      <div className="row g-2 align-items-end">
        {fields.map((field) => (
          <div key={field.key} className={field.colClassName || 'col-md-3'}>
            {field.label ? <label className="toolbar-label">{field.label}</label> : null}
            {field.render ? field.render(field) : null}
            {field.error ? <div className="invalid-feedback d-block">{field.error}</div> : null}
            {field.helpText ? <div className="form-text">{field.helpText}</div> : null}
          </div>
        ))}
        {children}
        {onReset ? (
          <div className="col-md-2">
            <button type="button" className="btn-reset w-100" onClick={onReset}>{resetLabel}</button>
          </div>
        ) : null}
      </div>
    </section>
  )
}

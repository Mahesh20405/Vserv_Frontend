function classNames(...values) {
  return values.filter(Boolean).join(' ')
}

export function PageHero({
  title,
  subtitle,
  actions,
  children,
  variant = 'admin',
  className = '',
}) {
  const heroClass = `${variant}-page-hero`

  return (
    <section className={classNames('page-header', heroClass, className)}>
      <div className="container-fluid px-4">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <h2 className="text-white mb-0">{title}</h2>
            {subtitle ? <p className="mb-0 page-subtitle">{subtitle}</p> : null}
          </div>
          {actions ? <div className={`${heroClass}-actions`}>{actions}</div> : null}
        </div>
        {children ? <div className={`${heroClass}-extra`}>{children}</div> : null}
      </div>
    </section>
  )
}

export function PageContent({
  children,
  padded = true,
  flush = false,
  className = '',
}) {
  return (
    <div className={classNames('container-fluid px-4', padded && !flush ? 'py-3' : '', className)}>
      {children}
    </div>
  )
}

export function AdminPageHero(props) {
  return <PageHero variant="admin" {...props} />
}

export function CustomerPageHero(props) {
  return <PageHero variant="customer" {...props} />
}


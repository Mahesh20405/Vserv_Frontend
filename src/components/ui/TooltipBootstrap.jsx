import { useEffect } from 'react'

export function TooltipBootstrap() {
  useEffect(() => {
    if (!window.bootstrap?.Tooltip) return

    const nodes = Array.from(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
    const tooltips = nodes.map((node) =>
      window.bootstrap.Tooltip.getOrCreateInstance(node, {
        trigger: 'hover focus',
        container: 'body',
      }),
    )

    return () => {
      tooltips.forEach((tooltip) => tooltip.dispose())
    }
  })

  return null
}

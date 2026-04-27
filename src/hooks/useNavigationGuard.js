import { useCallback, useEffect, useId } from 'react'

const guards = new Map()

function setGuard(id, when, message) {
  if (when) guards.set(id, message)
  else guards.delete(id)
}

function clearGuard(id) {
  guards.delete(id)
}

export function getNavigationWarning() {
  return [...guards.values()][0] || ''
}

export function confirmNavigation(message = getNavigationWarning()) {
  if (!message) return true
  return window.confirm(message)
}

export function useNavigationGuard(when, message) {
  const id = useId()

  useEffect(() => {
    setGuard(id, when, message)
    return () => clearGuard(id)
  }, [id, message, when])

  useEffect(() => {
    function handleBeforeUnload(event) {
      if (!getNavigationWarning()) return
      event.preventDefault()
      event.returnValue = ''
    }

    function handleDocumentClick(event) {
      const link = event.target.closest('a[href]')
      if (!link) return
      if (link.target === '_blank' || link.hasAttribute('download')) return

      const href = link.getAttribute('href') || ''
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return

      const warning = getNavigationWarning()
      if (!warning) return

      const nextUrl = new URL(link.href, window.location.href)
      const currentUrl = new URL(window.location.href)
      if (`${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}` === `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`) return

      if (window.confirm(warning)) return

      event.preventDefault()
      event.stopPropagation()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('click', handleDocumentClick, true)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleDocumentClick, true)
    }
  }, [])

  return useCallback((action) => {
    if (!confirmNavigation()) return false
    action?.()
    return true
  }, [])
}

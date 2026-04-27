import { useState, createContext, useContext, useCallback } from 'react'

const ToastContext = createContext(null)

let toastId = 0

const TOAST_SYMBOLS = {
  success: '✓',
  error: '✕',
  warning: '!',
  info: 'i',
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const show = useCallback((message, type = 'success', duration = 3000) => {
    const id = ++toastId
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration)
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="vserv-toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`vserv-toast ${t.type}`}>
            <span>{TOAST_SYMBOLS[t.type] || TOAST_SYMBOLS.info}</span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be inside ToastProvider')
  return ctx.show
}

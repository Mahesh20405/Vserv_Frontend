import { ToastProvider } from './components/ui/Toast'
import { AppDocumentMeta } from './app/AppDocumentMeta'
import { SessionBootstrap } from './layouts/AppShell'
import { AppRoutes } from './app/routes'

export default function App() {
  return (
    <ToastProvider>
      <AppDocumentMeta />
      <SessionBootstrap />
      <AppRoutes />
    </ToastProvider>
  )
}


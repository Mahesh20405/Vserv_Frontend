import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthGuard, GuestGuard, ForgotPasswordPage, LoginPage, RegisterPage } from '../features/auth'
import { AdminDashboardPage, AdvisorDashboardPage, CustomerDashboardPage } from '../features/dashboard'
import { UsersPage } from '../features/users'
import { MyVehiclesPage, VehiclesAdminPage } from '../features/vehicles'
import { AdminBookServicePage, BookingsAdminPage, CustomerBookingsPage, CustomerBookServicePage, OverdueBookingsPage } from '../features/bookings'
import { AdvisorsPage } from '../features/advisors'
import { CatalogPage } from '../features/catalog'
import { WorkItemsPage } from '../features/work-items'
import { AvailabilityPage } from '../features/availability'
import { CustomerInvoicesPage, InvoicesAdminPage, PaymentPage } from '../features/invoices'
import { AdminProfilePage, AdvisorProfilePage, CustomerProfilePage } from '../features/profile'
import { AuditLogsPage } from '../features/audit-logs'
import { CompleteServicePage, ManageServicePage, ServiceDetailsPage } from '../features/service-records'
import { NotificationsPage } from '../features/notifications'
import { AboutPage, ContactPage, ErrorPage, HomePage, ServicesPage } from '../features/public'

export function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<HomePage />} />
      <Route path="/services" element={<ServicesPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/404" element={<ErrorPage />} />

      {/* Auth */}
      <Route path="/login" element={<GuestGuard><LoginPage /></GuestGuard>} />
      <Route path="/register" element={<GuestGuard><RegisterPage /></GuestGuard>} />
      <Route path="/forgot-password" element={<GuestGuard><ForgotPasswordPage /></GuestGuard>} />

      {/* Admin */}
      <Route path="/admin" element={<AuthGuard role="ADMIN"><Navigate to="/admin/dashboard" /></AuthGuard>} />
      <Route path="/admin/dashboard" element={<AuthGuard role="ADMIN"><AdminDashboardPage /></AuthGuard>} />
      <Route path="/admin/users" element={<AuthGuard role="ADMIN"><UsersPage /></AuthGuard>} />
      <Route path="/admin/vehicles" element={<AuthGuard role="ADMIN"><VehiclesAdminPage /></AuthGuard>} />
      <Route path="/admin/bookings" element={<AuthGuard role="ADMIN"><BookingsAdminPage /></AuthGuard>} />
      <Route path="/admin/overdue-bookings" element={<AuthGuard role="ADMIN"><OverdueBookingsPage /></AuthGuard>} />
      <Route path="/admin/advisors" element={<AuthGuard role="ADMIN"><AdvisorsPage /></AuthGuard>} />
      <Route path="/admin/catalog" element={<AuthGuard role="ADMIN"><CatalogPage /></AuthGuard>} />
      <Route path="/admin/work-items" element={<AuthGuard role="ADMIN"><WorkItemsPage /></AuthGuard>} />
      <Route path="/admin/availability" element={<AuthGuard role="ADMIN"><AvailabilityPage /></AuthGuard>} />
      <Route path="/admin/invoices" element={<AuthGuard role="ADMIN"><InvoicesAdminPage /></AuthGuard>} />
      <Route path="/admin/audit-logs" element={<AuthGuard role="ADMIN"><AuditLogsPage /></AuthGuard>} />
      <Route path="/admin/book-service" element={<AuthGuard role="ADMIN"><AdminBookServicePage /></AuthGuard>} />
      <Route path="/admin/profile" element={<AuthGuard role="ADMIN"><AdminProfilePage /></AuthGuard>} />

      {/* Advisor */}
      <Route path="/advisor" element={<AuthGuard role="ADVISOR"><Navigate to="/advisor/dashboard" /></AuthGuard>} />
      <Route path="/advisor/dashboard" element={<AuthGuard role="ADVISOR"><AdvisorDashboardPage /></AuthGuard>} />
      <Route path="/advisor/service-details/:id" element={<AuthGuard role="ADVISOR"><ServiceDetailsPage /></AuthGuard>} />
      <Route path="/advisor/manage-service" element={<AuthGuard role="ADVISOR"><ManageServicePage /></AuthGuard>} />
      <Route path="/advisor/complete-service" element={<AuthGuard role="ADVISOR"><CompleteServicePage /></AuthGuard>} />
      <Route path="/advisor/profile" element={<AuthGuard role="ADVISOR"><AdvisorProfilePage /></AuthGuard>} />

      {/* Customer */}
      <Route path="/customer" element={<AuthGuard role="CUSTOMER"><Navigate to="/customer/dashboard" /></AuthGuard>} />
      <Route path="/customer/dashboard" element={<AuthGuard role="CUSTOMER"><CustomerDashboardPage /></AuthGuard>} />
      <Route path="/customer/book-service" element={<AuthGuard role="CUSTOMER"><CustomerBookServicePage /></AuthGuard>} />
      <Route path="/customer/bookings" element={<AuthGuard role="CUSTOMER"><CustomerBookingsPage /></AuthGuard>} />
      <Route path="/customer/vehicles" element={<AuthGuard role="CUSTOMER"><MyVehiclesPage /></AuthGuard>} />
      <Route path="/customer/invoices" element={<AuthGuard role="CUSTOMER"><CustomerInvoicesPage /></AuthGuard>} />
      <Route path="/customer/notifications" element={<AuthGuard role="CUSTOMER"><NotificationsPage /></AuthGuard>} />
      <Route path="/customer/profile" element={<AuthGuard role="CUSTOMER"><CustomerProfilePage /></AuthGuard>} />
      <Route path="/customer/payment" element={<AuthGuard role="CUSTOMER"><PaymentPage /></AuthGuard>} />

      {/* Fallback */}
      <Route path="*" element={<ErrorPage />} />
    </Routes>
  )
}

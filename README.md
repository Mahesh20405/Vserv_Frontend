# VServ — Vehicle Service Management System

A full-featured, role-based vehicle service centre web application built with React. It supports three user roles — **Admin**, **Advisor**, and **Customer** — each with their own dashboard and workflows.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 |
| Build Tool | Vite 5 |
| State Management | Redux Toolkit + React-Redux |
| Routing | React Router DOM v6 |
| HTTP Client | Axios |
| Charts | Recharts |
| PDF Generation | jsPDF + html2canvas |
| Payments | Razorpay |
| Styling | CSS (per-role stylesheets) |

---

## Project Structure

```
src/
├── app/              # Store, root reducer, routes, app meta
├── components/       # Shared UI components (modals, toasts, cards, etc.)
├── config/           # Constants (roles, statuses, time slots, etc.)
├── assets/           # Fonts, icons, images
└── features/         # Feature modules (one folder per domain)
    ├── auth/
    ├── dashboard/
    ├── bookings/
    ├── vehicles/
    ├── advisors/
    ├── catalog/
    ├── invoices/
    ├── service-records/
    ├── work-items/
    ├── availability/
    ├── notifications/
    ├── audit-logs/
    ├── profile/
    └── public/
```

---

## Application Flow

```
Public Landing (/, /services, /about, /contact)
        │
        ▼
    Login / Register / Forgot Password
        │
        ├──► ADMIN ──────────────────────────────────────────────────┐
        │    Dashboard → Users, Vehicles, Advisors, Catalog,         │
        │    Bookings, Overdue Bookings, Work Items, Availability,    │
        │    Invoices, Audit Logs, Book Service, Profile              │
        │                                                             │
        ├──► ADVISOR ─────────────────────────────────────────────── │
        │    Dashboard → Service Details, Manage Service,            │
        │    Complete Service, Profile                                │
        │                                                             │
        └──► CUSTOMER ────────────────────────────────────────────── ┘
             Dashboard → Book Service, My Bookings, My Vehicles,
             Invoices, Payment (Razorpay), Notifications, Profile
```

Route access is enforced by `AuthGuard` (role-based) and `GuestGuard` (redirects logged-in users away from auth pages).

---

## Features

**Admin**
- Manage users, advisors, and customer vehicles
- Configure service catalog and work items
- Set advisor availability and time slots
- View and manage all bookings (including overdue)
- Generate and manage invoices
- Full audit log access

**Advisor**
- Personal dashboard with assigned services
- View service details, manage in-progress services
- Mark services as complete

**Customer**
- Self-service booking with time slot selection
- Track bookings and service history
- View and download invoices as PDF
- Pay online via Razorpay (UPI, Card, Net Banking, Cash)
- In-app notifications

**General**
- JWT-based auth with access/refresh token storage
- Role-based routing and guards
- Multi-step booking flow (`BookingStepper`)
- Pagination, search, and filtering across all list views
- Toast notifications and modal system
- Password strength meter on registration

---

## Getting Started

```bash
# Install dependencies
npm install

# Copy env file and fill in values
cp .env.example .env

# Start dev server
npm run dev

# Build for production
npm run build
```

**Environment variables (`.env`)**

```
VITE_API_BASE_URL=http://localhost:8080
VITE_PROXY_TARGET=http://localhost:8080
VITE_DEV_PORT=5173
VITE_RAZORPAY_KEY_ID=your_razorpay_key
```

---

## Roles & Booking Statuses

| Roles | `ADMIN` · `ADVISOR` · `CUSTOMER` |
|---|---|
| Booking Statuses | `PENDING` · `CONFIRMED` · `CANCELLED` · `RESCHEDULED` · `COMPLETED` |
| Payment Statuses | `PENDING` · `PAID` · `PARTIALLY_PAID` |
| Payment Methods | `UPI` · `CARD` · `NET_BANKING` · `CASH` |
| Service Types | `SERVICING` · `REPAIR` · `INSPECTION` · `MAINTENANCE` |
| Car Types | `SEDAN` · `SUV` · `HATCHBACK` · `COUPE` · `CONVERTIBLE` · `WAGON` · `MINIVAN` |

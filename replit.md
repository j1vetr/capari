# Çapari Balık Dağıtım - Cari Takip Sistemi

## Overview
A mobile-first web app for a small fish distribution shop ("Çapari Balık Dağıtım") that replaces a paper ledger with an easy accounting (cari) system. Turkish UI.

## Architecture
- **Frontend**: React + TypeScript + Vite, Tailwind CSS, shadcn/ui components, wouter routing, TanStack Query
- **Backend**: Express.js (Node.js), Drizzle ORM
- **Database**: PostgreSQL (Neon-backed via Replit)
- **PDF**: pdfkit for server-side PDF generation
- **PWA**: manifest.json + apple-mobile-web-app meta tags for installability

## Project Structure
- `shared/schema.ts` - Drizzle schema: counterparties, transactions tables + TypeScript types
- `server/db.ts` - Database connection pool
- `server/storage.ts` - DatabaseStorage class implementing IStorage interface
- `server/routes.ts` - Express API routes
- `server/pdf.ts` - PDF generation for counterparty statements and daily reports
- `server/seed.ts` - Demo seed data (customers, suppliers, transactions)
- `client/src/pages/` - React pages: dashboard, quick-transaction, counterparties, counterparty-detail, reports, bulk-payment
- `client/src/lib/formatters.ts` - Currency/date formatting utilities (Turkish locale)

## Key Features
- **Login screen**: Session-based authentication with password (LOGIN_PASSWORD env var, default: capari2024). 30-day session cookie. Logout button in header.
- Dashboard with summary cards (receivables, payables, daily totals) + 7-day sales chart + recent transactions + urgent payment alerts
- Quick Transaction flow: search counterparty → select type → enter amount → save (with date picker)
- Counterparty list with tabs (Müşteriler/Tedarikçiler) and balance display
- Counterparty detail: balance, transaction history with date range filtering + pagination, reverse (Düzelt) feature, delete counterparty
- Global search dialog in header for quick counterparty lookup
- Bulk collection/payment screen at /bulk
- PDF export for counterparty statements and daily reports
- Monthly report page with daily breakdown
- CSV export for counterparties and transactions
- JSON database backup download
- WhatsApp share with pre-filled message (emojis allowed in WhatsApp only)
- PWA support (installable on mobile)

## Data Model
- **counterparties**: id (uuid), type (customer|supplier), name, phone, notes, invoiced (boolean, default false), taxNumber, taxOffice, companyTitle, address, paymentDueDay (integer 1-31, nullable)
- **transactions**: id (uuid), counterparty_id (fk), tx_type (sale|collection|purchase|payment), amount (numeric 12,2), description, tx_date, reversed_of (uuid nullable)

## Business Rules
- Customer balance = sum(sale) - sum(collection) → positive = customer owes us
- Supplier balance = sum(purchase) - sum(payment) → positive = we owe supplier
- No deletion: "Düzelt" creates compensating reverse transaction
- Counterparty deletion only allowed when balance is zero
- Invoiced firms (faturalı): 1% KDV added separately on sale/purchase transactions
- Transaction dates cannot be in the future

## API Endpoints
- POST /api/auth/login - Login with password
- GET /api/auth/check - Check auth status
- POST /api/auth/logout - Logout
- GET /api/dashboard - Summary cards + chart data
- GET /api/stats - Statistics (top debtors, creditors, upcoming payments, counters)
- GET /api/recent-transactions - Recent transactions (limit query param)
- GET /api/counterparties - List with computed balances
- GET /api/counterparties/:id - Single counterparty with balance
- POST /api/counterparties - Create new
- PATCH /api/counterparties/:id - Update counterparty (name, phone, paymentDueDay)
- DELETE /api/counterparties/:id - Delete counterparty (balance must be zero)
- GET /api/counterparties/:id/transactions - Transaction history (startDate, endDate, limit, offset query params)
- GET /api/counterparties/:id/pdf - PDF statement download
- POST /api/transactions - Create transaction
- POST /api/transactions/:id/reverse - Create reverse transaction
- GET /api/reports/daily/:date - Daily report
- GET /api/reports/daily/:date/pdf - Daily report PDF
- GET /api/reports/monthly/:year/:month - Monthly report with daily breakdown
- GET /api/export/counterparties/csv - CSV export of counterparties
- GET /api/export/transactions/csv - CSV export of transactions
- GET /api/export/backup/json - Full JSON backup download

## Running
- `npm run dev` starts Express + Vite on port 5000
- Database auto-seeds with demo data on first run

## User Preferences
- Emojis allowed ONLY in WhatsApp messages, not in UI
- Site branding: "Çapari Balık" title, fish favicon
- Production domain: capari.toov.com.tr (port 1999)

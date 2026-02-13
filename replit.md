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
- `shared/schema.ts` - Drizzle schema: counterparties, transactions, products, transaction_items, checks_notes tables + TypeScript types
- `server/db.ts` - Database connection pool
- `server/storage.ts` - DatabaseStorage class implementing IStorage interface
- `server/routes.ts` - Express API routes
- `server/pdf.ts` - PDF generation for counterparty statements and daily reports
- `server/seed.ts` - Demo seed data (customers, suppliers, transactions)
- `client/src/pages/` - React pages: dashboard, quick-transaction, counterparties (with bulk check/note modal), counterparty-detail, reports, stock
- `client/src/lib/formatters.ts` - Currency/date formatting utilities (Turkish locale)

## Key Features
- **Login screen**: Session-based authentication with password (LOGIN_PASSWORD env var, default: capari2024). 30-day session cookie. Logout button in header.
- Dashboard with summary cards (receivables, payables, daily totals) + 7-day sales chart + recent transactions + urgent payment alerts
- Quick Transaction flow: search counterparty → select type → select products with quantities → save (with date picker)
- **Stock/Inventory tracking**: Products (fish) with units (kg/kasa/adet), stock levels computed from transactions. Sale decreases stock, purchase increases stock.
- Counterparty list with tabs (Müşteriler/Tedarikçiler) and balance display
- Counterparty detail: balance, transaction history with date range filtering + pagination, reverse (Düzelt) feature, delete counterparty
- Global search dialog in header for quick counterparty lookup
- PDF export for counterparty statements and daily reports
- Monthly report page with daily breakdown
- CSV export for counterparties and transactions
- JSON database backup download
- WhatsApp share with pre-filled message (emojis allowed in WhatsApp only)
- PWA support (installable on mobile)

## Data Model
- **counterparties**: id (uuid), type (customer|supplier), name, phone, notes, invoiced (boolean, default false), taxNumber, taxOffice, companyTitle, address, paymentDueDay (integer 1-31, nullable)
- **transactions**: id (uuid), counterparty_id (fk), tx_type (sale|collection|purchase|payment), amount (numeric 12,2), description, tx_date, reversed_of (uuid nullable)
- **products**: id (uuid), name, unit (kg|kasa|adet), is_active (boolean)
- **transaction_items**: id (uuid), transaction_id (fk), product_id (fk), quantity (numeric 10,2), unit_price (numeric 10,2 nullable)
- **stock_adjustments**: id (uuid), product_id (fk), quantity (numeric 10,2), notes (text nullable)
- **checks_notes**: id (uuid), counterparty_id (fk), kind (check|note), direction (received|given), amount (numeric 12,2), due_date (date), received_date (date nullable), status (pending|paid|bounced), notes (text nullable), transaction_id (uuid nullable), reversal_transaction_id (uuid nullable)

## Business Rules
- Customer balance = sum(sale) - sum(collection) → positive = customer owes us
- Supplier balance = sum(purchase) - sum(payment) → positive = we owe supplier
- Stock = sum(purchase quantities) - sum(sale quantities) + sum(manual adjustments) per product
- No deletion: "Düzelt" creates compensating reverse transaction (including stock reversal)
- Counterparty deletion allowed regardless of balance (deletes all related transactions)
- Invoiced firms (faturalı): 1% KDV added separately on sale/purchase transactions
- Transaction dates cannot be in the future
- Sale transactions check stock availability before saving
- Purchase transactions: manual product entry (name+unit+qty+price), auto-creates product if not in list, stock increases automatically
- Purchase allowed for both customers and suppliers (customer purchase reduces their balance)
- Sale transactions: select product from existing list
- Stock detail dialog: click product card to view all stock movements (transactions + manual adjustments)
- Balance formula: customer = sale - collection - purchase + payment; supplier = purchase - payment - sale + collection
- Check/note creation automatically creates a linked transaction (received→collection, given→payment) that immediately affects counterparty balance
- Check marked "paid" (ödendi): no balance change (already deducted at creation)
- Check marked "bounced" (karşılıksız): creates reversal transaction to cancel the original effect

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
- POST /api/transactions - Create transaction (with optional items array for sale/purchase)
- POST /api/transactions/:id/reverse - Create reverse transaction
- GET /api/transactions/:id/items - Get transaction line items
- GET /api/products - List all products
- GET /api/stock - Products with computed stock levels
- GET /api/stock/:productId/movements - Product stock movement history (transactions + adjustments)
- POST /api/products - Create new product
- PATCH /api/products/:id - Update product
- GET /api/reports/daily/:date - Daily report
- GET /api/reports/daily/:date/pdf - Daily report PDF
- GET /api/reports/monthly/:year/:month - Monthly report with daily breakdown
- GET /api/export/counterparties/csv - CSV export of counterparties
- GET /api/export/transactions/csv - CSV export of transactions
- GET /api/export/backup/json - Full JSON backup download
- GET /api/export/counterparties/pdf - All counterparties PDF report
- POST /api/whatsapp/send - Send WhatsApp text message via wpileti API
- POST /api/whatsapp/send-pdf - Generate counterparty PDF and send via WhatsApp SendMedia API (requires counterpartyId, receiver)
- GET /api/temp-pdf/:token - One-time temporary PDF download (used by WhatsApp API, crypto token, 3 min expiry)
- GET /api/counterparties/:id/checks - List checks/notes for counterparty
- POST /api/checks - Create check/note record
- PATCH /api/checks/:id/status - Update check status (paid/bounced)
- GET /api/checks/upcoming - Upcoming/overdue checks (days query param)
- POST /api/admin/reset - Reset all data (requires confirm: "SIFIRLA")

## Running
- `npm run dev` starts Express + Vite on port 5000
- Database starts empty (no demo seed data)

## User Preferences
- Emojis allowed ONLY in WhatsApp messages, not in UI
- Site branding: "Çapari Balık" title, fish favicon
- Production domain: capari.toov.com.tr (port 1999)

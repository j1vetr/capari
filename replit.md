# Çapari Balık Dağıtım - Cari Takip Sistemi

## Overview
A mobile-first web app for a small fish distribution shop ("Çapari Balık Dağıtım") that replaces a paper ledger with an easy accounting (cari) system. Turkish UI.

## Architecture
- **Frontend**: React + TypeScript + Vite, Tailwind CSS, shadcn/ui components, wouter routing, TanStack Query
- **Backend**: Express.js (Node.js), Drizzle ORM
- **Database**: PostgreSQL (Neon-backed via Replit)
- **PDF**: pdfkit for server-side PDF generation

## Project Structure
- `shared/schema.ts` - Drizzle schema: counterparties, transactions tables + TypeScript types
- `server/db.ts` - Database connection pool
- `server/storage.ts` - DatabaseStorage class implementing IStorage interface
- `server/routes.ts` - Express API routes
- `server/pdf.ts` - PDF generation for counterparty statements and daily reports
- `server/seed.ts` - Demo seed data (customers, suppliers, transactions)
- `client/src/pages/` - React pages: dashboard, quick-transaction, counterparties, counterparty-detail, reports
- `client/src/lib/formatters.ts` - Currency/date formatting utilities (Turkish locale)

## Key Features
- Dashboard with summary cards (receivables, payables, daily totals) + 7-day sales chart
- Quick Transaction flow: search counterparty → select type → enter amount → save
- Counterparty list with tabs (Müşteriler/Tedarikçiler) and balance display
- Counterparty detail: balance, transaction history, filters, reverse (Düzelt) feature
- PDF export for counterparty statements and daily reports
- WhatsApp share with pre-filled message

## Data Model
- **counterparties**: id (uuid), type (customer|supplier), name, phone, notes
- **transactions**: id (uuid), counterparty_id (fk), tx_type (sale|collection|purchase|payment), amount (numeric 12,2), description, tx_date, reversed_of (uuid nullable)

## Business Rules
- Customer balance = sum(sale) - sum(collection) → positive = customer owes us
- Supplier balance = sum(purchase) - sum(payment) → positive = we owe supplier
- No deletion: "Düzelt" creates compensating reverse transaction

## API Endpoints
- GET /api/dashboard - Summary cards + chart data
- GET /api/counterparties - List with computed balances
- GET /api/counterparties/:id - Single counterparty with balance
- POST /api/counterparties - Create new
- GET /api/counterparties/:id/transactions - Transaction history
- GET /api/counterparties/:id/pdf - PDF statement download
- POST /api/transactions - Create transaction
- POST /api/transactions/:id/reverse - Create reverse transaction
- GET /api/reports/daily/:date - Daily report
- GET /api/reports/daily/:date/pdf - Daily report PDF

## Running
- `npm run dev` starts Express + Vite on port 5000
- Database auto-seeds with demo data on first run

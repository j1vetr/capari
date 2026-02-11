import { sql } from "drizzle-orm";
import { pgTable, text, varchar, numeric, date, timestamp, uuid, index, boolean, integer, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const sessions = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
});

export const counterparties = pgTable("counterparties", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type", { enum: ["customer", "supplier"] }).notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  notes: text("notes"),
  invoiced: boolean("invoiced").default(false).notNull(),
  taxNumber: text("tax_number"),
  taxOffice: text("tax_office"),
  companyTitle: text("company_title"),
  address: text("address"),
  paymentDueDay: integer("payment_due_day"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  counterpartyId: uuid("counterparty_id").notNull().references(() => counterparties.id),
  txType: text("tx_type", { enum: ["sale", "collection", "purchase", "payment"] }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  txDate: date("tx_date").defaultNow().notNull(),
  reversedOf: uuid("reversed_of"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_transactions_counterparty").on(table.counterpartyId),
  index("idx_transactions_tx_date").on(table.txDate),
]);

export const products = pgTable("products", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  unit: text("unit", { enum: ["kg", "kasa", "adet"] }).notNull().default("kg"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const transactionItems = pgTable("transaction_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionId: uuid("transaction_id").notNull().references(() => transactions.id),
  productId: uuid("product_id").notNull().references(() => products.id),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_transaction_items_tx").on(table.transactionId),
  index("idx_transaction_items_product").on(table.productId),
]);

export const stockAdjustments = pgTable("stock_adjustments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: uuid("product_id").notNull().references(() => products.id),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_stock_adjustments_product").on(table.productId),
]);

export const insertCounterpartySchema = createInsertSchema(counterparties).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export type InsertCounterparty = z.infer<typeof insertCounterpartySchema>;
export type Counterparty = typeof counterparties.$inferSelect;

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});

export const insertTransactionItemSchema = createInsertSchema(transactionItems).omit({
  id: true,
  createdAt: true,
});

export const insertStockAdjustmentSchema = createInsertSchema(stockAdjustments).omit({
  id: true,
  createdAt: true,
});

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

export type InsertTransactionItem = z.infer<typeof insertTransactionItemSchema>;
export type TransactionItem = typeof transactionItems.$inferSelect;

export type CounterpartyWithBalance = Counterparty & { balance: string };
export type TransactionWithCounterparty = Transaction & { counterpartyName: string; counterpartyType: string };

export type InsertStockAdjustment = z.infer<typeof insertStockAdjustmentSchema>;
export type StockAdjustment = typeof stockAdjustments.$inferSelect;

export type ProductWithStock = Product & { currentStock: string };

export type TransactionItemWithProduct = TransactionItem & { productName: string; productUnit: string };

export type DashboardSummary = {
  totalReceivables: string;
  totalPayables: string;
  todaySales: string;
  todayCollections: string;
  todayPurchases: string;
  todayPayments: string;
  last7DaysSales: { date: string; total: string }[];
};

export type StatsData = {
  topDebtors: { id: string; name: string; balance: string }[];
  topCreditors: { id: string; name: string; balance: string }[];
  totalCustomers: number;
  totalSuppliers: number;
  totalTransactions: number;
  upcomingPayments: { id: string; name: string; type: string; balance: string; paymentDueDay: number; daysLeft: number }[];
};

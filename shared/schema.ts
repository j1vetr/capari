import { sql } from "drizzle-orm";
import { pgTable, text, varchar, numeric, date, timestamp, uuid, index, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const counterparties = pgTable("counterparties", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type", { enum: ["customer", "supplier"] }).notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  notes: text("notes"),
  invoiced: boolean("invoiced").default(false).notNull(),
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

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export type CounterpartyWithBalance = Counterparty & { balance: string };
export type TransactionWithCounterparty = Transaction & { counterpartyName: string; counterpartyType: string };

export type DashboardSummary = {
  totalReceivables: string;
  totalPayables: string;
  todaySales: string;
  todayCollections: string;
  todayPurchases: string;
  todayPayments: string;
  last7DaysSales: { date: string; total: string }[];
};

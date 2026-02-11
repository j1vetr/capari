import { eq, sql, desc, and, gte, lte } from "drizzle-orm";
import { db } from "./db";
import { counterparties, transactions } from "@shared/schema";
import type {
  Counterparty, InsertCounterparty, CounterpartyWithBalance,
  Transaction, InsertTransaction, TransactionWithCounterparty, DashboardSummary, StatsData
} from "@shared/schema";

export interface IStorage {
  getCounterparties(): Promise<CounterpartyWithBalance[]>;
  getCounterparty(id: string): Promise<CounterpartyWithBalance | undefined>;
  createCounterparty(data: InsertCounterparty): Promise<CounterpartyWithBalance>;

  getTransactionsByCounterparty(counterpartyId: string): Promise<Transaction[]>;
  getTransactionsByDate(date: string): Promise<TransactionWithCounterparty[]>;
  createTransaction(data: InsertTransaction): Promise<Transaction>;
  getTransaction(id: string): Promise<Transaction | undefined>;
  reverseTransaction(id: string): Promise<Transaction>;

  getStats(): Promise<StatsData>;
  updateCounterparty(id: string, data: Partial<InsertCounterparty>): Promise<CounterpartyWithBalance>;

  getDashboardSummary(): Promise<DashboardSummary>;
  getDailyReport(date: string): Promise<{
    totalSales: string;
    totalCollections: string;
    totalPurchases: string;
    totalPayments: string;
    transactions: TransactionWithCounterparty[];
  }>;
}

export class DatabaseStorage implements IStorage {
  async getCounterparties(): Promise<CounterpartyWithBalance[]> {
    const result = await db.execute(sql`
      SELECT c.*,
        COALESCE(
          CASE
            WHEN c.type = 'customer' THEN
              (SELECT COALESCE(SUM(CASE WHEN t.tx_type = 'sale' THEN t.amount ELSE 0 END) - SUM(CASE WHEN t.tx_type = 'collection' THEN t.amount ELSE 0 END), 0) FROM transactions t WHERE t.counterparty_id = c.id)
            ELSE
              (SELECT COALESCE(SUM(CASE WHEN t.tx_type = 'purchase' THEN t.amount ELSE 0 END) - SUM(CASE WHEN t.tx_type = 'payment' THEN t.amount ELSE 0 END), 0) FROM transactions t WHERE t.counterparty_id = c.id)
          END
        , 0) as balance
      FROM counterparties c
      ORDER BY c.name
    `);
    return result.rows as CounterpartyWithBalance[];
  }

  async getCounterparty(id: string): Promise<CounterpartyWithBalance | undefined> {
    const result = await db.execute(sql`
      SELECT c.*,
        COALESCE(
          CASE
            WHEN c.type = 'customer' THEN
              (SELECT COALESCE(SUM(CASE WHEN t.tx_type = 'sale' THEN t.amount ELSE 0 END) - SUM(CASE WHEN t.tx_type = 'collection' THEN t.amount ELSE 0 END), 0) FROM transactions t WHERE t.counterparty_id = c.id)
            ELSE
              (SELECT COALESCE(SUM(CASE WHEN t.tx_type = 'purchase' THEN t.amount ELSE 0 END) - SUM(CASE WHEN t.tx_type = 'payment' THEN t.amount ELSE 0 END), 0) FROM transactions t WHERE t.counterparty_id = c.id)
          END
        , 0) as balance
      FROM counterparties c
      WHERE c.id = ${id}
    `);
    return result.rows[0] as CounterpartyWithBalance | undefined;
  }

  async createCounterparty(data: InsertCounterparty): Promise<CounterpartyWithBalance> {
    const [created] = await db.insert(counterparties).values(data).returning();
    return { ...created, balance: "0" };
  }

  async getTransactionsByCounterparty(counterpartyId: string): Promise<Transaction[]> {
    return db.select().from(transactions)
      .where(eq(transactions.counterpartyId, counterpartyId))
      .orderBy(desc(transactions.txDate), desc(transactions.createdAt));
  }

  async getTransactionsByDate(date: string): Promise<TransactionWithCounterparty[]> {
    const result = await db.execute(sql`
      SELECT t.*, c.name as counterparty_name, c.type as counterparty_type
      FROM transactions t
      JOIN counterparties c ON c.id = t.counterparty_id
      WHERE t.tx_date = ${date}
      ORDER BY t.created_at DESC
    `);
    return result.rows.map((r: any) => ({
      ...r,
      txType: r.tx_type,
      counterpartyId: r.counterparty_id,
      reversedOf: r.reversed_of,
      txDate: r.tx_date,
      createdAt: r.created_at,
      counterpartyName: r.counterparty_name,
      counterpartyType: r.counterparty_type,
    })) as TransactionWithCounterparty[];
  }

  async createTransaction(data: InsertTransaction): Promise<Transaction> {
    const [created] = await db.insert(transactions).values(data).returning();
    return created;
  }

  async getTransaction(id: string): Promise<Transaction | undefined> {
    const [tx] = await db.select().from(transactions).where(eq(transactions.id, id));
    return tx;
  }

  async reverseTransaction(id: string): Promise<Transaction> {
    const original = await this.getTransaction(id);
    if (!original) throw new Error("Transaction not found");

    const reverseTypeMap: Record<string, string> = {
      sale: "collection",
      collection: "sale",
      purchase: "payment",
      payment: "purchase",
    };

    const [reversed] = await db.insert(transactions).values({
      counterpartyId: original.counterpartyId,
      txType: reverseTypeMap[original.txType] as any,
      amount: original.amount,
      description: `Düzeltme: ${original.description || ""}`.trim(),
      txDate: new Date().toISOString().split("T")[0],
      reversedOf: original.id,
    }).returning();

    return reversed;
  }

  async updateCounterparty(id: string, data: Partial<InsertCounterparty>): Promise<CounterpartyWithBalance> {
    await db.update(counterparties).set({ ...data, updatedAt: new Date() }).where(eq(counterparties.id, id));
    const updated = await this.getCounterparty(id);
    if (!updated) throw new Error("Cari bulunamadı");
    return updated;
  }

  async getStats(): Promise<StatsData> {
    const allParties = await this.getCounterparties();

    const customers = allParties.filter(p => p.type === "customer");
    const suppliers = allParties.filter(p => p.type === "supplier");

    const topDebtors = customers
      .filter(c => parseFloat(c.balance) > 0)
      .sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance))
      .slice(0, 5)
      .map(c => ({ id: c.id, name: c.name, balance: c.balance }));

    const topCreditors = suppliers
      .filter(s => parseFloat(s.balance) > 0)
      .sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance))
      .slice(0, 5)
      .map(s => ({ id: s.id, name: s.name, balance: s.balance }));

    const txCountResult = await db.execute(sql`SELECT COUNT(*)::int as count FROM transactions`);
    const totalTransactions = (txCountResult.rows[0] as any)?.count || 0;

    const today = new Date();
    const upcomingPayments = allParties
      .filter(p => p.paymentDueDay && parseFloat(p.balance) > 0)
      .map(p => {
        const dueDay = p.paymentDueDay!;
        let nextDue = new Date(today.getFullYear(), today.getMonth(), dueDay);
        if (nextDue < today) {
          nextDue = new Date(today.getFullYear(), today.getMonth() + 1, dueDay);
        }
        const daysLeft = Math.ceil((nextDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: p.id,
          name: p.name,
          type: p.type,
          balance: p.balance,
          paymentDueDay: dueDay,
          daysLeft: Math.max(0, daysLeft),
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 10);

    return {
      topDebtors,
      topCreditors,
      totalCustomers: customers.length,
      totalSuppliers: suppliers.length,
      totalTransactions,
      upcomingPayments,
    };
  }

  async getDashboardSummary(): Promise<DashboardSummary> {
    const today = new Date().toISOString().split("T")[0];

    const totalsResult = await db.execute(sql`
      SELECT
        COALESCE((SELECT SUM(CASE WHEN t.tx_type='sale' THEN t.amount ELSE 0 END) - SUM(CASE WHEN t.tx_type='collection' THEN t.amount ELSE 0 END)
          FROM transactions t JOIN counterparties c ON c.id=t.counterparty_id WHERE c.type='customer'), 0) as total_receivables,
        COALESCE((SELECT SUM(CASE WHEN t.tx_type='purchase' THEN t.amount ELSE 0 END) - SUM(CASE WHEN t.tx_type='payment' THEN t.amount ELSE 0 END)
          FROM transactions t JOIN counterparties c ON c.id=t.counterparty_id WHERE c.type='supplier'), 0) as total_payables,
        COALESCE((SELECT SUM(amount) FROM transactions WHERE tx_type='sale' AND tx_date=${today}), 0) as today_sales,
        COALESCE((SELECT SUM(amount) FROM transactions WHERE tx_type='collection' AND tx_date=${today}), 0) as today_collections,
        COALESCE((SELECT SUM(amount) FROM transactions WHERE tx_type='purchase' AND tx_date=${today}), 0) as today_purchases,
        COALESCE((SELECT SUM(amount) FROM transactions WHERE tx_type='payment' AND tx_date=${today}), 0) as today_payments
    `);

    const row = totalsResult.rows[0] as any;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

    const chartResult = await db.execute(sql`
      SELECT tx_date as date, COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE tx_type = 'sale' AND tx_date >= ${sevenDaysAgoStr}
      GROUP BY tx_date
      ORDER BY tx_date
    `);

    return {
      totalReceivables: String(row.total_receivables),
      totalPayables: String(row.total_payables),
      todaySales: String(row.today_sales),
      todayCollections: String(row.today_collections),
      todayPurchases: String(row.today_purchases),
      todayPayments: String(row.today_payments),
      last7DaysSales: chartResult.rows.map((r: any) => ({ date: r.date, total: String(r.total) })),
    };
  }

  async getDailyReport(date: string) {
    const txs = await this.getTransactionsByDate(date);

    let totalSales = 0, totalCollections = 0, totalPurchases = 0, totalPayments = 0;
    for (const tx of txs) {
      const amt = parseFloat(tx.amount);
      switch (tx.txType) {
        case "sale": totalSales += amt; break;
        case "collection": totalCollections += amt; break;
        case "purchase": totalPurchases += amt; break;
        case "payment": totalPayments += amt; break;
      }
    }

    return {
      totalSales: totalSales.toFixed(2),
      totalCollections: totalCollections.toFixed(2),
      totalPurchases: totalPurchases.toFixed(2),
      totalPayments: totalPayments.toFixed(2),
      transactions: txs,
    };
  }
}

export const storage = new DatabaseStorage();

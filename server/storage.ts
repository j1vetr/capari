import { eq, sql, desc, and, gte, lte } from "drizzle-orm";
import { db } from "./db";
import { counterparties, transactions, products, transactionItems, stockAdjustments, checksNotes } from "@shared/schema";
import type {
  Counterparty, InsertCounterparty, CounterpartyWithBalance,
  Transaction, InsertTransaction, TransactionWithCounterparty, DashboardSummary, StatsData,
  Product, InsertProduct, ProductWithStock, TransactionItem, TransactionItemWithProduct,
  InsertStockAdjustment, StockAdjustment,
  CheckNote, InsertCheckNote, CheckNoteWithCounterparty
} from "@shared/schema";

export interface IStorage {
  getCounterparties(): Promise<CounterpartyWithBalance[]>;
  getCounterparty(id: string): Promise<CounterpartyWithBalance | undefined>;
  createCounterparty(data: InsertCounterparty): Promise<CounterpartyWithBalance>;

  getTransactionsByCounterparty(counterpartyId: string, options?: { startDate?: string; endDate?: string; limit?: number; offset?: number }): Promise<{ transactions: Transaction[]; total: number }>;
  getTransactionsByDate(date: string): Promise<TransactionWithCounterparty[]>;
  createTransaction(data: InsertTransaction): Promise<Transaction>;
  getTransaction(id: string): Promise<Transaction | undefined>;
  reverseTransaction(id: string): Promise<Transaction>;
  deleteTransaction(id: string): Promise<void>;

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

  getRecentTransactions(limit: number): Promise<TransactionWithCounterparty[]>;
  getAllTransactions(): Promise<TransactionWithCounterparty[]>;
  deleteCounterparty(id: string): Promise<void>;

  getProducts(): Promise<Product[]>;
  getProductsWithStock(): Promise<ProductWithStock[]>;
  createProduct(data: InsertProduct): Promise<Product>;
  updateProduct(id: string, data: Partial<InsertProduct>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  findOrCreateProduct(name: string, unit: string): Promise<Product>;
  createTransactionWithItems(data: InsertTransaction, items: { productId: string; quantity: string; unitPrice?: string }[]): Promise<Transaction>;
  getTransactionItems(transactionId: string): Promise<TransactionItemWithProduct[]>;
  createStockAdjustment(data: InsertStockAdjustment): Promise<StockAdjustment>;

  getChecksByCounterparty(counterpartyId: string): Promise<CheckNote[]>;
  createCheckNote(data: InsertCheckNote): Promise<CheckNote>;
  createCheckNoteWithTransaction(data: InsertCheckNote, transactionId: string): Promise<CheckNote>;
  updateCheckStatus(id: string, status: "paid" | "bounced"): Promise<CheckNote>;
  bounceCheckNote(id: string): Promise<CheckNote>;
  deleteCheckNote(id: string): Promise<void>;
  getUpcomingChecks(daysBefore?: number): Promise<CheckNoteWithCounterparty[]>;

  resetAllData(): Promise<void>;
  getMonthlyReport(year: number, month: number): Promise<{
    totalSales: string;
    totalCollections: string;
    totalPurchases: string;
    totalPayments: string;
    dailyBreakdown: { date: string; sales: string; collections: string; purchases: string; payments: string }[];
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
              (SELECT COALESCE(SUM(CASE WHEN t.tx_type = 'sale' THEN t.amount WHEN t.tx_type = 'collection' THEN -t.amount WHEN t.tx_type = 'purchase' THEN -t.amount WHEN t.tx_type = 'payment' THEN t.amount ELSE 0 END), 0) FROM transactions t WHERE t.counterparty_id = c.id)
            ELSE
              (SELECT COALESCE(SUM(CASE WHEN t.tx_type = 'purchase' THEN t.amount WHEN t.tx_type = 'payment' THEN -t.amount WHEN t.tx_type = 'sale' THEN -t.amount WHEN t.tx_type = 'collection' THEN t.amount ELSE 0 END), 0) FROM transactions t WHERE t.counterparty_id = c.id)
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
              (SELECT COALESCE(SUM(CASE WHEN t.tx_type = 'sale' THEN t.amount WHEN t.tx_type = 'collection' THEN -t.amount WHEN t.tx_type = 'purchase' THEN -t.amount WHEN t.tx_type = 'payment' THEN t.amount ELSE 0 END), 0) FROM transactions t WHERE t.counterparty_id = c.id)
            ELSE
              (SELECT COALESCE(SUM(CASE WHEN t.tx_type = 'purchase' THEN t.amount WHEN t.tx_type = 'payment' THEN -t.amount WHEN t.tx_type = 'sale' THEN -t.amount WHEN t.tx_type = 'collection' THEN t.amount ELSE 0 END), 0) FROM transactions t WHERE t.counterparty_id = c.id)
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

  async getTransactionsByCounterparty(counterpartyId: string, options?: { startDate?: string; endDate?: string; limit?: number; offset?: number }): Promise<{ transactions: Transaction[]; total: number }> {
    const conditions = [eq(transactions.counterpartyId, counterpartyId)];
    if (options?.startDate) conditions.push(gte(transactions.txDate, options.startDate));
    if (options?.endDate) conditions.push(lte(transactions.txDate, options.endDate));
    const where = and(...conditions);

    const countResult = await db.select({ count: sql<number>`count(*)` }).from(transactions).where(where!);
    const total = Number(countResult[0].count);

    let query = db.select().from(transactions)
      .where(where!)
      .orderBy(desc(transactions.txDate), desc(transactions.createdAt));

    if (options?.limit) query = query.limit(options.limit) as any;
    if (options?.offset) query = query.offset(options.offset) as any;

    const txList = await query;
    return { transactions: txList, total };
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

    const originalItems = await this.getTransactionItems(id);
    if (originalItems.length > 0) {
      const reverseItems = originalItems.map(item => ({
        transactionId: reversed.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }));
      await db.insert(transactionItems).values(reverseItems);
    }

    return reversed;
  }

  async deleteTransaction(id: string): Promise<void> {
    const tx = await this.getTransaction(id);
    if (!tx) throw new Error("İşlem bulunamadı");
    await db.delete(transactionItems).where(eq(transactionItems.transactionId, id));
    const reversals = await db.select({ id: transactions.id }).from(transactions).where(eq(transactions.reversedOf, id));
    for (const rev of reversals) {
      await db.delete(transactionItems).where(eq(transactionItems.transactionId, rev.id));
      await db.delete(transactions).where(eq(transactions.id, rev.id));
    }
    await db.delete(transactions).where(eq(transactions.id, id));
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

    const topDebtors = allParties
      .filter(c => {
        if (c.type === "customer") return parseFloat(c.balance) > 0;
        if (c.type === "supplier") return parseFloat(c.balance) < 0;
        return false;
      })
      .sort((a, b) => Math.abs(parseFloat(b.balance)) - Math.abs(parseFloat(a.balance)))
      .slice(0, 10)
      .map(c => ({ id: c.id, name: c.name, balance: String(Math.abs(parseFloat(c.balance)).toFixed(2)), type: c.type }));

    const topCreditors = allParties
      .filter(c => {
        if (c.type === "supplier") return parseFloat(c.balance) > 0;
        if (c.type === "customer") return parseFloat(c.balance) < 0;
        return false;
      })
      .sort((a, b) => Math.abs(parseFloat(b.balance)) - Math.abs(parseFloat(a.balance)))
      .slice(0, 10)
      .map(c => ({ id: c.id, name: c.name, balance: String(Math.abs(parseFloat(c.balance)).toFixed(2)), type: c.type }));

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
      WITH balances AS (
        SELECT c.id, c.type,
          CASE
            WHEN c.type = 'customer' THEN
              COALESCE(SUM(CASE WHEN t.tx_type='sale' THEN t.amount WHEN t.tx_type='collection' THEN -t.amount WHEN t.tx_type='purchase' THEN -t.amount WHEN t.tx_type='payment' THEN t.amount ELSE 0 END), 0)
            ELSE
              COALESCE(SUM(CASE WHEN t.tx_type='purchase' THEN t.amount WHEN t.tx_type='payment' THEN -t.amount WHEN t.tx_type='sale' THEN -t.amount WHEN t.tx_type='collection' THEN t.amount ELSE 0 END), 0)
          END as balance
        FROM counterparties c
        LEFT JOIN transactions t ON t.counterparty_id = c.id
        GROUP BY c.id, c.type
      )
      SELECT
        COALESCE((SELECT SUM(balance) FROM balances WHERE type = 'customer' AND balance > 0), 0) as total_receivables,
        COALESCE(
          (SELECT SUM(balance) FROM balances WHERE type = 'supplier' AND balance > 0), 0
        ) + COALESCE(
          (SELECT SUM(ABS(balance)) FROM balances WHERE type = 'customer' AND balance < 0), 0
        ) as total_payables,
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

    const checkStatsResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN cn.direction = 'received' AND cn.status = 'pending' THEN cn.amount ELSE 0 END), 0) as total_pending_received,
        COALESCE(SUM(CASE WHEN cn.direction = 'given' AND cn.status = 'pending' THEN cn.amount ELSE 0 END), 0) as total_pending_given,
        COALESCE(SUM(CASE WHEN cn.status = 'pending' AND cn.due_date < CURRENT_DATE THEN cn.amount ELSE 0 END), 0) as overdue_total,
        COALESCE(SUM(CASE WHEN cn.status = 'pending' AND cn.due_date < CURRENT_DATE THEN 1 ELSE 0 END), 0)::int as overdue_count
      FROM checks_notes cn
    `);
    const checkRow = checkStatsResult.rows[0] as any;

    const nearestCheckResult = await db.execute(sql`
      SELECT cn.amount, cn.due_date, cn.kind, c.name as counterparty_name
      FROM checks_notes cn
      JOIN counterparties c ON c.id = cn.counterparty_id
      WHERE cn.status = 'pending' AND cn.due_date >= CURRENT_DATE
      ORDER BY cn.due_date ASC
      LIMIT 1
    `);
    const nearestRow = nearestCheckResult.rows[0] as any;
    let nearestCheck = null;
    if (nearestRow) {
      const dueDate = new Date(nearestRow.due_date);
      const todayDate = new Date();
      todayDate.setHours(0,0,0,0);
      const daysLeft = Math.ceil((dueDate.getTime() - todayDate.getTime()) / (1000*60*60*24));
      nearestCheck = {
        counterpartyName: nearestRow.counterparty_name,
        amount: String(nearestRow.amount),
        dueDate: nearestRow.due_date,
        kind: nearestRow.kind,
        daysLeft,
      };
    }

    return {
      totalReceivables: String(row.total_receivables),
      totalPayables: String(row.total_payables),
      todaySales: String(row.today_sales),
      todayCollections: String(row.today_collections),
      todayPurchases: String(row.today_purchases),
      todayPayments: String(row.today_payments),
      last7DaysSales: chartResult.rows.map((r: any) => ({ date: r.date, total: String(r.total) })),
      checkStats: {
        totalPendingReceived: String(checkRow.total_pending_received),
        totalPendingGiven: String(checkRow.total_pending_given),
        nearestCheck,
        overdueCount: checkRow.overdue_count,
        overdueTotal: String(checkRow.overdue_total),
      },
    };
  }

  async getRecentTransactions(limit: number): Promise<TransactionWithCounterparty[]> {
    const result = await db.execute(sql`
      SELECT t.*, c.name as counterparty_name, c.type as counterparty_type
      FROM transactions t
      JOIN counterparties c ON c.id = t.counterparty_id
      ORDER BY t.created_at DESC
      LIMIT ${limit}
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

  async getAllTransactions(): Promise<TransactionWithCounterparty[]> {
    const result = await db.execute(sql`
      SELECT t.*, c.name as counterparty_name, c.type as counterparty_type
      FROM transactions t
      JOIN counterparties c ON c.id = t.counterparty_id
      ORDER BY t.tx_date DESC, t.created_at DESC
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

  async getMonthlyReport(year: number, month: number) {
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

    const txResult = await db.execute(sql`
      SELECT t.*, c.name as counterparty_name, c.type as counterparty_type
      FROM transactions t
      JOIN counterparties c ON c.id = t.counterparty_id
      WHERE t.tx_date >= ${startDate} AND t.tx_date < ${endDate}
      ORDER BY t.tx_date DESC, t.created_at DESC
    `);

    const txs: TransactionWithCounterparty[] = txResult.rows.map((r: any) => ({
      ...r,
      txType: r.tx_type,
      counterpartyId: r.counterparty_id,
      reversedOf: r.reversed_of,
      txDate: r.tx_date,
      createdAt: r.created_at,
      counterpartyName: r.counterparty_name,
      counterpartyType: r.counterparty_type,
    }));

    let totalSales = 0, totalCollections = 0, totalPurchases = 0, totalPayments = 0;
    const dailyMap = new Map<string, { sales: number; collections: number; purchases: number; payments: number }>();

    for (const tx of txs) {
      const amt = parseFloat(tx.amount);
      switch (tx.txType) {
        case "sale": totalSales += amt; break;
        case "collection": totalCollections += amt; break;
        case "purchase": totalPurchases += amt; break;
        case "payment": totalPayments += amt; break;
      }
      const dateStr = tx.txDate;
      if (!dailyMap.has(dateStr)) dailyMap.set(dateStr, { sales: 0, collections: 0, purchases: 0, payments: 0 });
      const day = dailyMap.get(dateStr)!;
      switch (tx.txType) {
        case "sale": day.sales += amt; break;
        case "collection": day.collections += amt; break;
        case "purchase": day.purchases += amt; break;
        case "payment": day.payments += amt; break;
      }
    }

    const dailyBreakdown = Array.from(dailyMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, d]) => ({
        date,
        sales: d.sales.toFixed(2),
        collections: d.collections.toFixed(2),
        purchases: d.purchases.toFixed(2),
        payments: d.payments.toFixed(2),
      }));

    return {
      totalSales: totalSales.toFixed(2),
      totalCollections: totalCollections.toFixed(2),
      totalPurchases: totalPurchases.toFixed(2),
      totalPayments: totalPayments.toFixed(2),
      dailyBreakdown,
      transactions: txs,
    };
  }

  async deleteCounterparty(id: string): Promise<void> {
    const txRows = await db.select({ id: transactions.id }).from(transactions).where(eq(transactions.counterpartyId, id));
    for (const tx of txRows) {
      await db.delete(transactionItems).where(eq(transactionItems.transactionId, tx.id));
    }
    await db.delete(transactions).where(eq(transactions.counterpartyId, id));
    await db.delete(counterparties).where(eq(counterparties.id, id));
  }

  async getProducts(): Promise<Product[]> {
    return db.select().from(products).orderBy(products.name);
  }

  async findOrCreateProduct(name: string, unit: string): Promise<Product> {
    const normalizedName = name.trim().toLowerCase();
    const existing = await db.select().from(products)
      .where(sql`lower(trim(${products.name})) = ${normalizedName}`);
    if (existing.length > 0) {
      const match = existing[0];
      if (!match.isActive) {
        const [updated] = await db.update(products).set({ isActive: true }).where(eq(products.id, match.id)).returning();
        return updated;
      }
      return match;
    }
    const [created] = await db.insert(products).values({ name: name.trim(), unit: unit as any }).returning();
    return created;
  }

  async getProductsWithStock(): Promise<ProductWithStock[]> {
    const result = await db.execute(sql`
      SELECT p.*,
        (
          COALESCE(
            (SELECT SUM(CASE
              WHEN t.tx_type IN ('purchase') THEN ti.quantity
              WHEN t.tx_type IN ('sale') THEN -ti.quantity
              ELSE 0
            END)
            FROM transaction_items ti
            JOIN transactions t ON t.id = ti.transaction_id
            WHERE ti.product_id = p.id
            ), 0
          )
          +
          COALESCE(
            (SELECT SUM(sa.quantity)
            FROM stock_adjustments sa
            WHERE sa.product_id = p.id
            ), 0
          )
        ) as current_stock
      FROM products p
      WHERE p.is_active = true
      ORDER BY p.name
    `);
    return result.rows.map((r: any) => ({
      ...r,
      isActive: r.is_active,
      createdAt: r.created_at,
      currentStock: String(r.current_stock),
    })) as ProductWithStock[];
  }

  async createProduct(data: InsertProduct): Promise<Product> {
    const [created] = await db.insert(products).values(data).returning();
    return created;
  }

  async updateProduct(id: string, data: Partial<InsertProduct>): Promise<Product> {
    const [updated] = await db.update(products).set(data).where(eq(products.id, id)).returning();
    if (!updated) throw new Error("Ürün bulunamadı");
    return updated;
  }

  async deleteProduct(id: string): Promise<void> {
    const refs = await db.select({ id: transactionItems.id }).from(transactionItems).where(eq(transactionItems.productId, id)).limit(1);
    if (refs.length > 0) {
      throw new Error("Bu ürüne ait işlem kaydı var, silinemez. Pasif yapabilirsiniz.");
    }
    await db.delete(stockAdjustments).where(eq(stockAdjustments.productId, id));
    await db.delete(products).where(eq(products.id, id));
  }

  async createTransactionWithItems(
    data: InsertTransaction,
    items: { productId: string; quantity: string; unitPrice?: string }[]
  ): Promise<Transaction> {
    const [tx] = await db.insert(transactions).values(data).returning();

    if (items.length > 0) {
      const itemValues = items.map(item => ({
        transactionId: tx.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice || null,
      }));
      await db.insert(transactionItems).values(itemValues);
    }

    return tx;
  }

  async getTransactionItems(transactionId: string): Promise<TransactionItemWithProduct[]> {
    const result = await db.execute(sql`
      SELECT ti.*, p.name as product_name, p.unit as product_unit
      FROM transaction_items ti
      JOIN products p ON p.id = ti.product_id
      WHERE ti.transaction_id = ${transactionId}
      ORDER BY ti.created_at
    `);
    return result.rows.map((r: any) => ({
      ...r,
      transactionId: r.transaction_id,
      productId: r.product_id,
      unitPrice: r.unit_price,
      createdAt: r.created_at,
      productName: r.product_name,
      productUnit: r.product_unit,
    })) as TransactionItemWithProduct[];
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
  async createStockAdjustment(data: InsertStockAdjustment): Promise<StockAdjustment> {
    const [created] = await db.insert(stockAdjustments).values(data).returning();
    return created;
  }

  async getChecksByCounterparty(counterpartyId: string): Promise<CheckNote[]> {
    const rows = await db
      .select()
      .from(checksNotes)
      .where(eq(checksNotes.counterpartyId, counterpartyId))
      .orderBy(desc(checksNotes.dueDate));
    return rows;
  }

  async createCheckNote(data: InsertCheckNote): Promise<CheckNote> {
    const [created] = await db.insert(checksNotes).values(data).returning();
    return created;
  }

  async createCheckNoteWithTransaction(data: InsertCheckNote, transactionId: string): Promise<CheckNote> {
    const [created] = await db.insert(checksNotes).values({ ...data, transactionId }).returning();
    return created;
  }

  async updateCheckStatus(id: string, status: "paid" | "bounced"): Promise<CheckNote> {
    const [updated] = await db
      .update(checksNotes)
      .set({ status, updatedAt: new Date() })
      .where(eq(checksNotes.id, id))
      .returning();
    return updated;
  }

  async bounceCheckNote(id: string): Promise<CheckNote> {
    const [check] = await db.select().from(checksNotes).where(eq(checksNotes.id, id));
    if (!check) throw new Error("Çek/senet bulunamadı");
    if (!check.transactionId) throw new Error("Bu çek/senetle ilişkili işlem bulunamadı");

    const [originalTx] = await db.select().from(transactions).where(eq(transactions.id, check.transactionId));
    if (!originalTx) throw new Error("İlişkili işlem bulunamadı");

    const reverseTypeMap: Record<string, string> = {
      sale: "collection",
      collection: "sale",
      purchase: "payment",
      payment: "purchase",
    };
    const reverseTxType = reverseTypeMap[originalTx.txType] || "sale";
    const kindLabel = check.kind === "check" ? "Çek" : "Senet";
    const description = `Karşılıksız ${kindLabel} (İptal)`;

    const [reverseTx] = await db.insert(transactions).values({
      counterpartyId: check.counterpartyId,
      txType: reverseTxType,
      amount: originalTx.amount,
      description,
      txDate: new Date().toISOString().split('T')[0],
      reversedOf: check.transactionId,
    }).returning();

    const [updated] = await db
      .update(checksNotes)
      .set({ status: "bounced", reversalTransactionId: reverseTx.id, updatedAt: new Date() })
      .where(eq(checksNotes.id, id))
      .returning();
    return updated;
  }

  async deleteCheckNote(id: string): Promise<void> {
    const [check] = await db.select().from(checksNotes).where(eq(checksNotes.id, id));
    if (!check) throw new Error("Çek/senet bulunamadı");

    const txIdsToDelete: string[] = [];
    if (check.reversalTransactionId) txIdsToDelete.push(check.reversalTransactionId);
    if (check.transactionId) txIdsToDelete.push(check.transactionId);

    await db.delete(checksNotes).where(eq(checksNotes.id, id));

    for (const txId of txIdsToDelete) {
      await db.delete(transactions).where(eq(transactions.id, txId));
    }
  }

  async getUpcomingChecks(daysBefore: number = 7): Promise<CheckNoteWithCounterparty[]> {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + daysBefore);
    const pastDate = new Date();
    pastDate.setDate(today.getDate() - 30);
    const todayStr = today.toISOString().split('T')[0];
    const futureStr = futureDate.toISOString().split('T')[0];
    const pastStr = pastDate.toISOString().split('T')[0];

    const rows = await db
      .select({
        id: checksNotes.id,
        counterpartyId: checksNotes.counterpartyId,
        kind: checksNotes.kind,
        direction: checksNotes.direction,
        amount: checksNotes.amount,
        dueDate: checksNotes.dueDate,
        status: checksNotes.status,
        notes: checksNotes.notes,
        transactionId: checksNotes.transactionId,
        reversalTransactionId: checksNotes.reversalTransactionId,
        createdAt: checksNotes.createdAt,
        updatedAt: checksNotes.updatedAt,
        counterpartyName: counterparties.name,
        counterpartyType: counterparties.type,
      })
      .from(checksNotes)
      .innerJoin(counterparties, eq(checksNotes.counterpartyId, counterparties.id))
      .where(
        and(
          eq(checksNotes.status, "pending"),
          gte(checksNotes.dueDate, pastStr),
          lte(checksNotes.dueDate, futureStr)
        )
      )
      .orderBy(checksNotes.dueDate);
    return rows;
  }

  async resetAllData(): Promise<void> {
    await db.execute(sql`TRUNCATE TABLE checks_notes, stock_adjustments, transaction_items, transactions, counterparties, products CASCADE`);
  }
}

export const storage = new DatabaseStorage();

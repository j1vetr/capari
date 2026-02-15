import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { insertCounterpartySchema, insertTransactionSchema, insertProductSchema, insertCheckNoteSchema } from "@shared/schema";
import { z } from "zod";
import { generateCounterpartyPDF, generateDailyReportPDF, generateAllCounterpartiesPDF } from "./pdf";

const APP_PASSWORD = process.env.LOGIN_PASSWORD || "capari2024";

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session?.authenticated) {
    return next();
  }
  res.status(401).json({ message: "Giriş gerekli" });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/auth/login", (req, res) => {
    const { password } = req.body;
    if (password === APP_PASSWORD) {
      req.session.authenticated = true;
      res.json({ ok: true });
    } else {
      res.status(401).json({ message: "Şifre yanlış" });
    }
  });

  app.get("/api/auth/check", (req, res) => {
    res.json({ authenticated: !!req.session?.authenticated });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  const { randomBytes } = await import("crypto");
  const tempPdfStore = new Map<string, { buffer: Buffer; expires: number; filename?: string }>();

  setInterval(() => {
    const now = Date.now();
    tempPdfStore.forEach((val, key) => {
      if (now > val.expires) tempPdfStore.delete(key);
    });
  }, 60000);

  const serveTempPdf = (req: any, res: any) => {
    const entry = tempPdfStore.get(req.params.token);
    if (!entry || Date.now() > entry.expires) {
      tempPdfStore.delete(req.params.token);
      return res.status(404).json({ message: "PDF bulunamadi veya suresi dolmus" });
    }
    const fname = entry.filename || "capari-ekstre.pdf";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fname)}"; filename*=UTF-8''${encodeURIComponent(fname)}`);
    res.send(entry.buffer);
    tempPdfStore.delete(req.params.token);
  };
  app.get("/api/temp-pdf/:token/:filename", serveTempPdf);
  app.get("/api/temp-pdf/:token", serveTempPdf);

  app.use("/api", requireAuth);

  app.get("/api/dashboard", async (_req, res) => {
    try {
      const summary = await storage.getDashboardSummary();
      res.json(summary);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/counterparties", async (_req, res) => {
    try {
      const list = await storage.getCounterparties();
      res.json(list);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/counterparties/:id", async (req, res) => {
    try {
      const party = await storage.getCounterparty(req.params.id);
      if (!party) return res.status(404).json({ message: "Bulunamadı" });
      res.json(party);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/counterparties/:id/bulk-transactions", async (req, res) => {
    try {
      const party = await storage.getCounterparty(req.params.id);
      if (!party) return res.status(404).json({ message: "Cari bulunamadı" });

      const schema = z.object({
        transactions: z.array(z.object({
          amount: z.number().positive(),
          direction: z.enum(["aldik", "verdik"]),
          txDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          description: z.string().optional(),
        })).min(1).max(500),
      });
      const { transactions: items } = schema.parse(req.body);
      let added = 0;
      let errors = 0;

      for (const item of items) {
        try {
          let txType: "sale" | "collection" | "purchase" | "payment";
          if (party.type === "customer") {
            txType = item.direction === "verdik" ? "sale" : "collection";
          } else {
            txType = item.direction === "aldik" ? "purchase" : "payment";
          }
          const desc = item.description || (item.direction === "aldik" ? "Eski defter - aldık" : "Eski defter - verdik");
          await storage.createTransaction({
            counterpartyId: party.id,
            txType,
            amount: item.amount.toFixed(2),
            description: desc,
            txDate: item.txDate || new Date().toISOString().split("T")[0],
          });
          added++;
        } catch (e: any) {
          errors++;
        }
      }
      res.json({ summary: { added, errors, total: items.length } });
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0]?.message || "Geçersiz veri" });
      }
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/counterparties", async (req, res) => {
    try {
      const parsed = insertCounterpartySchema.parse(req.body);
      if (!parsed.name?.trim()) return res.status(400).json({ message: "İsim gerekli" });
      const created = await storage.createCounterparty(parsed);
      res.status(201).json(created);
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0]?.message || "Geçersiz veri" });
      }
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/counterparties/:id", async (req, res) => {
    try {
      const party = await storage.getCounterparty(req.params.id);
      if (!party) return res.status(404).json({ message: "Cari bulunamadı" });
      await storage.deleteCounterparty(req.params.id);
      res.json({ message: "Cari silindi" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/counterparties/:id/transactions", async (req, res) => {
    try {
      const { startDate, endDate, limit, offset } = req.query;
      const result = await storage.getTransactionsByCounterparty(req.params.id, {
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/counterparties/:id/pdf", async (req, res) => {
    try {
      const party = await storage.getCounterparty(req.params.id);
      if (!party) return res.status(404).json({ message: "Bulunamadı" });
      const { transactions: txs } = await storage.getTransactionsByCounterparty(req.params.id);
      const checks = await storage.getChecksByCounterparty(req.params.id);

      const safeName = party.name.replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}-ekstre.pdf"; filename*=UTF-8''${encodeURIComponent(party.name)}-ekstre.pdf`);
      const doc = generateCounterpartyPDF(party, txs, checks);
      doc.pipe(res);
      doc.end();
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/transactions", async (req, res) => {
    try {
      const { purchaseItems, ...txData } = req.body;
      const parsed = insertTransactionSchema.parse(txData);
      const amount = parseFloat(parsed.amount);
      if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: "Tutar sıfırdan büyük olmalı" });
      }

      const purchaseItemSchema = z.array(z.object({
        productName: z.string().min(1),
        productUnit: z.enum(["kg", "kasa", "adet"]),
        quantity: z.string(),
        unitPrice: z.string().optional(),
      })).optional();

      if (parsed.txType === "sale" || parsed.txType === "purchase") {
        const parsedPurchaseItems = purchaseItemSchema.parse(purchaseItems) || [];
        if (parsedPurchaseItems.length === 0) {
          return res.status(400).json({ message: "En az bir ürün girmelisiniz" });
        }
        const resolvedItems: { productId: string; quantity: string; unitPrice?: string }[] = [];
        for (const pi of parsedPurchaseItems) {
          const product = await storage.findOrCreateProduct(pi.productName, pi.productUnit);
          resolvedItems.push({
            productId: product.id,
            quantity: pi.quantity,
            unitPrice: pi.unitPrice,
          });
        }
        const created = await storage.createTransactionWithItems(parsed, resolvedItems);
        res.status(201).json(created);
      } else {
        const created = await storage.createTransaction(parsed);
        res.status(201).json(created);
      }
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0]?.message || "Geçersiz veri" });
      }
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/transactions/:id/reverse", async (req, res) => {
    try {
      const reversed = await storage.reverseTransaction(req.params.id);
      res.status(201).json(reversed);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/transactions/:id", async (req, res) => {
    try {
      await storage.deleteTransaction(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/recent-transactions", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
      const txs = await storage.getRecentTransactions(limit);
      res.json(txs);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/stats", async (_req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/counterparties/:id", async (req, res) => {
    try {
      const updateSchema = z.object({
        name: z.string().min(1).optional(),
        phone: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        paymentDueDay: z.number().int().min(1).max(31).nullable().optional(),
      }).refine(data => Object.keys(data).length > 0, { message: "En az bir alan gerekli" });
      const parsed = updateSchema.parse(req.body);
      const updated = await storage.updateCounterparty(req.params.id, parsed);
      res.json(updated);
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0]?.message || "Geçersiz veri" });
      }
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/reports/daily/:date", async (req, res) => {
    try {
      const report = await storage.getDailyReport(req.params.date);
      res.json(report);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/reports/daily/:date/pdf", async (req, res) => {
    try {
      const report = await storage.getDailyReport(req.params.date);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="rapor-${req.params.date}.pdf"`);
      const doc = generateDailyReportPDF(req.params.date, report);
      doc.pipe(res);
      doc.end();
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/export/backup/json", async (_req, res) => {
    try {
      const parties = await storage.getCounterparties();
      const allTxs = await storage.getAllTransactions();
      const backup = {
        exportDate: new Date().toISOString(),
        counterparties: parties,
        transactions: allTxs,
      };
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename=capari-yedek-${new Date().toISOString().split("T")[0]}.json`);
      res.send(JSON.stringify(backup, null, 2));
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/export/counterparties/csv", async (_req, res) => {
    try {
      const parties = await storage.getCounterparties();
      const header = "Ad,Tip,Telefon,Bakiye,Faturalı,Vergi No,Vergi Dairesi,Ödeme Günü\n";
      const rows = parties.map(p =>
        `"${p.name}","${p.type === "customer" ? "Müşteri" : "Tedarikçi"}","${p.phone || ""}","${p.balance}","${p.invoiced ? "Evet" : "Hayır"}","${p.taxNumber || ""}","${p.taxOffice || ""}","${p.paymentDueDay || ""}"`
      ).join("\n");
      const bom = "\uFEFF";
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=cariler.csv");
      res.send(bom + header + rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/export/transactions/csv", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 1000, 5000);
      const txs = await storage.getRecentTransactions(limit);
      const header = "Tarih,Cari,Tip,Tutar,Açıklama\n";
      const txTypeMap: Record<string, string> = { sale: "Satış", collection: "Tahsilat", purchase: "Alım", payment: "Ödeme" };
      const rows = txs.map(tx =>
        `"${tx.txDate}","${tx.counterpartyName}","${txTypeMap[tx.txType] || tx.txType}","${tx.amount}","${(tx.description || "").replace(/"/g, '""')}"`
      ).join("\n");
      const bom = "\uFEFF";
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=islemler.csv");
      res.send(bom + header + rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/reports/monthly/:year/:month", async (req, res) => {
    try {
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);
      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        return res.status(400).json({ message: "Geçersiz tarih" });
      }
      const report = await storage.getMonthlyReport(year, month);
      res.json(report);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/products", async (_req, res) => {
    try {
      const list = await storage.getProducts();
      res.json(list);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/stock", async (_req, res) => {
    try {
      const list = await storage.getProductsWithStock();
      res.json(list);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/stock/:productId/movements", async (req, res) => {
    try {
      const productId = req.params.productId;
      const { pool } = await import("./db");
      const result = await pool.query(
        `SELECT 
          ti.quantity, ti.unit_price, 
          t.tx_type, t.tx_date, t.description, t.reversed_of,
          c.name as counterparty_name, c.type as counterparty_type
        FROM transaction_items ti
        JOIN transactions t ON ti.transaction_id = t.id
        JOIN counterparties c ON t.counterparty_id = c.id
        WHERE ti.product_id = $1
        ORDER BY t.tx_date DESC, t.created_at DESC`,
        [productId]
      );
      const adjustments = await pool.query(
        `SELECT quantity, notes, created_at FROM stock_adjustments WHERE product_id = $1 ORDER BY created_at DESC`,
        [productId]
      );
      res.json({
        transactions: result.rows.map(r => ({
          quantity: r.quantity,
          unitPrice: r.unit_price,
          txType: r.tx_type,
          txDate: r.tx_date,
          description: r.description,
          reversedOf: r.reversed_of,
          counterpartyName: r.counterparty_name,
          counterpartyType: r.counterparty_type,
        })),
        adjustments: adjustments.rows.map(r => ({
          quantity: r.quantity,
          notes: r.notes,
          createdAt: r.created_at,
        })),
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/products/bulk", async (req, res) => {
    try {
      const schema = z.object({
        products: z.array(z.object({
          name: z.string().min(1),
          unit: z.enum(["kg", "kasa", "adet"]),
        })).min(1).max(200),
      });
      const { products: items } = schema.parse(req.body);
      const results: { name: string; status: "created" | "exists" | "error"; message?: string }[] = [];
      for (const item of items) {
        try {
          const existing = (await storage.getProducts()).find(
            p => p.name.toLowerCase().trim() === item.name.toLowerCase().trim()
          );
          if (existing) {
            results.push({ name: item.name, status: "exists" });
          } else {
            await storage.createProduct({ name: item.name.trim(), unit: item.unit });
            results.push({ name: item.name, status: "created" });
          }
        } catch (e: any) {
          results.push({ name: item.name, status: "error", message: e.message });
        }
      }
      const created = results.filter(r => r.status === "created").length;
      const existed = results.filter(r => r.status === "exists").length;
      const errors = results.filter(r => r.status === "error").length;
      res.json({ results, summary: { created, existed, errors, total: items.length } });
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0]?.message || "Geçersiz veri" });
      }
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const parsed = insertProductSchema.parse(req.body);
      if (!parsed.name?.trim()) return res.status(400).json({ message: "Ürün adı gerekli" });
      const created = await storage.createProduct(parsed);
      res.status(201).json(created);
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0]?.message || "Geçersiz veri" });
      }
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/stock/adjust", async (req, res) => {
    try {
      const schema = z.object({
        productId: z.string().uuid(),
        quantity: z.string(),
        notes: z.string().optional(),
      });
      const parsed = schema.parse(req.body);
      const qty = parseFloat(parsed.quantity);
      if (isNaN(qty) || qty === 0) {
        return res.status(400).json({ message: "Miktar sıfırdan farklı olmalı" });
      }
      const adjustment = await storage.createStockAdjustment({
        productId: parsed.productId,
        quantity: parsed.quantity,
        notes: parsed.notes || null,
      });
      res.status(201).json(adjustment);
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0]?.message || "Geçersiz veri" });
      }
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      await storage.deleteProduct(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/products/:id", async (req, res) => {
    try {
      const updateSchema = z.object({
        name: z.string().min(1).optional(),
        unit: z.enum(["kg", "kasa", "adet"]).optional(),
        isActive: z.boolean().optional(),
      });
      const parsed = updateSchema.parse(req.body);
      const updated = await storage.updateProduct(req.params.id, parsed);
      res.json(updated);
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0]?.message || "Geçersiz veri" });
      }
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/transactions/:id/items", async (req, res) => {
    try {
      const items = await storage.getTransactionItems(req.params.id);
      res.json(items);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/whatsapp/send", async (req, res) => {
    try {
      const schema = z.object({
        receiver: z.string().min(10),
        message: z.string().min(1),
      });
      const { receiver, message } = schema.parse(req.body);
      const apiKey = process.env.WPILETI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "WhatsApp API anahtarı tanımlı değil" });
      }

      let phone = receiver.replace(/\D/g, "");
      if (phone.startsWith("0")) {
        phone = phone.substring(1);
      }
      const formattedPhone = phone.startsWith("90") ? phone : `90${phone}`;

      const response = await fetch("https://my.wpileti.com/api/send-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "*/*",
        },
        body: JSON.stringify({
          api_key: apiKey,
          receiver: formattedPhone,
          data: { message },
        }),
      });

      let result: any;
      try {
        result = await response.json();
      } catch {
        const text = await response.text().catch(() => "");
        result = { message: text || "Bilinmeyen hata" };
      }

      if (!response.ok) {
        return res.status(response.status).json({ success: false, message: result?.message || "Mesaj gönderilemedi" });
      }
      res.json({ success: true, result });
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0]?.message || "Geçersiz veri" });
      }
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/export/counterparties/pdf", requireAuth, async (req, res) => {
    try {
      const counterparties = await storage.getCounterparties();
      const transactionsByCounterparty = new Map<string, any[]>();
      for (const party of counterparties) {
        const { transactions } = await storage.getTransactionsByCounterparty(party.id, { limit: 10 });
        transactionsByCounterparty.set(party.id, transactions);
      }
      const doc = generateAllCounterpartiesPDF(counterparties, transactionsByCounterparty);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="capari-cari-rapor-${new Date().toISOString().split("T")[0]}.pdf"`);
      doc.pipe(res);
      doc.end();
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/whatsapp/send-pdf", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        receiver: z.string().min(10),
        counterpartyId: z.string().uuid(),
        message: z.string().optional(),
      });
      const { receiver, counterpartyId, message } = schema.parse(req.body);
      const apiKey = process.env.WPILETI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "WhatsApp API anahtari tanimli degil" });
      }

      let phone = receiver.replace(/\D/g, "");
      if (phone.startsWith("0")) phone = phone.substring(1);
      const formattedPhone = phone.startsWith("90") ? phone : `90${phone}`;

      const party = await storage.getCounterparty(counterpartyId);
      if (!party) {
        return res.status(404).json({ message: "Cari bulunamadi" });
      }
      const { transactions } = await storage.getTransactionsByCounterparty(counterpartyId, {});
      const whatsappChecks = await storage.getChecksByCounterparty(counterpartyId);
      const doc = generateCounterpartyPDF(party, transactions, whatsappChecks);

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      await new Promise<void>((resolve, reject) => {
        doc.on("end", resolve);
        doc.on("error", reject);
        doc.end();
      });
      const pdfBuffer = Buffer.concat(chunks);

      const token = randomBytes(32).toString("hex");
      const trMap: Record<string, string> = { "ç": "c", "Ç": "C", "ğ": "g", "Ğ": "G", "ı": "i", "İ": "I", "ö": "o", "Ö": "O", "ş": "s", "Ş": "S", "ü": "u", "Ü": "U" };
      const safeName = party.name.replace(/[çÇğĞıİöÖşŞüÜ]/g, c => trMap[c] || c).replace(/[^a-zA-Z0-9 _-]/g, "").trim().replace(/\s+/g, "-");
      const pdfFilename = `${safeName}-Ekstre.pdf`;
      tempPdfStore.set(token, { buffer: pdfBuffer, expires: Date.now() + 3 * 60 * 1000, filename: pdfFilename });

      const host = req.headers.host || "localhost:5000";
      const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
      const pdfUrl = `${protocol}://${host}/api/temp-pdf/${token}/${pdfFilename}`;

      const response = await fetch("https://my.wpileti.com/api/send-media", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "*/*",
        },
        body: JSON.stringify({
          api_key: apiKey,
          receiver: formattedPhone,
          data: {
            url: pdfUrl,
            media_type: "file",
            filename: pdfFilename,
            caption: message || `${party.name} - Cari Hesap Ekstre`,
          },
        }),
      });

      let result: any;
      try {
        result = await response.json();
      } catch {
        const text = await response.text().catch(() => "");
        result = { message: text || "Bilinmeyen hata" };
      }

      if (!response.ok) {
        return res.status(response.status).json({ success: false, message: result?.message || "PDF gonderilemedi" });
      }
      res.json({ success: true, result });
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ message: e.errors[0]?.message || "Gecersiz veri" });
      }
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/fix-customer-directions", requireAuth, async (req, res) => {
    try {
      const { confirm } = req.body;
      if (confirm !== "DUZELT") {
        return res.status(400).json({ message: "Onay kodu gerekli: DUZELT" });
      }
      const allParties = await storage.getCounterparties();
      const customerIds = allParties.filter(p => p.type === "customer").map(p => p.id);
      if (customerIds.length === 0) {
        return res.json({ ok: true, fixed: 0, message: "Müşteri bulunamadı" });
      }
      const { pool } = await import("./db");
      const result = await pool.query(
        `UPDATE transactions 
        SET tx_type = CASE 
          WHEN tx_type = 'sale' THEN 'collection'
          WHEN tx_type = 'collection' THEN 'sale'
        END
        WHERE counterparty_id = ANY($1::text[])
        AND tx_type IN ('sale', 'collection')
        AND reversed_of IS NULL`,
        [customerIds]
      );
      const fixed = result.rowCount || 0;
      res.json({ ok: true, fixed, message: `${fixed} müşteri işlemi düzeltildi (satış↔tahsilat)` });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/counterparties/:id/checks", requireAuth, async (req, res) => {
    try {
      const checks = await storage.getChecksByCounterparty(req.params.id);
      res.json(checks);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/checks", requireAuth, async (req, res) => {
    try {
      const parsed = insertCheckNoteSchema.parse(req.body);
      const counterparty = await storage.getCounterparty(parsed.counterpartyId);
      if (!counterparty) {
        return res.status(404).json({ message: "Cari bulunamadı" });
      }

      const txType = parsed.direction === "received" ? "collection" : "payment";
      const kindLabel = parsed.kind === "check" ? "Çek" : "Senet";
      const dirLabel = parsed.direction === "received" ? "Alınan" : "Verilen";
      const description = `${dirLabel} ${kindLabel}`;

      const tx = await storage.createTransaction({
        counterpartyId: parsed.counterpartyId,
        txType,
        amount: parsed.amount,
        description,
        txDate: parsed.dueDate,
      });

      const check = await storage.createCheckNoteWithTransaction(parsed, tx.id);
      res.json(check);
    } catch (e: any) {
      if (e.name === "ZodError") {
        return res.status(400).json({ message: "Geçersiz veri", errors: e.errors });
      }
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/checks/:id/status", requireAuth, async (req, res) => {
    try {
      const { status } = req.body;
      if (!["paid", "bounced"].includes(status)) {
        return res.status(400).json({ message: "Geçersiz durum" });
      }

      if (status === "bounced") {
        const updated = await storage.bounceCheckNote(req.params.id);
        res.json(updated);
      } else {
        const updated = await storage.updateCheckStatus(req.params.id, status);
        res.json(updated);
      }
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/checks/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteCheckNote(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/checks/upcoming", requireAuth, async (req, res) => {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 7;
      const checks = await storage.getUpcomingChecks(days);
      res.json(checks);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/reset", requireAuth, async (req, res) => {
    try {
      const { confirm } = req.body;
      if (confirm !== "SIFIRLA") {
        return res.status(400).json({ message: "Onay kodu gerekli: SIFIRLA" });
      }
      await storage.resetAllData();
      res.json({ ok: true, message: "Tum veriler silindi" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  return httpServer;
}

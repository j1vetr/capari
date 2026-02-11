import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCounterpartySchema, insertTransactionSchema, insertProductSchema } from "@shared/schema";
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

  app.get("/api/temp-pdf/:token", (req, res) => {
    const entry = tempPdfStore.get(req.params.token);
    if (!entry || Date.now() > entry.expires) {
      tempPdfStore.delete(req.params.token);
      return res.status(404).json({ message: "PDF bulunamadi veya suresi dolmus" });
    }
    const fname = entry.filename || "capari-ekstre.pdf";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
    res.send(entry.buffer);
    tempPdfStore.delete(req.params.token);
  });

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

      const safeName = party.name.replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}-ekstre.pdf"; filename*=UTF-8''${encodeURIComponent(party.name)}-ekstre.pdf`);
      const doc = generateCounterpartyPDF(party, txs);
      doc.pipe(res);
      doc.end();
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/transactions", async (req, res) => {
    try {
      const { items, ...txData } = req.body;
      const parsed = insertTransactionSchema.parse(txData);
      const amount = parseFloat(parsed.amount);
      if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: "Tutar sıfırdan büyük olmalı" });
      }

      const itemSchema = z.array(z.object({
        productId: z.string().uuid(),
        quantity: z.string(),
        unitPrice: z.string().optional(),
      })).optional();

      const parsedItems = itemSchema.parse(items) || [];

      if ((parsed.txType === "sale" || parsed.txType === "purchase") && parsedItems.length > 0) {
        if (parsed.txType === "sale") {
          const stockData = await storage.getProductsWithStock();
          for (const item of parsedItems) {
            const product = stockData.find(p => p.id === item.productId);
            if (product && parseFloat(product.currentStock) < parseFloat(item.quantity)) {
              return res.status(400).json({
                message: `${product.name} için yeterli stok yok. Mevcut: ${product.currentStock} ${product.unit}`
              });
            }
          }
        }
        const created = await storage.createTransactionWithItems(parsed, parsedItems);
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
      const doc = generateCounterpartyPDF(party, transactions);

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      await new Promise<void>((resolve, reject) => {
        doc.on("end", resolve);
        doc.on("error", reject);
        doc.end();
      });
      const pdfBuffer = Buffer.concat(chunks);

      const token = randomBytes(32).toString("hex");
      const safeName = party.name.replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
      tempPdfStore.set(token, { buffer: pdfBuffer, expires: Date.now() + 3 * 60 * 1000, filename: `${safeName}-Ekstre.pdf` });

      const host = req.headers.host || "localhost:5000";
      const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
      const pdfUrl = `${protocol}://${host}/api/temp-pdf/${token}`;

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

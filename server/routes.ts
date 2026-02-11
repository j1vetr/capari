import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCounterpartySchema, insertTransactionSchema } from "@shared/schema";
import { z } from "zod";
import { generateCounterpartyPDF, generateDailyReportPDF } from "./pdf";

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
      const balance = parseFloat(party.balance);
      if (balance !== 0) {
        return res.status(400).json({ message: "Bakiyesi sıfır olmayan cari silinemez. Önce bakiyeyi sıfırlayın." });
      }
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

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${party.name}-ekstre.pdf"`);
      const doc = generateCounterpartyPDF(party, txs);
      doc.pipe(res);
      doc.end();
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/transactions", async (req, res) => {
    try {
      const parsed = insertTransactionSchema.parse(req.body);
      const amount = parseFloat(parsed.amount);
      if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: "Tutar sıfırdan büyük olmalı" });
      }
      const created = await storage.createTransaction(parsed);
      res.status(201).json(created);
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

  return httpServer;
}

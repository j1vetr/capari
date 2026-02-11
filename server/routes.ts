import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCounterpartySchema, insertTransactionSchema } from "@shared/schema";
import { z } from "zod";
import { generateCounterpartyPDF, generateDailyReportPDF } from "./pdf";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

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

  app.get("/api/counterparties/:id/transactions", async (req, res) => {
    try {
      const txs = await storage.getTransactionsByCounterparty(req.params.id);
      res.json(txs);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/counterparties/:id/pdf", async (req, res) => {
    try {
      const party = await storage.getCounterparty(req.params.id);
      if (!party) return res.status(404).json({ message: "Bulunamadı" });
      const txs = await storage.getTransactionsByCounterparty(req.params.id);

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
        paymentDueDay: z.number().int().min(1).max(31).nullable(),
      });
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

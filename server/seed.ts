import { db } from "./db";
import { counterparties, transactions } from "@shared/schema";
import { sql } from "drizzle-orm";

export async function seedDatabase() {
  const existing = await db.select().from(counterparties).limit(1);
  if (existing.length > 0) return;

  console.log("Seeding database...");

  const customers = await db.insert(counterparties).values([
    { type: "customer", name: "Deniz Restaurant", phone: "05321234567", notes: "Kadıköy" },
    { type: "customer", name: "Mavi Balık Evi", phone: "05339876543", notes: "Beşiktaş" },
    { type: "customer", name: "Liman Cafe", phone: "05447654321" },
    { type: "customer", name: "Sahil Lokantası", phone: "05551112233" },
  ]).returning();

  const suppliers = await db.insert(counterparties).values([
    { type: "supplier", name: "Karadeniz Su Ürünleri", phone: "05362223344", notes: "Trabzon" },
    { type: "supplier", name: "Ege Balıkçılık", phone: "05423334455", notes: "İzmir" },
    { type: "supplier", name: "Marmara Toptancı", phone: "05384445566" },
  ]).returning();

  const today = new Date();
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }

  const txData = [
    { counterpartyId: customers[0].id, txType: "sale" as const, amount: "2500.00", description: "Levrek + Çipura", txDate: dates[0] },
    { counterpartyId: customers[0].id, txType: "sale" as const, amount: "1800.00", description: "Hamsi kasası", txDate: dates[1] },
    { counterpartyId: customers[1].id, txType: "sale" as const, amount: "3200.00", description: "Karışık balık", txDate: dates[1] },
    { counterpartyId: customers[0].id, txType: "collection" as const, amount: "2500.00", description: "Nakit ödeme", txDate: dates[2] },
    { counterpartyId: customers[2].id, txType: "sale" as const, amount: "1500.00", description: "Mezgit", txDate: dates[2] },
    { counterpartyId: customers[1].id, txType: "sale" as const, amount: "4100.00", description: "Lüfer + Palamut", txDate: dates[3] },
    { counterpartyId: customers[3].id, txType: "sale" as const, amount: "2200.00", description: "Alabalık", txDate: dates[3] },
    { counterpartyId: customers[1].id, txType: "collection" as const, amount: "3200.00", description: "Havale", txDate: dates[4] },
    { counterpartyId: customers[2].id, txType: "sale" as const, amount: "1900.00", description: "Somon fileto", txDate: dates[4] },
    { counterpartyId: customers[0].id, txType: "sale" as const, amount: "2800.00", description: "Karides + Kalamar", txDate: dates[5] },
    { counterpartyId: customers[3].id, txType: "collection" as const, amount: "2200.00", description: "POS ile ödeme", txDate: dates[5] },
    { counterpartyId: customers[1].id, txType: "sale" as const, amount: "3500.00", description: "Levrek fileto", txDate: dates[6] },
    { counterpartyId: customers[2].id, txType: "collection" as const, amount: "1500.00", description: "Nakit", txDate: dates[6] },

    { counterpartyId: suppliers[0].id, txType: "purchase" as const, amount: "8500.00", description: "Hamsi + Palamut alımı", txDate: dates[0] },
    { counterpartyId: suppliers[1].id, txType: "purchase" as const, amount: "6200.00", description: "Çipura + Levrek", txDate: dates[2] },
    { counterpartyId: suppliers[0].id, txType: "payment" as const, amount: "8500.00", description: "Havale", txDate: dates[3] },
    { counterpartyId: suppliers[2].id, txType: "purchase" as const, amount: "4800.00", description: "Somon kasası", txDate: dates[4] },
    { counterpartyId: suppliers[1].id, txType: "payment" as const, amount: "3000.00", description: "Nakit ödeme", txDate: dates[5] },
  ];

  await db.insert(transactions).values(txData);
  console.log("Seed data inserted successfully");
}

import PDFDocument from "pdfkit";
import type { CounterpartyWithBalance, Transaction, TransactionWithCounterparty } from "@shared/schema";

const TX_TYPE_LABELS: Record<string, string> = {
  sale: "Satış",
  collection: "Tahsilat",
  purchase: "Alım",
  payment: "Ödeme",
};

function formatCurrency(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return num.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " TL";
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("tr-TR");
}

export function generateCounterpartyPDF(
  party: CounterpartyWithBalance,
  transactions: Transaction[]
): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 40 });

  doc.fontSize(18).text("Çapari Balık Dağıtım", { align: "center" });
  doc.fontSize(10).text("Cari Ekstre", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(9).text(`Tarih: ${new Date().toLocaleDateString("tr-TR")}`, { align: "right" });
  doc.moveDown();

  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.5);

  doc.fontSize(12).text(`Firma: ${party.name}`);
  doc.fontSize(10).text(`Tür: ${party.type === "customer" ? "Müşteri" : "Tedarikçi"}`);
  if (party.phone) doc.text(`Telefon: ${party.phone}`);
  doc.moveDown(0.5);
  doc.fontSize(14).text(`Bakiye: ${formatCurrency(party.balance)}`, { underline: true });
  doc.moveDown();

  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.5);

  doc.fontSize(10);
  const tableTop = doc.y;
  const col1 = 40, col2 = 120, col3 = 220, col4 = 370, col5 = 470;

  doc.font("Helvetica-Bold");
  doc.text("Tarih", col1, tableTop);
  doc.text("Tür", col2, tableTop);
  doc.text("Açıklama", col3, tableTop);
  doc.text("Tutar", col4, tableTop);
  doc.font("Helvetica");

  doc.moveDown();
  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.3);

  for (const tx of transactions) {
    if (doc.y > 750) {
      doc.addPage();
    }
    const y = doc.y;
    doc.text(formatDate(tx.txDate), col1, y);
    doc.text(TX_TYPE_LABELS[tx.txType] || tx.txType, col2, y);
    doc.text(tx.description || "-", col3, y, { width: 140 });
    doc.text(formatCurrency(tx.amount), col4, y);
    if (tx.reversedOf) {
      doc.text("(Düzeltme)", col5, y);
    }
    doc.moveDown(0.5);
  }

  return doc;
}

export function generateDailyReportPDF(
  date: string,
  report: {
    totalSales: string;
    totalCollections: string;
    totalPurchases: string;
    totalPayments: string;
    transactions: TransactionWithCounterparty[];
  }
): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 40 });

  doc.fontSize(18).text("Çapari Balık Dağıtım", { align: "center" });
  doc.fontSize(10).text("Günlük Rapor", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(12).text(`Tarih: ${formatDate(date)}`, { align: "center" });
  doc.moveDown();

  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.5);

  doc.fontSize(11);
  doc.text(`Toplam Satış: ${formatCurrency(report.totalSales)}`);
  doc.text(`Toplam Tahsilat: ${formatCurrency(report.totalCollections)}`);
  doc.text(`Toplam Alım: ${formatCurrency(report.totalPurchases)}`);
  doc.text(`Toplam Ödeme: ${formatCurrency(report.totalPayments)}`);
  doc.moveDown();

  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.5);

  doc.fontSize(10);
  const tableTop = doc.y;
  const col1 = 40, col2 = 180, col3 = 280, col4 = 380, col5 = 470;

  doc.font("Helvetica-Bold");
  doc.text("Firma", col1, tableTop);
  doc.text("Tür", col2, tableTop);
  doc.text("Açıklama", col3, tableTop);
  doc.text("Tutar", col4, tableTop);
  doc.font("Helvetica");

  doc.moveDown();
  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.3);

  for (const tx of report.transactions) {
    if (doc.y > 750) {
      doc.addPage();
    }
    const y = doc.y;
    doc.text(tx.counterpartyName || "", col1, y, { width: 130 });
    doc.text(TX_TYPE_LABELS[tx.txType] || tx.txType, col2, y);
    doc.text(tx.description || "-", col3, y, { width: 90 });
    doc.text(formatCurrency(tx.amount), col4, y);
    doc.moveDown(0.5);
  }

  return doc;
}

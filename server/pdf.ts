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

export function generateAllCounterpartiesPDF(
  counterparties: CounterpartyWithBalance[],
  transactionsByCounterparty: Map<string, Transaction[]>
): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const pageWidth = 515;
  const leftMargin = 40;
  const rightEdge = leftMargin + pageWidth;
  const today = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

  doc.fontSize(20).font("Helvetica-Bold").text("Capari Balik Dagitim", { align: "center" });
  doc.fontSize(11).font("Helvetica").text("Cari Hesap Raporu", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(9).text(`Rapor Tarihi: ${today}`, { align: "center" });
  doc.moveDown(0.5);

  doc.moveTo(leftMargin, doc.y).lineTo(rightEdge, doc.y).lineWidth(1.5).stroke();
  doc.moveDown(0.8);

  const customers = counterparties.filter(c => c.type === "customer");
  const suppliers = counterparties.filter(c => c.type === "supplier");

  const totalReceivable = customers.reduce((s, c) => s + Math.max(0, parseFloat(c.balance)), 0);
  const totalPayable = suppliers.reduce((s, c) => s + Math.max(0, parseFloat(c.balance)), 0);

  doc.fontSize(11).font("Helvetica-Bold").text("Genel Ozet", leftMargin);
  doc.moveDown(0.3);
  doc.fontSize(10).font("Helvetica");
  doc.text(`Toplam Musteri: ${customers.length}`, leftMargin);
  doc.text(`Toplam Tedarikci: ${suppliers.length}`, leftMargin);
  doc.text(`Toplam Alacak: ${formatCurrency(totalReceivable)}`, leftMargin);
  doc.text(`Toplam Borc: ${formatCurrency(totalPayable)}`, leftMargin);
  doc.moveDown(0.8);

  doc.moveTo(leftMargin, doc.y).lineTo(rightEdge, doc.y).lineWidth(0.5).stroke();
  doc.moveDown(0.8);

  const renderSection = (title: string, parties: CounterpartyWithBalance[]) => {
    if (parties.length === 0) return;

    doc.fontSize(14).font("Helvetica-Bold").text(title, leftMargin);
    doc.moveDown(0.5);

    const col1 = leftMargin;
    const col2 = leftMargin + 200;
    const col3 = leftMargin + 310;
    const col4 = leftMargin + 420;

    doc.fontSize(9).font("Helvetica-Bold");
    doc.text("Firma Adi", col1, doc.y, { continued: false });
    const headerY = doc.y - doc.currentLineHeight();
    doc.text("Telefon", col2, headerY);
    doc.text("Tur", col3, headerY);
    doc.text("Bakiye", col4, headerY);

    doc.moveDown(0.2);
    doc.moveTo(leftMargin, doc.y).lineTo(rightEdge, doc.y).lineWidth(0.5).stroke();
    doc.moveDown(0.3);

    doc.font("Helvetica").fontSize(9);

    for (const party of parties) {
      if (doc.y > 720) {
        doc.addPage();
      }

      const y = doc.y;
      const bal = parseFloat(party.balance);
      doc.text(party.name, col1, y, { width: 155 });
      doc.text(party.phone || "-", col2, y, { width: 105 });
      doc.text(party.type === "customer" ? "Musteri" : "Tedarikci", col3, y, { width: 105 });
      doc.text(formatCurrency(bal), col4, y, { width: 95 });
      doc.moveDown(0.2);

      const txs = transactionsByCounterparty.get(party.id) || [];
      if (txs.length > 0) {
        doc.fontSize(8).fillColor("#666666");
        const recentTxs = txs.slice(0, 10);
        for (const tx of recentTxs) {
          if (doc.y > 740) {
            doc.addPage();
          }
          const txY = doc.y;
          doc.text(`  ${formatDate(tx.txDate)}`, col1 + 10, txY);
          doc.text(TX_TYPE_LABELS[tx.txType] || tx.txType, col2, txY);
          doc.text(tx.description || "-", col3 - 30, txY, { width: 140 });
          doc.text(formatCurrency(tx.amount), col4, txY);
          doc.moveDown(0.15);
        }
        if (txs.length > 10) {
          doc.text(`  ... ve ${txs.length - 10} islem daha`, col1 + 10);
          doc.moveDown(0.15);
        }
        doc.fillColor("#000000").fontSize(9);
      }

      doc.moveDown(0.3);
      doc.moveTo(leftMargin, doc.y).lineTo(rightEdge, doc.y).lineWidth(0.2).dash(2, { space: 2 }).stroke();
      doc.undash();
      doc.moveDown(0.3);
    }

    doc.moveDown(0.5);
  };

  renderSection("Musteriler", customers);
  renderSection("Tedarikciler", suppliers);

  const pageCount = doc.bufferedPageRange().count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    doc.fontSize(7).fillColor("#999999").text(
      `Sayfa ${i + 1} / ${pageCount} - Capari Balik Dagitim`,
      leftMargin,
      doc.page.height - 30,
      { align: "center", width: pageWidth }
    );
  }

  doc.fillColor("#000000");

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

import PDFDocument from "pdfkit";
import type { CounterpartyWithBalance, Transaction, TransactionWithCounterparty } from "@shared/schema";
const FONT_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
const FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

const TX_TYPE_LABELS: Record<string, string> = {
  sale: "Satış",
  collection: "Tahsilat",
  purchase: "Alım",
  payment: "Ödeme",
};

const COLORS = {
  primary: "#1a365d",
  secondary: "#2b6cb0",
  accent: "#3182ce",
  text: "#1a202c",
  textLight: "#4a5568",
  textMuted: "#718096",
  border: "#cbd5e0",
  borderLight: "#e2e8f0",
  bgLight: "#f7fafc",
  bgHeader: "#ebf4ff",
  success: "#276749",
  danger: "#c53030",
  white: "#ffffff",
};

function formatCurrency(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return num.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " \u20BA";
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("tr-TR");
}

function drawHeader(doc: PDFKit.PDFDocument, leftMargin: number, rightEdge: number) {
  const headerY = doc.y;
  doc.rect(leftMargin, headerY, rightEdge - leftMargin, 50).fill(COLORS.primary);
  doc.font(FONT_BOLD).fontSize(16).fillColor(COLORS.white);
  doc.text("Çapari Balık Dağıtım", leftMargin, headerY + 10, {
    align: "center",
    width: rightEdge - leftMargin,
  });
  doc.fontSize(9).fillColor("#a0c4ff");
  doc.text("Cari Hesap Yönetim Sistemi", leftMargin, headerY + 30, {
    align: "center",
    width: rightEdge - leftMargin,
  });
  doc.y = headerY + 58;
  doc.fillColor(COLORS.text);
}

function drawInfoBox(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  valueColor?: string
) {
  doc.rect(x, y, w, h).lineWidth(0.5).strokeColor(COLORS.border).fillAndStroke(COLORS.bgLight, COLORS.border);
  doc.font(FONT_REGULAR).fontSize(7).fillColor(COLORS.textMuted);
  doc.text(label, x + 8, y + 6, { width: w - 16 });
  doc.font(FONT_BOLD).fontSize(10).fillColor(valueColor || COLORS.text);
  doc.text(value, x + 8, y + 18, { width: w - 16 });
  doc.fillColor(COLORS.text);
}

function drawTableHeader(doc: PDFKit.PDFDocument, columns: { x: number; w: number; label: string }[], y: number) {
  const fullWidth = columns[columns.length - 1].x + columns[columns.length - 1].w - columns[0].x;
  doc.rect(columns[0].x, y, fullWidth, 18).fill(COLORS.primary);
  doc.font(FONT_BOLD).fontSize(8).fillColor(COLORS.white);
  for (const col of columns) {
    doc.text(col.label, col.x + 4, y + 5, { width: col.w - 8 });
  }
  doc.fillColor(COLORS.text).font(FONT_REGULAR);
  return y + 18;
}

function drawFooter(doc: PDFKit.PDFDocument, leftMargin: number, pageWidth: number, pageIndex: number, totalPages: number) {
  const footerY = doc.page.height - 35;
  doc.moveTo(leftMargin, footerY).lineTo(leftMargin + pageWidth, footerY).lineWidth(0.5).strokeColor(COLORS.borderLight).stroke();
  doc.font(FONT_REGULAR).fontSize(7).fillColor(COLORS.textMuted);
  doc.text(
    `Çapari Balık Dağıtım  |  Sayfa ${pageIndex + 1} / ${totalPages}  |  ${new Date().toLocaleDateString("tr-TR")}`,
    leftMargin,
    footerY + 5,
    { align: "center", width: pageWidth }
  );
  doc.fillColor(COLORS.text);
}

export function generateCounterpartyPDF(
  party: CounterpartyWithBalance,
  transactions: Transaction[]
): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  const leftMargin = 40;
  const rightEdge = 555;
  const pageWidth = rightEdge - leftMargin;

  doc.font(FONT_REGULAR);

  drawHeader(doc, leftMargin, rightEdge);

  doc.font(FONT_BOLD).fontSize(12).fillColor(COLORS.primary);
  doc.text("CARİ HESAP EKSTRESİ", leftMargin, doc.y, { align: "center", width: pageWidth });
  doc.moveDown(0.5);

  doc.font(FONT_REGULAR).fontSize(8).fillColor(COLORS.textMuted);
  doc.text(`Oluşturma Tarihi: ${new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}`, leftMargin, doc.y, { align: "right", width: pageWidth });
  doc.moveDown(0.8);

  const infoY = doc.y;
  const boxW = (pageWidth - 10) / 2;
  const boxH = 50;

  doc.rect(leftMargin, infoY, boxW, boxH).lineWidth(0.5).strokeColor(COLORS.border).fillAndStroke(COLORS.bgLight, COLORS.border);
  doc.font(FONT_BOLD).fontSize(11).fillColor(COLORS.primary);
  doc.text(party.name, leftMargin + 10, infoY + 8, { width: boxW - 20 });
  doc.font(FONT_REGULAR).fontSize(8).fillColor(COLORS.textLight);
  doc.text(`${party.type === "customer" ? "Müşteri" : "Tedarikçi"}${party.phone ? "  |  " + party.phone : ""}`, leftMargin + 10, infoY + 26, { width: boxW - 20 });
  if (party.notes) {
    doc.text(party.notes, leftMargin + 10, infoY + 38, { width: boxW - 20 });
  }

  const bal = parseFloat(party.balance);
  const balColor = bal > 0 ? COLORS.danger : bal < 0 ? COLORS.success : COLORS.text;
  const balLabel = party.type === "customer"
    ? (bal > 0 ? "Müşteri Borcu" : bal < 0 ? "Fazla Ödeme" : "Bakiye")
    : (bal > 0 ? "Borcumuz" : bal < 0 ? "Fazla Ödeme" : "Bakiye");

  drawInfoBox(doc, leftMargin + boxW + 10, infoY, boxW, boxH, balLabel, formatCurrency(Math.abs(bal)), balColor);

  doc.y = infoY + boxH + 15;

  doc.font(FONT_BOLD).fontSize(10).fillColor(COLORS.primary);
  doc.text(`İşlem Geçmişi (${transactions.length} kayıt)`, leftMargin);
  doc.moveDown(0.4);

  const cols = [
    { x: leftMargin, w: 70, label: "Tarih" },
    { x: leftMargin + 70, w: 70, label: "Tür" },
    { x: leftMargin + 140, w: 220, label: "Açıklama" },
    { x: leftMargin + 360, w: 90, label: "Tutar" },
    { x: leftMargin + 450, w: 65, label: "Durum" },
  ];

  let tableY = drawTableHeader(doc, cols, doc.y);
  let rowIndex = 0;
  let runningBalance = 0;

  for (const tx of transactions) {
    if (tableY > 720) {
      doc.addPage();
      doc.font(FONT_REGULAR);
      tableY = drawTableHeader(doc, cols, 40);
    }

    const rowH = 20;
    if (rowIndex % 2 === 1) {
      doc.rect(leftMargin, tableY, pageWidth, rowH).fill(COLORS.bgLight);
    }

    doc.font(FONT_REGULAR).fontSize(8).fillColor(COLORS.text);
    doc.text(formatDate(tx.txDate), cols[0].x + 4, tableY + 6, { width: cols[0].w - 8 });
    doc.text(TX_TYPE_LABELS[tx.txType] || tx.txType, cols[1].x + 4, tableY + 6, { width: cols[1].w - 8 });

    const desc = tx.description || "-";
    doc.fontSize(7).fillColor(COLORS.textLight);
    doc.text(desc, cols[2].x + 4, tableY + 6, { width: cols[2].w - 8, lineBreak: false });

    const isDebit = tx.txType === "sale" || tx.txType === "purchase";
    doc.font(FONT_BOLD).fontSize(8).fillColor(isDebit ? COLORS.danger : COLORS.success);
    doc.text((isDebit ? "+" : "-") + formatCurrency(tx.amount), cols[3].x + 4, tableY + 6, { width: cols[3].w - 8 });

    doc.font(FONT_REGULAR).fontSize(7).fillColor(COLORS.textMuted);
    doc.text(tx.reversedOf ? "Düzeltme" : "", cols[4].x + 4, tableY + 6, { width: cols[4].w - 8 });

    tableY += rowH;
    rowIndex++;
  }

  doc.moveTo(leftMargin, tableY).lineTo(rightEdge, tableY).lineWidth(0.5).strokeColor(COLORS.border).stroke();
  doc.fillColor(COLORS.text);

  const pageCount = doc.bufferedPageRange().count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    drawFooter(doc, leftMargin, pageWidth, i, pageCount);
  }

  return doc;
}

export function generateAllCounterpartiesPDF(
  counterparties: CounterpartyWithBalance[],
  transactionsByCounterparty: Map<string, Transaction[]>
): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  const leftMargin = 40;
  const rightEdge = 555;
  const pageWidth = rightEdge - leftMargin;

  doc.font(FONT_REGULAR);

  drawHeader(doc, leftMargin, rightEdge);

  doc.font(FONT_BOLD).fontSize(12).fillColor(COLORS.primary);
  doc.text("TÜM CARİ HESAPLAR RAPORU", leftMargin, doc.y, { align: "center", width: pageWidth });
  doc.moveDown(0.3);
  doc.font(FONT_REGULAR).fontSize(8).fillColor(COLORS.textMuted);
  doc.text(`Rapor Tarihi: ${new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}`, leftMargin, doc.y, { align: "center", width: pageWidth });
  doc.moveDown(0.8);

  const customers = counterparties.filter(c => c.type === "customer");
  const suppliers = counterparties.filter(c => c.type === "supplier");
  const totalReceivable = customers.reduce((s, c) => s + Math.max(0, parseFloat(c.balance)), 0);
  const totalPayable = suppliers.reduce((s, c) => s + Math.max(0, parseFloat(c.balance)), 0);

  const summaryY = doc.y;
  const bw = (pageWidth - 30) / 4;
  drawInfoBox(doc, leftMargin, summaryY, bw, 35, "Müşteri Sayısı", `${customers.length}`);
  drawInfoBox(doc, leftMargin + bw + 10, summaryY, bw, 35, "Tedarikçi Sayısı", `${suppliers.length}`);
  drawInfoBox(doc, leftMargin + (bw + 10) * 2, summaryY, bw, 35, "Toplam Alacak", formatCurrency(totalReceivable), COLORS.danger);
  drawInfoBox(doc, leftMargin + (bw + 10) * 3, summaryY, bw, 35, "Toplam Borç", formatCurrency(totalPayable), COLORS.success);

  doc.y = summaryY + 50;

  const renderSection = (title: string, parties: CounterpartyWithBalance[]) => {
    if (parties.length === 0) return;

    if (doc.y > 680) doc.addPage();

    doc.font(FONT_BOLD).fontSize(11).fillColor(COLORS.primary);
    doc.text(title, leftMargin, doc.y);
    doc.moveDown(0.4);

    const cols = [
      { x: leftMargin, w: 180, label: "Firma Adı" },
      { x: leftMargin + 180, w: 100, label: "Telefon" },
      { x: leftMargin + 280, w: 80, label: "Tür" },
      { x: leftMargin + 360, w: pageWidth - 360, label: "Bakiye" },
    ];

    let tableY = drawTableHeader(doc, cols, doc.y);
    let rowIndex = 0;

    for (const party of parties) {
      if (tableY > 720) {
        doc.addPage();
        doc.font(FONT_REGULAR);
        tableY = drawTableHeader(doc, cols, 40);
        rowIndex = 0;
      }

      const rowH = 18;
      if (rowIndex % 2 === 1) {
        doc.rect(leftMargin, tableY, pageWidth, rowH).fill(COLORS.bgLight);
      }

      const bal = parseFloat(party.balance);
      doc.font(FONT_REGULAR).fontSize(8).fillColor(COLORS.text);
      doc.text(party.name, cols[0].x + 4, tableY + 5, { width: cols[0].w - 8, lineBreak: false });
      doc.text(party.phone || "-", cols[1].x + 4, tableY + 5, { width: cols[1].w - 8 });
      doc.text(party.type === "customer" ? "Müşteri" : "Tedarikçi", cols[2].x + 4, tableY + 5, { width: cols[2].w - 8 });
      doc.font(FONT_BOLD).fontSize(8).fillColor(bal > 0 ? COLORS.danger : bal < 0 ? COLORS.success : COLORS.text);
      doc.text(formatCurrency(bal), cols[3].x + 4, tableY + 5, { width: cols[3].w - 8 });

      tableY += rowH;
      rowIndex++;

      const txs = transactionsByCounterparty.get(party.id) || [];
      if (txs.length > 0) {
        doc.font(FONT_REGULAR).fontSize(7).fillColor(COLORS.textMuted);
        const recentTxs = txs.slice(0, 5);
        for (const tx of recentTxs) {
          if (tableY > 740) {
            doc.addPage();
            doc.font(FONT_REGULAR);
            tableY = 40;
          }
          doc.text(
            `   ${formatDate(tx.txDate)}  -  ${TX_TYPE_LABELS[tx.txType] || tx.txType}  -  ${formatCurrency(tx.amount)}${tx.description ? "  -  " + tx.description.substring(0, 60) : ""}`,
            leftMargin + 10, tableY, { width: pageWidth - 20, lineBreak: false }
          );
          tableY += 12;
        }
        if (txs.length > 5) {
          doc.text(`   ... ve ${txs.length - 5} işlem daha`, leftMargin + 10, tableY);
          tableY += 12;
        }
        doc.fillColor(COLORS.text);
      }

      doc.moveTo(leftMargin, tableY + 2).lineTo(rightEdge, tableY + 2).lineWidth(0.2).strokeColor(COLORS.borderLight).stroke();
      tableY += 6;
    }

    doc.y = tableY + 10;
  };

  renderSection("Müşteriler", customers);
  renderSection("Tedarikçiler", suppliers);

  const pageCount = doc.bufferedPageRange().count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    drawFooter(doc, leftMargin, pageWidth, i, pageCount);
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
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  const leftMargin = 40;
  const rightEdge = 555;
  const pageWidth = rightEdge - leftMargin;

  doc.font(FONT_REGULAR);

  drawHeader(doc, leftMargin, rightEdge);

  doc.font(FONT_BOLD).fontSize(12).fillColor(COLORS.primary);
  doc.text("GÜNLÜK RAPOR", leftMargin, doc.y, { align: "center", width: pageWidth });
  doc.moveDown(0.3);
  doc.font(FONT_REGULAR).fontSize(10).fillColor(COLORS.textLight);
  doc.text(formatDate(date), leftMargin, doc.y, { align: "center", width: pageWidth });
  doc.moveDown(0.8);

  const summaryY = doc.y;
  const bw = (pageWidth - 30) / 4;
  drawInfoBox(doc, leftMargin, summaryY, bw, 35, "Toplam Satış", formatCurrency(report.totalSales), COLORS.danger);
  drawInfoBox(doc, leftMargin + bw + 10, summaryY, bw, 35, "Toplam Tahsilat", formatCurrency(report.totalCollections), COLORS.success);
  drawInfoBox(doc, leftMargin + (bw + 10) * 2, summaryY, bw, 35, "Toplam Alım", formatCurrency(report.totalPurchases));
  drawInfoBox(doc, leftMargin + (bw + 10) * 3, summaryY, bw, 35, "Toplam Ödeme", formatCurrency(report.totalPayments));

  doc.y = summaryY + 50;

  doc.font(FONT_BOLD).fontSize(10).fillColor(COLORS.primary);
  doc.text(`İşlemler (${report.transactions.length} kayıt)`, leftMargin);
  doc.moveDown(0.4);

  const cols = [
    { x: leftMargin, w: 140, label: "Firma" },
    { x: leftMargin + 140, w: 70, label: "Tür" },
    { x: leftMargin + 210, w: 200, label: "Açıklama" },
    { x: leftMargin + 410, w: 105, label: "Tutar" },
  ];

  let tableY = drawTableHeader(doc, cols, doc.y);
  let rowIndex = 0;

  for (const tx of report.transactions) {
    if (tableY > 720) {
      doc.addPage();
      doc.font(FONT_REGULAR);
      tableY = drawTableHeader(doc, cols, 40);
      rowIndex = 0;
    }

    const rowH = 20;
    if (rowIndex % 2 === 1) {
      doc.rect(leftMargin, tableY, pageWidth, rowH).fill(COLORS.bgLight);
    }

    doc.font(FONT_REGULAR).fontSize(8).fillColor(COLORS.text);
    doc.text(tx.counterpartyName || "", cols[0].x + 4, tableY + 6, { width: cols[0].w - 8, lineBreak: false });
    doc.text(TX_TYPE_LABELS[tx.txType] || tx.txType, cols[1].x + 4, tableY + 6, { width: cols[1].w - 8 });
    doc.fontSize(7).fillColor(COLORS.textLight);
    doc.text(tx.description || "-", cols[2].x + 4, tableY + 6, { width: cols[2].w - 8, lineBreak: false });

    const isDebit = tx.txType === "sale" || tx.txType === "purchase";
    doc.font(FONT_BOLD).fontSize(8).fillColor(isDebit ? COLORS.danger : COLORS.success);
    doc.text(formatCurrency(tx.amount), cols[3].x + 4, tableY + 6, { width: cols[3].w - 8 });

    tableY += rowH;
    rowIndex++;
  }

  doc.moveTo(leftMargin, tableY).lineTo(rightEdge, tableY).lineWidth(0.5).strokeColor(COLORS.border).stroke();
  doc.fillColor(COLORS.text);

  const pageCount = doc.bufferedPageRange().count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    drawFooter(doc, leftMargin, pageWidth, i, pageCount);
  }

  return doc;
}

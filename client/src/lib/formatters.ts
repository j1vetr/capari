export function formatCurrency(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(num);
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
  }).format(d);
}

export function txTypeLabel(txType: string): string {
  const labels: Record<string, string> = {
    sale: "Satış",
    collection: "Tahsilat",
    purchase: "Alım",
    payment: "Ödeme",
  };
  return labels[txType] || txType;
}

export function txTypeColor(txType: string): string {
  const colors: Record<string, string> = {
    sale: "text-emerald-600 dark:text-emerald-400",
    collection: "text-blue-600 dark:text-blue-400",
    purchase: "text-orange-600 dark:text-orange-400",
    payment: "text-rose-600 dark:text-rose-400",
  };
  return colors[txType] || "";
}

export function txTypeBg(txType: string): string {
  const colors: Record<string, string> = {
    sale: "bg-emerald-50 dark:bg-emerald-950/30",
    collection: "bg-blue-50 dark:bg-blue-950/30",
    purchase: "bg-orange-50 dark:bg-orange-950/30",
    payment: "bg-rose-50 dark:bg-rose-950/30",
  };
  return colors[txType] || "";
}

export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export type ParsedLineItem = {
  product: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  total: number;
};

function parseTurkishNumber(s: string): number {
  const cleaned = s.replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

export function parseLineItems(description: string | null | undefined): ParsedLineItem[] | null {
  if (!description) return null;
  const regex = /(.+?)\s+([\d.,]+)\s*(kg|kasa|adet)\s*x\s*₺?\s*([\d.,]+)/gi;
  const items: ParsedLineItem[] = [];
  let match;
  while ((match = regex.exec(description)) !== null) {
    const q = parseTurkishNumber(match[2]);
    const unit = match[3].toLowerCase();
    const p = parseTurkishNumber(match[4]);
    if (q > 0 && p > 0) {
      items.push({
        product: match[1].trim(),
        quantity: q.toString(),
        unit,
        unitPrice: p.toString(),
        total: q * p,
      });
    }
  }
  return items.length > 0 ? items : null;
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar, Download, ShoppingCart, ArrowDownToLine, Banknote, ArrowUpFromLine,
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown, FileText, CalendarDays
} from "lucide-react";
import { formatCurrency, formatDate, txTypeLabel, txTypeColor, txTypeBg, todayISO } from "@/lib/formatters";
import type { TransactionWithCounterparty } from "@shared/schema";

type DailyReport = {
  totalSales: string;
  totalCollections: string;
  totalPurchases: string;
  totalPayments: string;
  transactions: TransactionWithCounterparty[];
};

type MonthlyReport = {
  totalSales: string;
  totalCollections: string;
  totalPurchases: string;
  totalPayments: string;
  dailyBreakdown: { date: string; sales: string; collections: string; purchases: string; payments: string }[];
  transactions: TransactionWithCounterparty[];
};

const MONTHS_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
];

export default function Reports() {
  const [tab, setTab] = useState<"daily" | "monthly">("daily");
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  const { data: dailyReport, isLoading: dailyLoading } = useQuery<DailyReport>({
    queryKey: ["/api/reports/daily", selectedDate],
    enabled: tab === "daily",
  });

  const { data: monthlyReport, isLoading: monthlyLoading } = useQuery<MonthlyReport>({
    queryKey: ["/api/reports/monthly", selectedYear, selectedMonth],
    queryFn: async () => {
      const res = await fetch(`/api/reports/monthly/${selectedYear}/${selectedMonth}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load monthly report");
      return res.json();
    },
    enabled: tab === "monthly",
  });

  const handleExportDailyPDF = () => {
    window.open(`/api/reports/daily/${selectedDate}/pdf`, "_blank");
  };

  const changeDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const changeMonth = (delta: number) => {
    let m = selectedMonth + delta;
    let y = selectedYear;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setSelectedMonth(m);
    setSelectedYear(y);
  };

  const isToday = selectedDate === todayISO();
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth() + 1;

  const txTypeIcon = (type: string) => {
    switch (type) {
      case "sale": return <ShoppingCart className="w-4 h-4" />;
      case "collection": return <ArrowDownToLine className="w-4 h-4" />;
      case "purchase": return <Banknote className="w-4 h-4" />;
      case "payment": return <ArrowUpFromLine className="w-4 h-4" />;
      default: return null;
    }
  };

  const formattedDate = new Date(selectedDate).toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const renderSummaryCards = (report: { totalSales: string; totalCollections: string; totalPurchases: string; totalPayments: string }) => {
    const sales = parseFloat(report.totalSales);
    const collections = parseFloat(report.totalCollections);
    const purchases = parseFloat(report.totalPurchases);
    const payments = parseFloat(report.totalPayments);
    const netIncome = sales + collections - purchases - payments;

    return (
      <>
        <div className="grid grid-cols-2 gap-2">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-md bg-emerald-50 dark:bg-emerald-950/30">
                  <ShoppingCart className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-[11px] font-medium text-gray-400 dark:text-muted-foreground">Satış</span>
              </div>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-total-sales">{formatCurrency(sales)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-md bg-sky-50 dark:bg-sky-950/30">
                  <ArrowDownToLine className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                </div>
                <span className="text-[11px] font-medium text-gray-400 dark:text-muted-foreground">Tahsilat</span>
              </div>
              <p className="text-lg font-bold text-sky-600 dark:text-sky-400" data-testid="text-total-collections">{formatCurrency(collections)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-md bg-amber-50 dark:bg-amber-950/30">
                  <Banknote className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-[11px] font-medium text-gray-400 dark:text-muted-foreground">Alım</span>
              </div>
              <p className="text-lg font-bold text-amber-600 dark:text-amber-400" data-testid="text-total-purchases">{formatCurrency(purchases)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-md bg-rose-50 dark:bg-rose-950/30">
                  <ArrowUpFromLine className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                </div>
                <span className="text-[11px] font-medium text-gray-400 dark:text-muted-foreground">Ödeme</span>
              </div>
              <p className="text-lg font-bold text-rose-600 dark:text-rose-400" data-testid="text-total-payments">{formatCurrency(payments)}</p>
            </CardContent>
          </Card>
        </div>

        <Card className={`border-0 ${netIncome >= 0
          ? "bg-emerald-50 dark:bg-emerald-950/20"
          : "bg-rose-50 dark:bg-rose-950/20"
          }`}>
          <CardContent className="p-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {netIncome >= 0
                ? <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                : <TrendingDown className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-muted-foreground">Net Durum</p>
                <p className="text-[11px] text-gray-400 dark:text-muted-foreground">(Satış+Tahsilat) - (Alım+Ödeme)</p>
              </div>
            </div>
            <p className={`text-xl font-bold ${netIncome >= 0
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-rose-700 dark:text-rose-400"
              }`} data-testid="text-net-income">
              {netIncome >= 0 ? "+" : ""}{formatCurrency(netIncome)}
            </p>
          </CardContent>
        </Card>
      </>
    );
  };

  return (
    <div className="flex flex-col gap-4 p-4 pb-24 max-w-lg mx-auto">
      <div className="flex items-end justify-between gap-2 flex-wrap">
        <div>
          <p className="text-xs font-medium text-gray-400 dark:text-muted-foreground uppercase tracking-wider mb-0.5">Raporlama</p>
          <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-foreground">Raporlar</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {tab === "daily" && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportDailyPDF} data-testid="button-report-pdf">
              <Download className="w-4 h-4" />
              PDF
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.open("/api/export/counterparties/csv", "_blank")} data-testid="button-export-counterparties-csv">
            <FileText className="w-4 h-4" />
            Cari CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.open("/api/export/transactions/csv", "_blank")} data-testid="button-export-transactions-csv">
            <FileText className="w-4 h-4" />
            İşlem CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={tab === "daily" ? "default" : "outline"}
          className="gap-1.5"
          onClick={() => setTab("daily")}
          data-testid="button-tab-daily"
        >
          <Calendar className="w-4 h-4" />
          Günlük
        </Button>
        <Button
          variant={tab === "monthly" ? "default" : "outline"}
          className="gap-1.5"
          onClick={() => setTab("monthly")}
          data-testid="button-tab-monthly"
        >
          <CalendarDays className="w-4 h-4" />
          Aylık
        </Button>
      </div>

      {tab === "daily" && (
        <>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-2">
                <Button variant="ghost" size="icon" onClick={() => changeDate(-1)} data-testid="button-prev-day">
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <div className="flex-1 text-center">
                  <div className="relative inline-block">
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                      data-testid="input-report-date"
                    />
                    <div className="flex flex-col items-center cursor-pointer">
                      <p className="text-sm font-bold text-gray-900 dark:text-foreground">{formattedDate}</p>
                      {isToday && <Badge variant="secondary" className="text-[10px] mt-1">Bugün</Badge>}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => changeDate(1)} disabled={isToday} data-testid="button-next-day">
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {dailyLoading ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i}><CardContent className="p-3"><Skeleton className="h-14 w-full" /></CardContent></Card>
                ))}
              </div>
            </div>
          ) : dailyReport ? (
            <>
              {renderSummaryCards(dailyReport)}

              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-gray-400 dark:text-muted-foreground uppercase tracking-wider">
                  İşlem Detayları
                </p>
                <Badge variant="secondary" className="text-[10px]">
                  {dailyReport.transactions.length} işlem
                </Badge>
              </div>

              <div className="flex flex-col gap-2">
                {dailyReport.transactions.length === 0 && (
                  <div className="text-center py-10">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-muted mx-auto mb-3">
                      <FileText className="w-5 h-5 text-gray-400 dark:text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-gray-500 dark:text-muted-foreground">Bu tarihte işlem yok</p>
                    <p className="text-xs text-gray-400 dark:text-muted-foreground mt-1">Tarih seçerek farklı günleri görüntüleyin</p>
                  </div>
                )}
                {dailyReport.transactions.map((tx) => (
                  <Card key={tx.id} data-testid={`card-report-tx-${tx.id}`}>
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className={`flex items-center justify-center w-9 h-9 rounded-md mt-0.5 flex-shrink-0 ${txTypeBg(tx.txType)}`}>
                          {txTypeIcon(tx.txType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-foreground truncate">{tx.counterpartyName}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className={`text-xs font-medium ${txTypeColor(tx.txType)}`}>{txTypeLabel(tx.txType)}</span>
                            <span className="text-[10px] text-gray-400 dark:text-muted-foreground">
                              {tx.counterpartyType === "customer" ? "Müşteri" : "Tedarikçi"}
                            </span>
                          </div>
                          {tx.description && (
                            <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1">{tx.description}</p>
                          )}
                        </div>
                        <span className="text-sm font-bold text-gray-900 dark:text-foreground whitespace-nowrap flex-shrink-0">
                          {formatCurrency(tx.amount)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : null}
        </>
      )}

      {tab === "monthly" && (
        <>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-2">
                <Button variant="ghost" size="icon" onClick={() => changeMonth(-1)} data-testid="button-prev-month">
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <div className="text-center">
                  <p className="text-sm font-bold text-gray-900 dark:text-foreground">
                    {MONTHS_TR[selectedMonth - 1]} {selectedYear}
                  </p>
                  {isCurrentMonth && <Badge variant="secondary" className="text-[10px] mt-1">Bu Ay</Badge>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => changeMonth(1)} disabled={isCurrentMonth} data-testid="button-next-month">
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {monthlyLoading ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i}><CardContent className="p-3"><Skeleton className="h-14 w-full" /></CardContent></Card>
                ))}
              </div>
            </div>
          ) : monthlyReport ? (
            <>
              {renderSummaryCards(monthlyReport)}

              {monthlyReport.dailyBreakdown.length > 0 && (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-gray-400 dark:text-muted-foreground uppercase tracking-wider">
                      Günlük Özet
                    </p>
                    <Badge variant="secondary" className="text-[10px]">
                      {monthlyReport.dailyBreakdown.length} gün
                    </Badge>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {monthlyReport.dailyBreakdown.map((day) => {
                      const daySales = parseFloat(day.sales);
                      const dayCollections = parseFloat(day.collections);
                      const dayPurchases = parseFloat(day.purchases);
                      const dayPayments = parseFloat(day.payments);
                      const dayNet = daySales + dayCollections - dayPurchases - dayPayments;
                      return (
                        <Card key={day.date} data-testid={`card-daily-${day.date}`}>
                          <CardContent className="p-2.5">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-gray-700 dark:text-foreground">
                                {formatDate(day.date)}
                              </span>
                              <div className="flex items-center gap-3 flex-wrap">
                                {daySales > 0 && <span className="text-[10px] text-emerald-600 dark:text-emerald-400">S: {formatCurrency(daySales)}</span>}
                                {dayCollections > 0 && <span className="text-[10px] text-sky-600 dark:text-sky-400">T: {formatCurrency(dayCollections)}</span>}
                                {dayPurchases > 0 && <span className="text-[10px] text-amber-600 dark:text-amber-400">A: {formatCurrency(dayPurchases)}</span>}
                                {dayPayments > 0 && <span className="text-[10px] text-rose-600 dark:text-rose-400">Ö: {formatCurrency(dayPayments)}</span>}
                              </div>
                              <span className={`text-xs font-bold ${dayNet >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                {dayNet >= 0 ? "+" : ""}{formatCurrency(dayNet)}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-gray-400 dark:text-muted-foreground uppercase tracking-wider">
                  Tüm İşlemler
                </p>
                <Badge variant="secondary" className="text-[10px]">
                  {monthlyReport.transactions.length} işlem
                </Badge>
              </div>

              <div className="flex flex-col gap-2">
                {monthlyReport.transactions.length === 0 && (
                  <div className="text-center py-10">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-muted mx-auto mb-3">
                      <FileText className="w-5 h-5 text-gray-400 dark:text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-gray-500 dark:text-muted-foreground">Bu ayda işlem yok</p>
                  </div>
                )}
                {monthlyReport.transactions.map((tx) => (
                  <Card key={tx.id} data-testid={`card-monthly-tx-${tx.id}`}>
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className={`flex items-center justify-center w-9 h-9 rounded-md mt-0.5 flex-shrink-0 ${txTypeBg(tx.txType)}`}>
                          {txTypeIcon(tx.txType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-foreground truncate">{tx.counterpartyName}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className={`text-xs font-medium ${txTypeColor(tx.txType)}`}>{txTypeLabel(tx.txType)}</span>
                            <span className="text-[10px] text-gray-400 dark:text-muted-foreground">{formatDate(tx.txDate)}</span>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-gray-900 dark:text-foreground whitespace-nowrap flex-shrink-0">
                          {formatCurrency(tx.amount)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

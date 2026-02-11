import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Calendar, Download, ShoppingCart, ArrowDownToLine, Banknote, ArrowUpFromLine,
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown, FileText
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

export default function Reports() {
  const [selectedDate, setSelectedDate] = useState(todayISO());

  const { data: report, isLoading } = useQuery<DailyReport>({
    queryKey: ["/api/reports/daily", selectedDate],
  });

  const handleExportPDF = () => {
    window.open(`/api/reports/daily/${selectedDate}/pdf`, "_blank");
  };

  const changeDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const isToday = selectedDate === todayISO();

  const txTypeIcon = (type: string) => {
    switch (type) {
      case "sale": return <ShoppingCart className="w-4 h-4" />;
      case "collection": return <ArrowDownToLine className="w-4 h-4" />;
      case "purchase": return <Banknote className="w-4 h-4" />;
      case "payment": return <ArrowUpFromLine className="w-4 h-4" />;
      default: return null;
    }
  };

  const sales = parseFloat(report?.totalSales || "0");
  const collections = parseFloat(report?.totalCollections || "0");
  const purchases = parseFloat(report?.totalPurchases || "0");
  const payments = parseFloat(report?.totalPayments || "0");
  const netIncome = sales + collections - purchases - payments;

  const formattedDate = new Date(selectedDate).toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-4 p-4 pb-24 max-w-lg mx-auto">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-gray-400 dark:text-muted-foreground uppercase tracking-wider mb-0.5">Günlük Rapor</p>
          <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-foreground">Raporlar</h2>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportPDF} data-testid="button-report-pdf">
          <Download className="w-4 h-4" />
          PDF İndir
        </Button>
      </div>

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

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="p-3"><Skeleton className="h-14 w-full" /></CardContent></Card>
            ))}
          </div>
        </div>
      ) : report ? (
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
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(sales)}</p>
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
                <p className="text-lg font-bold text-sky-600 dark:text-sky-400">{formatCurrency(collections)}</p>
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
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{formatCurrency(purchases)}</p>
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
                <p className="text-lg font-bold text-rose-600 dark:text-rose-400">{formatCurrency(payments)}</p>
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
                }`}>
                {netIncome >= 0 ? "+" : ""}{formatCurrency(netIncome)}
              </p>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-gray-400 dark:text-muted-foreground uppercase tracking-wider">
              İşlem Detayları
            </p>
            <Badge variant="secondary" className="text-[10px]">
              {report.transactions.length} işlem
            </Badge>
          </div>

          <div className="flex flex-col gap-2">
            {report.transactions.length === 0 && (
              <div className="text-center py-10">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-muted mx-auto mb-3">
                  <FileText className="w-5 h-5 text-gray-400 dark:text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-gray-500 dark:text-muted-foreground">Bu tarihte işlem yok</p>
                <p className="text-xs text-gray-400 dark:text-muted-foreground mt-1">Tarih seçerek farklı günleri görüntüleyin</p>
              </div>
            )}
            {report.transactions.map((tx) => (
              <Card key={tx.id} data-testid={`card-report-tx-${tx.id}`}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className={`flex items-center justify-center w-9 h-9 rounded-md mt-0.5 flex-shrink-0 ${txTypeBg(tx.txType)}`}>
                      {txTypeIcon(tx.txType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-foreground truncate">{tx.counterpartyName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
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
    </div>
  );
}

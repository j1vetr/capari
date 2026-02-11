import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Download, ShoppingCart, ArrowDownToLine, Banknote, ArrowUpFromLine } from "lucide-react";
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

  const txTypeIcon = (type: string) => {
    switch (type) {
      case "sale": return <ShoppingCart className="w-4 h-4" />;
      case "collection": return <ArrowDownToLine className="w-4 h-4" />;
      case "purchase": return <Banknote className="w-4 h-4" />;
      case "payment": return <ArrowUpFromLine className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 pb-24 max-w-lg mx-auto">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Raporlar</h1>
        <p className="text-sm text-muted-foreground">Günlük özet rapor</p>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label className="text-sm font-medium mb-1.5 block">Tarih Seç</Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-10"
              data-testid="input-report-date"
            />
          </div>
        </div>
        <Button variant="outline" size="default" onClick={handleExportPDF} className="gap-1.5" data-testid="button-report-pdf">
          <Download className="w-4 h-4" />
          PDF
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-3"><Skeleton className="h-12 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : report ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Satış</p>
                <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(report.totalSales)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Tahsilat</p>
                <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(report.totalCollections)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Alım</p>
                <p className="text-lg font-semibold text-orange-600 dark:text-orange-400">{formatCurrency(report.totalPurchases)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Ödeme</p>
                <p className="text-lg font-semibold text-rose-600 dark:text-rose-400">{formatCurrency(report.totalPayments)}</p>
              </CardContent>
            </Card>
          </div>

          <h2 className="text-sm font-medium text-muted-foreground">
            İşlemler ({report.transactions.length})
          </h2>

          <div className="flex flex-col gap-2">
            {report.transactions.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">Bu tarihte işlem yok</p>
              </div>
            )}
            {report.transactions.map((tx) => (
              <Card key={tx.id} data-testid={`card-report-tx-${tx.id}`}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-md mt-0.5 ${txTypeBg(tx.txType)}`}>
                        {txTypeIcon(tx.txType)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{tx.counterpartyName}</p>
                        <p className={`text-xs ${txTypeColor(tx.txType)}`}>{txTypeLabel(tx.txType)}</p>
                        {tx.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{tx.description}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-sm font-semibold whitespace-nowrap">{formatCurrency(tx.amount)}</span>
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

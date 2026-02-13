import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp, TrendingDown, ShoppingCart, ArrowDownToLine,
  Banknote, ArrowUpFromLine, Plus, ChevronRight, CalendarDays, Users,
  Crown, AlertTriangle, Clock, BarChart3, Store, Truck, FileText
} from "lucide-react";
import { formatCurrency, formatDate, txTypeLabel, txTypeColor, txTypeBg } from "@/lib/formatters";
import type { DashboardSummary, StatsData, TransactionWithCounterparty, CheckNoteWithCounterparty } from "@shared/schema";
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

function StatCardLarge({ title, value, subtitle, icon: Icon, bgClass, iconClass, isLoading }: {
  title: string;
  value: string;
  subtitle: string;
  icon: any;
  bgClass: string;
  iconClass: string;
  isLoading: boolean;
}) {
  return (
    <Card className="flex-1" data-testid={`card-stat-${title.toLowerCase().replace(/\s/g, "-")}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className={`flex items-center justify-center w-10 h-10 rounded-md ${bgClass}`}>
            <Icon className={`w-5 h-5 ${iconClass}`} />
          </div>
          <Badge variant="secondary" className="text-[10px] font-medium">{subtitle}</Badge>
        </div>
        <p className="text-xs font-medium text-gray-500 dark:text-muted-foreground mb-1">{title}</p>
        {isLoading ? (
          <Skeleton className="h-7 w-28" />
        ) : (
          <p className="text-xl font-bold tracking-tight text-gray-900 dark:text-foreground" data-testid={`text-value-${title.toLowerCase().replace(/\s/g, "-")}`}>
            {formatCurrency(value)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function StatCardSmall({ title, value, icon: Icon, bgClass, iconClass, valueClass, isLoading }: {
  title: string;
  value: string;
  icon: any;
  bgClass: string;
  iconClass: string;
  valueClass: string;
  isLoading: boolean;
}) {
  return (
    <Card data-testid={`card-stat-${title.toLowerCase().replace(/\s/g, "-")}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2.5">
          <div className={`flex items-center justify-center w-8 h-8 rounded-md flex-shrink-0 ${bgClass}`}>
            <Icon className={`w-4 h-4 ${iconClass}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-gray-400 dark:text-muted-foreground leading-tight">{title}</p>
            {isLoading ? (
              <Skeleton className="h-5 w-16 mt-0.5" />
            ) : (
              <p className={`text-sm font-bold tracking-tight ${valueClass}`}>
                {formatCurrency(value)}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { data, isLoading } = useQuery<DashboardSummary>({
    queryKey: ["/api/dashboard"],
  });
  const { data: stats, isLoading: statsLoading } = useQuery<StatsData>({
    queryKey: ["/api/stats"],
  });
  const { data: recentTxs, isLoading: recentLoading } = useQuery<TransactionWithCounterparty[]>({
    queryKey: ["/api/recent-transactions"],
  });
  const { data: upcomingChecks } = useQuery<CheckNoteWithCounterparty[]>({
    queryKey: ["/api/checks/upcoming"],
  });

  const chartData = data?.last7DaysSales?.map((d, i, arr) => ({
    date: new Date(d.date).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" }),
    total: parseFloat(d.total),
    isToday: i === arr.length - 1,
  })) || [];

  const today = new Date().toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-4 p-4 pb-24 max-w-lg mx-auto">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-gray-400 dark:text-muted-foreground uppercase tracking-wider mb-0.5">Genel Bakış</p>
          <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-foreground">Bugünkü Durum</h2>
        </div>
        <div className="flex items-center gap-1.5 text-gray-400 dark:text-muted-foreground">
          <CalendarDays className="w-3.5 h-3.5" />
          <span className="text-[11px] font-medium">{today}</span>
        </div>
      </div>

      {stats && stats.upcomingPayments.filter(p => p.daysLeft <= 1).length > 0 && (
        <Card className="border-0 bg-red-50 dark:bg-red-950/20" data-testid="card-urgent-payments">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-red-700 dark:text-red-300">
                  {stats.upcomingPayments.filter(p => p.daysLeft === 0).length > 0 ? "Bugün vadesi dolan ödemeler var!" : "Yarın vadesi dolacak ödemeler var!"}
                </p>
                <p className="text-[10px] text-red-500 dark:text-red-400 mt-0.5">
                  {stats.upcomingPayments.filter(p => p.daysLeft <= 1).map(p => p.name).join(", ")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {upcomingChecks && upcomingChecks.length > 0 && (() => {
        const today = new Date();
        today.setHours(0,0,0,0);
        const overdue = upcomingChecks.filter(c => new Date(c.dueDate) < today);
        const dueSoon = upcomingChecks.filter(c => {
          const d = new Date(c.dueDate);
          return d >= today;
        });
        return (
          <Card className="border-0 bg-amber-50 dark:bg-amber-950/20" data-testid="card-upcoming-checks">
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                    {overdue.length > 0 ? `${overdue.length} adet vadesi gecmis cek/senet!` : `${dueSoon.length} adet vadesi yaklasan cek/senet`}
                  </p>
                  <div className="flex flex-col gap-1 mt-1">
                    {upcomingChecks.slice(0, 5).map(c => {
                      const d = new Date(c.dueDate);
                      const daysLeft = Math.ceil((d.getTime() - today.getTime()) / (1000*60*60*24));
                      const isOvd = d < today;
                      return (
                        <div key={c.id} className="flex items-center gap-1 text-[10px]">
                          <span className={isOvd ? "text-red-600 dark:text-red-400 font-semibold" : "text-amber-600 dark:text-amber-400"}>
                            {c.counterpartyName}
                          </span>
                          <span className="text-amber-500 dark:text-amber-500">-</span>
                          <span className="text-amber-600 dark:text-amber-400">{formatCurrency(c.amount)}</span>
                          <span className="text-amber-500 dark:text-amber-500">
                            ({isOvd ? `${Math.abs(daysLeft)} gun gecti` : daysLeft === 0 ? "bugun" : `${daysLeft} gun`})
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      <div className="flex gap-3">
        <StatCardLarge
          title="Toplam Alacak"
          value={data?.totalReceivables || "0"}
          subtitle="Müşteriler"
          icon={TrendingUp}
          bgClass="bg-emerald-50 dark:bg-emerald-950/30"
          iconClass="text-emerald-600 dark:text-emerald-400"
          isLoading={isLoading}
        />
        <StatCardLarge
          title="Toplam Borç"
          value={data?.totalPayables || "0"}
          subtitle="Tedarikçiler"
          icon={TrendingDown}
          bgClass="bg-rose-50 dark:bg-rose-950/30"
          iconClass="text-rose-600 dark:text-rose-400"
          isLoading={isLoading}
        />
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-400 dark:text-muted-foreground uppercase tracking-wider mb-2">Bugünkü Hareketler</p>
        <div className="grid grid-cols-2 gap-2">
          <StatCardSmall
            title="Satış"
            value={data?.todaySales || "0"}
            icon={ShoppingCart}
            bgClass="bg-emerald-50 dark:bg-emerald-950/30"
            iconClass="text-emerald-600 dark:text-emerald-400"
            valueClass="text-emerald-700 dark:text-emerald-400"
            isLoading={isLoading}
          />
          <StatCardSmall
            title="Tahsilat"
            value={data?.todayCollections || "0"}
            icon={ArrowDownToLine}
            bgClass="bg-sky-50 dark:bg-sky-950/30"
            iconClass="text-sky-600 dark:text-sky-400"
            valueClass="text-sky-700 dark:text-sky-400"
            isLoading={isLoading}
          />
          <StatCardSmall
            title="Alım"
            value={data?.todayPurchases || "0"}
            icon={Banknote}
            bgClass="bg-amber-50 dark:bg-amber-950/30"
            iconClass="text-amber-600 dark:text-amber-400"
            valueClass="text-amber-700 dark:text-amber-400"
            isLoading={isLoading}
          />
          <StatCardSmall
            title="Ödeme"
            value={data?.todayPayments || "0"}
            icon={ArrowUpFromLine}
            bgClass="bg-rose-50 dark:bg-rose-950/30"
            iconClass="text-rose-500 dark:text-rose-400"
            valueClass="text-rose-600 dark:text-rose-400"
            isLoading={isLoading}
          />
        </div>
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-muted-foreground uppercase tracking-wider">Son 7 Gün</p>
                <p className="text-sm font-bold text-gray-900 dark:text-foreground">Satış Grafiği</p>
              </div>
              <Badge variant="secondary" className="text-[10px]">
                {formatCurrency(chartData.reduce((s, c) => s + c.total, 0))} toplam
              </Badge>
            </div>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barCategoryGap="20%">
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(v: number) => [formatCurrency(v), "Satış"]}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                    cursor={{ fill: "rgba(0,0,0,0.03)" }}
                  />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.isToday ? "#0284c7" : "#bae6fd"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-11 gap-1.5 text-xs font-semibold" onClick={() => navigate("/islem-ekle")} data-testid="button-quick-tx">
          <Plus className="w-4 h-4" />
          H\u0131zl\u0131 \u0130\u015Flem
        </Button>
        <Button variant="outline" className="h-11 gap-1.5 text-xs font-semibold" onClick={() => navigate("/toplu-cek")} data-testid="button-bulk-checks">
          <FileText className="w-4 h-4" />
          Toplu \u00C7ek/Senet
        </Button>
      </div>

      {recentTxs && recentTxs.length > 0 && (
        <Card data-testid="card-recent-transactions">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-muted-foreground uppercase tracking-wider">Son İşlemler</p>
                <p className="text-sm font-bold text-gray-900 dark:text-foreground">Son 10 Hareket</p>
              </div>
              <Badge variant="secondary" className="text-[10px]">{recentTxs.length} işlem</Badge>
            </div>
            <div className="flex flex-col gap-2">
              {recentTxs.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-2.5 p-2 rounded-md bg-gray-50 dark:bg-muted/30 cursor-pointer hover-elevate"
                  onClick={() => navigate(`/cariler/${tx.counterpartyId}`)}
                  data-testid={`row-recent-tx-${tx.id}`}
                >
                  <div className={`flex items-center justify-center w-8 h-8 rounded-md flex-shrink-0 ${txTypeBg(tx.txType)}`}>
                    {tx.txType === "sale" ? <ShoppingCart className="w-3.5 h-3.5" /> :
                     tx.txType === "collection" ? <ArrowDownToLine className="w-3.5 h-3.5" /> :
                     tx.txType === "purchase" ? <Banknote className="w-3.5 h-3.5" /> :
                     <ArrowUpFromLine className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 dark:text-foreground truncate">{tx.counterpartyName}</p>
                    <p className="text-[10px] text-gray-400 dark:text-muted-foreground">
                      {txTypeLabel(tx.txType)} - {formatDate(tx.txDate)}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-gray-900 dark:text-foreground flex-shrink-0">{formatCurrency(tx.amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Card data-testid="card-stat-customers">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-sky-50 dark:bg-sky-950/30 mx-auto mb-1.5">
              <Store className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-foreground">{statsLoading ? "-" : stats?.totalCustomers ?? 0}</p>
            <p className="text-[10px] font-medium text-gray-400 dark:text-muted-foreground">Müşteri</p>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-suppliers">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-amber-50 dark:bg-amber-950/30 mx-auto mb-1.5">
              <Truck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-foreground">{statsLoading ? "-" : stats?.totalSuppliers ?? 0}</p>
            <p className="text-[10px] font-medium text-gray-400 dark:text-muted-foreground">Tedarikçi</p>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-transactions">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-purple-50 dark:bg-purple-950/30 mx-auto mb-1.5">
              <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-foreground">{statsLoading ? "-" : stats?.totalTransactions ?? 0}</p>
            <p className="text-[10px] font-medium text-gray-400 dark:text-muted-foreground">İşlem</p>
          </CardContent>
        </Card>
      </div>

      {stats && stats.topDebtors.length > 0 && (
        <Card data-testid="card-top-debtors">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950/30">
                <Crown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-foreground">En Çok Borçlular</p>
                <p className="text-[10px] text-gray-400 dark:text-muted-foreground">Müşteri bakiyeleri</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {stats.topDebtors.map((d, i) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-md bg-gray-50 dark:bg-muted/30 cursor-pointer hover-elevate"
                  onClick={() => navigate(`/cariler/${d.id}`)}
                  data-testid={`row-debtor-${d.id}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex-shrink-0">
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">{i + 1}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-800 dark:text-foreground truncate">{d.name}</p>
                  </div>
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex-shrink-0">{formatCurrency(d.balance)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {stats && stats.topCreditors.length > 0 && (
        <Card data-testid="card-top-creditors">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-rose-50 dark:bg-rose-950/30">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-foreground">En Çok Borçlu Olduklarımız</p>
                <p className="text-[10px] text-gray-400 dark:text-muted-foreground">Tedarikçi bakiyeleri</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {stats.topCreditors.map((c, i) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-md bg-gray-50 dark:bg-muted/30 cursor-pointer hover-elevate"
                  onClick={() => navigate(`/cariler/${c.id}`)}
                  data-testid={`row-creditor-${c.id}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-rose-100 dark:bg-rose-900/40 flex-shrink-0">
                      <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300">{i + 1}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-800 dark:text-foreground truncate">{c.name}</p>
                  </div>
                  <p className="text-sm font-bold text-rose-600 dark:text-rose-400 flex-shrink-0">{formatCurrency(c.balance)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {stats && stats.upcomingPayments.length > 0 && (
        <Card data-testid="card-upcoming-payments">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-orange-50 dark:bg-orange-950/30">
                <Clock className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-foreground">Yaklaşan Ödeme Günleri</p>
                <p className="text-[10px] text-gray-400 dark:text-muted-foreground">Ayın ödeme takvimi</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {stats.upcomingPayments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-md bg-gray-50 dark:bg-muted/30 cursor-pointer hover-elevate"
                  onClick={() => navigate(`/cariler/${p.id}`)}
                  data-testid={`row-payment-${p.id}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0 ${
                      p.daysLeft <= 3 ? "bg-red-100 dark:bg-red-900/40" : "bg-orange-100 dark:bg-orange-900/40"
                    }`}>
                      <span className={`text-[10px] font-bold ${
                        p.daysLeft <= 3 ? "text-red-700 dark:text-red-300" : "text-orange-700 dark:text-orange-300"
                      }`}>{p.paymentDueDay}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-foreground truncate">{p.name}</p>
                      <p className="text-[10px] text-gray-400 dark:text-muted-foreground">
                        {p.daysLeft === 0 ? "Bugün!" : `${p.daysLeft} gün kaldı`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-700 dark:text-foreground">{formatCurrency(p.balance)}</p>
                    <Badge variant="secondary" className="text-[9px]">
                      {p.type === "customer" ? "Müşteri" : "Tedarikçi"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button
          size="lg"
          className="h-14 text-sm font-semibold gap-2"
          onClick={() => navigate("/islem-ekle")}
          data-testid="button-quick-transaction"
        >
          <Plus className="w-5 h-5" />
          Satış Ekle
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="h-14 text-sm font-semibold gap-2"
          onClick={() => navigate("/cariler")}
          data-testid="button-go-counterparties"
        >
          <Users className="w-5 h-5" />
          Cariler
          <ChevronRight className="w-4 h-4 ml-auto" />
        </Button>
      </div>
    </div>
  );
}

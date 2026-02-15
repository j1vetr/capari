import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, ShoppingCart, Plus, ChevronRight, CalendarDays,
  Users, AlertTriangle, Clock, Store, Truck, FileText, Banknote, ArrowDownToLine
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { DashboardSummary, StatsData } from "@shared/schema";

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { data, isLoading } = useQuery<DashboardSummary>({
    queryKey: ["/api/dashboard"],
  });
  const { data: stats, isLoading: statsLoading } = useQuery<StatsData>({
    queryKey: ["/api/stats"],
  });

  const today = new Date().toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const todayTotal = data
    ? parseFloat(data.todaySales || "0") + parseFloat(data.todayCollections || "0") + parseFloat(data.todayPurchases || "0") + parseFloat(data.todayPayments || "0")
    : 0;

  return (
    <div className="flex flex-col gap-4 p-4 pb-24 max-w-lg mx-auto">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-gray-400 dark:text-muted-foreground uppercase tracking-wider mb-0.5">Capari Balik</p>
          <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-foreground">Ana Sayfa</h2>
        </div>
        <div className="flex items-center gap-1.5 text-gray-400 dark:text-muted-foreground">
          <CalendarDays className="w-3.5 h-3.5" />
          <span className="text-[11px] font-medium">{today}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Card className="flex-1" data-testid="card-stat-customers">
          <CardContent className="p-3">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-sky-50 dark:bg-sky-950/30 flex-shrink-0">
                <Store className="w-4.5 h-4.5 text-sky-600 dark:text-sky-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-2xl font-bold text-gray-900 dark:text-foreground leading-tight">
                  {statsLoading ? <Skeleton className="h-7 w-8" /> : stats?.totalCustomers ?? 0}
                </p>
                <p className="text-[10px] font-semibold text-gray-400 dark:text-muted-foreground uppercase tracking-wide">Musteri</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1" data-testid="card-stat-suppliers">
          <CardContent className="p-3">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-amber-50 dark:bg-amber-950/30 flex-shrink-0">
                <Truck className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-2xl font-bold text-gray-900 dark:text-foreground leading-tight">
                  {statsLoading ? <Skeleton className="h-7 w-8" /> : stats?.totalSuppliers ?? 0}
                </p>
                <p className="text-[10px] font-semibold text-gray-400 dark:text-muted-foreground uppercase tracking-wide">Tedarikci</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <Card className="flex-1" data-testid="card-total-receivables">
          <CardContent className="p-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-emerald-50 dark:bg-emerald-950/30 mb-3">
              <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-[11px] font-semibold text-gray-400 dark:text-muted-foreground uppercase tracking-wide mb-1">Toplam Alacak</p>
            {isLoading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400" data-testid="text-total-receivables">
                {formatCurrency(data?.totalReceivables || "0")}
              </p>
            )}
            <p className="text-[10px] text-gray-400 dark:text-muted-foreground mt-1">Musterilerden alacak</p>
          </CardContent>
        </Card>
        <Card className="flex-1" data-testid="card-total-payables">
          <CardContent className="p-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-rose-50 dark:bg-rose-950/30 mb-3">
              <TrendingDown className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </div>
            <p className="text-[11px] font-semibold text-gray-400 dark:text-muted-foreground uppercase tracking-wide mb-1">Toplam Borc</p>
            {isLoading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <p className="text-xl font-bold text-rose-700 dark:text-rose-400" data-testid="text-total-payables">
                {formatCurrency(data?.totalPayables || "0")}
              </p>
            )}
            <p className="text-[10px] text-gray-400 dark:text-muted-foreground mt-1">Tedarikciler + Cariler dahil</p>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-today-sales">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-blue-50 dark:bg-blue-950/30">
                <ShoppingCart className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-foreground">Bugunun Islemleri</p>
                <p className="text-[10px] text-gray-400 dark:text-muted-foreground">
                  {new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long" })}
                </p>
              </div>
            </div>
            {!isLoading && (
              <Badge variant="secondary" className="text-[10px]">
                {formatCurrency(todayTotal)} toplam
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-md bg-emerald-50/60 dark:bg-emerald-950/20">
              <div className="flex items-center gap-1.5 mb-1">
                <ShoppingCart className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase">Satis</span>
              </div>
              {isLoading ? <Skeleton className="h-5 w-16" /> : (
                <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300" data-testid="text-today-sales">
                  {formatCurrency(data?.todaySales || "0")}
                </p>
              )}
            </div>
            <div className="p-2.5 rounded-md bg-sky-50/60 dark:bg-sky-950/20">
              <div className="flex items-center gap-1.5 mb-1">
                <ArrowDownToLine className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                <span className="text-[10px] font-semibold text-sky-700 dark:text-sky-400 uppercase">Tahsilat</span>
              </div>
              {isLoading ? <Skeleton className="h-5 w-16" /> : (
                <p className="text-sm font-bold text-sky-800 dark:text-sky-300" data-testid="text-today-collections">
                  {formatCurrency(data?.todayCollections || "0")}
                </p>
              )}
            </div>
            <div className="p-2.5 rounded-md bg-amber-50/60 dark:bg-amber-950/20">
              <div className="flex items-center gap-1.5 mb-1">
                <Banknote className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase">Alim</span>
              </div>
              {isLoading ? <Skeleton className="h-5 w-16" /> : (
                <p className="text-sm font-bold text-amber-800 dark:text-amber-300" data-testid="text-today-purchases">
                  {formatCurrency(data?.todayPurchases || "0")}
                </p>
              )}
            </div>
            <div className="p-2.5 rounded-md bg-rose-50/60 dark:bg-rose-950/20">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingDown className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                <span className="text-[10px] font-semibold text-rose-700 dark:text-rose-400 uppercase">Odeme</span>
              </div>
              {isLoading ? <Skeleton className="h-5 w-16" /> : (
                <p className="text-sm font-bold text-rose-800 dark:text-rose-300" data-testid="text-today-payments">
                  {formatCurrency(data?.todayPayments || "0")}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-check-tracking">
        <CardContent className="p-4">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-md bg-purple-50 dark:bg-purple-950/30">
              <FileText className="w-4.5 h-4.5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900 dark:text-foreground">Cek / Senet Takip</p>
              <p className="text-[10px] text-gray-400 dark:text-muted-foreground">Bekleyen cek ve senetler</p>
            </div>
          </div>

          <div className="flex gap-2 mb-3">
            <div className="flex-1 p-2.5 rounded-md bg-emerald-50/60 dark:bg-emerald-950/20">
              <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase mb-1">Aldigimiz</p>
              {isLoading ? <Skeleton className="h-5 w-16" /> : (
                <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300" data-testid="text-checks-received">
                  {formatCurrency(data?.checkStats?.totalPendingReceived || "0")}
                </p>
              )}
            </div>
            <div className="flex-1 p-2.5 rounded-md bg-rose-50/60 dark:bg-rose-950/20">
              <p className="text-[10px] font-semibold text-rose-700 dark:text-rose-400 uppercase mb-1">Verdigimiz</p>
              {isLoading ? <Skeleton className="h-5 w-16" /> : (
                <p className="text-sm font-bold text-rose-800 dark:text-rose-300" data-testid="text-checks-given">
                  {formatCurrency(data?.checkStats?.totalPendingGiven || "0")}
                </p>
              )}
            </div>
          </div>

          {data?.checkStats?.overdueCount ? (
            <div className="flex items-center gap-2 p-2.5 rounded-md bg-red-50 dark:bg-red-950/20 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-red-700 dark:text-red-300">
                  {data.checkStats.overdueCount} adet vadesi gecmis!
                </p>
                <p className="text-[10px] text-red-500 dark:text-red-400">
                  Toplam: {formatCurrency(data.checkStats.overdueTotal)}
                </p>
              </div>
            </div>
          ) : null}

          {data?.checkStats?.nearestCheck ? (
            <div className="flex items-center gap-2 p-2.5 rounded-md bg-amber-50/60 dark:bg-amber-950/20">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                  En yakin vade: {formatDate(data.checkStats.nearestCheck.dueDate)}
                </p>
                <p className="text-[10px] text-amber-500 dark:text-amber-400">
                  {data.checkStats.nearestCheck.counterpartyName} - {formatCurrency(data.checkStats.nearestCheck.amount)}
                  {" "}({data.checkStats.nearestCheck.kind === "check" ? "Cek" : "Senet"})
                  {data.checkStats.nearestCheck.daysLeft === 0 ? " - Bugun!" : ` - ${data.checkStats.nearestCheck.daysLeft} gun`}
                </p>
              </div>
            </div>
          ) : (
            !isLoading && (
              <p className="text-[11px] text-gray-400 dark:text-muted-foreground text-center py-1">Bekleyen cek/senet yok</p>
            )
          )}
        </CardContent>
      </Card>

      <Button variant="outline" className="w-full gap-1.5 text-xs font-semibold" onClick={() => navigate("/islem-ekle")} data-testid="button-quick-tx">
        <Plus className="w-4 h-4" />
        Hizli Islem Ekle
      </Button>

      {stats && stats.topDebtors.length > 0 && (
        <Card data-testid="card-top-debtors">
          <CardContent className="p-4">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-emerald-50 dark:bg-emerald-950/30">
                <TrendingUp className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900 dark:text-foreground">Bize En Cok Borclu Olanlar</p>
                <p className="text-[10px] text-gray-400 dark:text-muted-foreground">Alacakli oldugumuz cariler</p>
              </div>
              <Badge variant="secondary" className="text-[10px]">{stats.topDebtors.length}</Badge>
            </div>
            <div className="flex flex-col gap-1.5">
              {stats.topDebtors.map((d, i) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-md bg-gray-50 dark:bg-muted/30 cursor-pointer hover-elevate"
                  onClick={() => navigate(`/cariler/${d.id}`)}
                  data-testid={`row-debtor-${d.id}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex-shrink-0">
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">{i + 1}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-foreground truncate">{d.name}</p>
                      <Badge variant="secondary" className="text-[9px] mt-0.5">
                        {d.type === "customer" ? "Musteri" : "Tedarikci"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(d.balance)}</p>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {stats && stats.topCreditors.length > 0 && (
        <Card data-testid="card-top-creditors">
          <CardContent className="p-4">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-rose-50 dark:bg-rose-950/30">
                <TrendingDown className="w-4.5 h-4.5 text-rose-600 dark:text-rose-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900 dark:text-foreground">En Borclullarimiz</p>
                <p className="text-[10px] text-gray-400 dark:text-muted-foreground">Borclu oldugumuz cariler</p>
              </div>
              <Badge variant="secondary" className="text-[10px]">{stats.topCreditors.length}</Badge>
            </div>
            <div className="flex flex-col gap-1.5">
              {stats.topCreditors.map((c, i) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-md bg-gray-50 dark:bg-muted/30 cursor-pointer hover-elevate"
                  onClick={() => navigate(`/cariler/${c.id}`)}
                  data-testid={`row-creditor-${c.id}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-rose-100 dark:bg-rose-900/40 flex-shrink-0">
                      <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300">{i + 1}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-foreground truncate">{c.name}</p>
                      <Badge variant="secondary" className="text-[9px] mt-0.5">
                        {c.type === "customer" ? "Musteri" : "Tedarikci"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{formatCurrency(c.balance)}</p>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {stats && stats.upcomingPayments.length > 0 && (
        <Card data-testid="card-upcoming-payments">
          <CardContent className="p-4">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-orange-50 dark:bg-orange-950/30">
                <Clock className="w-4.5 h-4.5 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900 dark:text-foreground">Yaklasan Odeme Gunleri</p>
                <p className="text-[10px] text-gray-400 dark:text-muted-foreground">Ayin odeme takvimi</p>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              {stats.upcomingPayments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-md bg-gray-50 dark:bg-muted/30 cursor-pointer hover-elevate"
                  onClick={() => navigate(`/cariler/${p.id}`)}
                  data-testid={`row-payment-${p.id}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
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
                        {p.daysLeft === 0 ? "Bugun!" : `${p.daysLeft} gun kaldi`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-700 dark:text-foreground">{formatCurrency(p.balance)}</p>
                    <Badge variant="secondary" className="text-[9px]">
                      {p.type === "customer" ? "Musteri" : "Tedarikci"}
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
          className="gap-2"
          onClick={() => navigate("/islem-ekle")}
          data-testid="button-quick-transaction"
        >
          <Plus className="w-5 h-5" />
          Satis Ekle
        </Button>
        <Button
          variant="outline"
          className="gap-2"
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

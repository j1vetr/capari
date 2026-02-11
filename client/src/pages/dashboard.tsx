import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, ShoppingCart, ArrowDownToLine,
  Banknote, ArrowUpFromLine, Plus, ChevronRight, CalendarDays, Users
} from "lucide-react";
import { formatCurrency, formatDate, txTypeLabel, txTypeColor, txTypeBg } from "@/lib/formatters";
import type { DashboardSummary } from "@shared/schema";
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

      <div className="grid grid-cols-2 gap-3">
        <Button
          size="lg"
          className="h-14 text-sm font-semibold gap-2"
          onClick={() => navigate("/quick")}
          data-testid="button-quick-transaction"
        >
          <Plus className="w-5 h-5" />
          Satış Ekle
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="h-14 text-sm font-semibold gap-2"
          onClick={() => navigate("/counterparties")}
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

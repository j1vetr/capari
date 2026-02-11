import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, ArrowDownToLine, ArrowUpFromLine, ShoppingCart, Banknote, Zap } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { DashboardSummary } from "@shared/schema";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

function StatCard({ title, value, icon: Icon, color, isLoading }: {
  title: string;
  value: string;
  icon: any;
  color: string;
  isLoading: boolean;
}) {
  return (
    <Card data-testid={`card-stat-${title.toLowerCase().replace(/\s/g, "-")}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center w-10 h-10 rounded-md ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{title}</p>
            {isLoading ? (
              <Skeleton className="h-6 w-24 mt-1" />
            ) : (
              <p className="text-lg font-semibold tracking-tight truncate" data-testid={`text-value-${title.toLowerCase().replace(/\s/g, "-")}`}>
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

  const chartData = data?.last7DaysSales?.map((d) => ({
    date: new Date(d.date).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" }),
    total: parseFloat(d.total),
  })) || [];

  return (
    <div className="flex flex-col gap-4 p-4 pb-24 max-w-lg mx-auto">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Ana Sayfa</h1>
          <p className="text-sm text-muted-foreground">Genel bakış</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          title="Toplam Alacak"
          value={data?.totalReceivables || "0"}
          icon={TrendingUp}
          color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
          isLoading={isLoading}
        />
        <StatCard
          title="Toplam Borç"
          value={data?.totalPayables || "0"}
          icon={TrendingDown}
          color="bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400"
          isLoading={isLoading}
        />
        <StatCard
          title="Bugün Satış"
          value={data?.todaySales || "0"}
          icon={ShoppingCart}
          color="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
          isLoading={isLoading}
        />
        <StatCard
          title="Bugün Tahsilat"
          value={data?.todayCollections || "0"}
          icon={ArrowDownToLine}
          color="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          isLoading={isLoading}
        />
        <StatCard
          title="Bugün Alım"
          value={data?.todayPurchases || "0"}
          icon={Banknote}
          color="bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
          isLoading={isLoading}
        />
        <StatCard
          title="Bugün Ödeme"
          value={data?.todayPayments || "0"}
          icon={ArrowUpFromLine}
          color="bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
          isLoading={isLoading}
        />
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium text-muted-foreground mb-3">Son 7 Gün Satış</p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <Tooltip
                    formatter={(v: number) => [formatCurrency(v), "Satış"]}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Button
        size="lg"
        className="w-full h-14 text-lg font-semibold gap-2"
        onClick={() => navigate("/quick")}
        data-testid="button-quick-transaction"
      >
        <Zap className="w-5 h-5" />
        Hızlı İşlem
      </Button>
    </div>
  );
}

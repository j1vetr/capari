import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Users, Truck, Store, ChevronRight, Phone, UserPlus, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { CounterpartyWithBalance } from "@shared/schema";

export default function Counterparties() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"customer" | "supplier">("customer");
  const [search, setSearch] = useState("");

  const { data: parties, isLoading } = useQuery<CounterpartyWithBalance[]>({
    queryKey: ["/api/counterparties"],
  });

  const filtered = parties
    ?.filter((p) => p.type === tab)
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, "tr")) || [];

  const totalBalance = filtered.reduce((s, p) => s + parseFloat(p.balance), 0);
  const count = filtered.length;

  return (
    <div className="flex flex-col gap-4 p-4 pb-24 max-w-lg mx-auto">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-gray-400 dark:text-muted-foreground uppercase tracking-wider mb-0.5">Cari Hesaplar</p>
          <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-foreground">Firmalar</h2>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate("/quick")} data-testid="button-add-party">
          <UserPlus className="w-4 h-4" />
          Yeni Ekle
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
        <TabsList className="w-full grid grid-cols-2 h-11">
          <TabsTrigger value="customer" className="gap-2 text-sm font-semibold" data-testid="tab-customers">
            <Store className="w-4 h-4" />
            Müşteriler
          </TabsTrigger>
          <TabsTrigger value="supplier" className="gap-2 text-sm font-semibold" data-testid="tab-suppliers">
            <Truck className="w-4 h-4" />
            Tedarikçiler
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className={`border-0 ${tab === "customer"
        ? "bg-emerald-50 dark:bg-emerald-950/20"
        : "bg-rose-50 dark:bg-rose-950/20"
        }`}>
        <CardContent className="p-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-muted-foreground">
              {count} {tab === "customer" ? "müşteri" : "tedarikçi"}
            </p>
            <p className="text-xs text-gray-400 dark:text-muted-foreground">
              {tab === "customer" ? "toplam alacak" : "toplam borç"}
            </p>
          </div>
          <p className={`text-lg font-bold ${tab === "customer"
            ? "text-emerald-700 dark:text-emerald-400"
            : "text-rose-700 dark:text-rose-400"
            }`}>
            {formatCurrency(totalBalance)}
          </p>
        </CardContent>
      </Card>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-muted-foreground" />
        <Input
          placeholder={`${tab === "customer" ? "Müşteri" : "Tedarikçi"} ara...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-white dark:bg-card"
          data-testid="input-search-parties"
        />
      </div>

      <div className="flex flex-col gap-2">
        {isLoading && Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-3 flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-md" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-1.5" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-5 w-20" />
            </CardContent>
          </Card>
        ))}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-12">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-gray-100 dark:bg-muted mx-auto mb-3">
              {tab === "customer"
                ? <Store className="w-6 h-6 text-gray-400 dark:text-muted-foreground" />
                : <Truck className="w-6 h-6 text-gray-400 dark:text-muted-foreground" />}
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-muted-foreground">
              {search ? `"${search}" bulunamadı` : tab === "customer" ? "Henüz müşteri eklenmemiş" : "Henüz tedarikçi eklenmemiş"}
            </p>
            <p className="text-xs text-gray-400 dark:text-muted-foreground mt-1">İşlem Ekle sayfasından yeni firma ekleyebilirsiniz</p>
          </div>
        )}

        {filtered.map((p) => {
          const bal = parseFloat(p.balance);
          return (
            <Card
              key={p.id}
              className="hover-elevate active-elevate-2 cursor-pointer"
              onClick={() => navigate(`/counterparties/${p.id}`)}
              data-testid={`card-party-${p.id}`}
            >
              <CardContent className="p-3 flex items-center gap-3">
                <div className={`flex items-center justify-center w-10 h-10 rounded-md flex-shrink-0 ${tab === "customer"
                  ? "bg-sky-50 dark:bg-sky-950/30"
                  : "bg-amber-50 dark:bg-amber-950/30"
                  }`}>
                  <span className="text-sm font-bold text-gray-500 dark:text-muted-foreground">
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-semibold text-sm text-gray-900 dark:text-foreground truncate">{p.name}</p>
                    {p.invoiced && (
                      <Badge variant="secondary" className="text-[9px] gap-0.5 px-1.5">
                        <FileText className="w-2.5 h-2.5" />
                        Faturalı
                      </Badge>
                    )}
                  </div>
                  {p.phone && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3 text-gray-400 dark:text-muted-foreground" />
                      <span className="text-[11px] text-gray-400 dark:text-muted-foreground">{p.phone}</span>
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold ${bal > 0
                    ? tab === "customer" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    : bal < 0
                      ? tab === "customer" ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                      : "text-gray-400 dark:text-muted-foreground"
                    }`}>
                    {formatCurrency(Math.abs(bal))}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-muted-foreground">
                    {bal > 0
                      ? tab === "customer" ? "alacak" : "borç"
                      : bal < 0
                        ? tab === "customer" ? "borç" : "alacak"
                        : "dengeli"}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 dark:text-muted-foreground flex-shrink-0" />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

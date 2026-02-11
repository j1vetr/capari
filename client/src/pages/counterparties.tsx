import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Users, Truck } from "lucide-react";
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

  return (
    <div className="flex flex-col gap-4 p-4 pb-24 max-w-lg mx-auto">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Cariler</h1>
        <p className="text-sm text-muted-foreground">Müşteri ve tedarikçi listesi</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="customer" className="gap-2" data-testid="tab-customers">
            <Users className="w-4 h-4" />
            Müşteriler
          </TabsTrigger>
          <TabsTrigger value="supplier" className="gap-2" data-testid="tab-suppliers">
            <Truck className="w-4 h-4" />
            Tedarikçiler
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
          data-testid="input-search-parties"
        />
      </div>

      <div className="flex flex-col gap-2">
        {isLoading && Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-3">
              <Skeleton className="h-5 w-32 mb-1" />
              <Skeleton className="h-4 w-20" />
            </CardContent>
          </Card>
        ))}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">
              {search ? "Sonuç bulunamadı" : tab === "customer" ? "Henüz müşteri yok" : "Henüz tedarikçi yok"}
            </p>
          </div>
        )}

        {filtered.map((p) => {
          const bal = parseFloat(p.balance);
          return (
            <Card
              key={p.id}
              className="hover-elevate cursor-pointer"
              onClick={() => navigate(`/counterparties/${p.id}`)}
              data-testid={`card-party-${p.id}`}
            >
              <CardContent className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.name}</p>
                  {p.phone && <p className="text-xs text-muted-foreground">{p.phone}</p>}
                </div>
                <p className={`text-sm font-semibold whitespace-nowrap ${bal > 0
                  ? tab === "customer" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  : bal < 0
                    ? tab === "customer" ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground"
                  }`}>
                  {formatCurrency(bal)}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

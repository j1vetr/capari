import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Search, Users, Truck, Store, ChevronRight, Phone, UserPlus, FileText,
  Upload, CheckCircle2, AlertCircle, X
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { CounterpartyWithBalance } from "@shared/schema";

export default function Counterparties() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [tab, setTab] = useState<"customer" | "supplier">("customer");
  const [search, setSearch] = useState("");

  const [showBulk, setShowBulk] = useState(false);
  const [bulkType, setBulkType] = useState<"customer" | "supplier">("customer");
  const [bulkText, setBulkText] = useState("");
  const [bulkResult, setBulkResult] = useState<{
    summary: { created: number; balanceAdded?: number; existed: number; errors: number; total: number };
    results: { name: string; status: string }[];
  } | null>(null);

  const { data: parties, isLoading } = useQuery<CounterpartyWithBalance[]>({
    queryKey: ["/api/counterparties"],
  });

  const filtered = parties
    ?.filter((p) => p.type === tab)
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, "tr")) || [];

  const totalBalance = filtered.reduce((s, p) => s + parseFloat(p.balance), 0);
  const count = filtered.length;

  const parseBulkText = (text: string): { name: string; type: "customer" | "supplier"; openingBalance?: number; balanceDirection?: "aldik" | "verdik"; txDate?: string }[] => {
    const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    return lines.map(line => {
      const parts = line.split(",").map(p => p.trim());
      const name = parts[0] || "";
      const balanceStr = parts[1] || "";
      const dirStr = (parts[2] || "").toLowerCase();
      const dateStr = parts[3] || "";
      const balance = parseFloat(balanceStr);
      let direction: "aldik" | "verdik" | undefined;
      if (dirStr.startsWith("ver") || dirStr === "verdik" || dirStr === "v") {
        direction = "verdik";
      } else if (dirStr.startsWith("al") || dirStr === "aldik" || dirStr === "a") {
        direction = "aldik";
      }
      let txDate: string | undefined;
      if (dateStr) {
        const dotMatch = dateStr.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
        const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (dotMatch) {
          txDate = `${dotMatch[3]}-${dotMatch[2].padStart(2, "0")}-${dotMatch[1].padStart(2, "0")}`;
        } else if (isoMatch) {
          txDate = dateStr;
        }
      }
      return {
        name,
        type: bulkType,
        openingBalance: !isNaN(balance) && balance > 0 ? balance : undefined,
        balanceDirection: direction,
        txDate,
      };
    }).filter(item => item.name.length > 0);
  };

  const bulkMutation = useMutation({
    mutationFn: async (counterparties: { name: string; type: string; openingBalance?: number; balanceDirection?: string; txDate?: string }[]) => {
      const res = await apiRequest("POST", "/api/counterparties/bulk", { counterparties });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/counterparties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setBulkResult(data);
      const parts = [];
      if (data.summary.balanceAdded > 0) parts.push(`${data.summary.balanceAdded} mevcut cariye bakiye eklendi`);
      if (data.summary.existed > 0) parts.push(`${data.summary.existed} zaten mevcut (atlandı)`);
      toast({
        title: `${data.summary.created} cari eklendi`,
        description: parts.length > 0 ? parts.join(", ") : undefined,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const handleBulkImport = () => {
    const parsed = parseBulkText(bulkText);
    if (parsed.length === 0) {
      toast({ title: "Eklenecek cari bulunamadı", description: "Her satıra bir cari yazın", variant: "destructive" });
      return;
    }
    setBulkResult(null);
    bulkMutation.mutate(parsed);
  };

  return (
    <div className="flex flex-col gap-4 p-4 pb-24 max-w-lg mx-auto">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-gray-400 dark:text-muted-foreground uppercase tracking-wider mb-0.5">Cari Hesaplar</p>
          <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-foreground">Firmalar</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => { setShowBulk(true); setBulkType(tab); setBulkText(""); setBulkResult(null); }}
            data-testid="button-bulk-import-parties"
          >
            <Upload className="w-4 h-4" />
            Toplu Aktar
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate("/islem-ekle")} data-testid="button-add-party">
            <UserPlus className="w-4 h-4" />
            Yeni Ekle
          </Button>
        </div>
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
              onClick={() => navigate(`/cariler/${p.id}`)}
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

      <Dialog open={showBulk} onOpenChange={(open) => { setShowBulk(open); if (!open) setBulkResult(null); }}>
        <DialogContent className="max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-sky-600" />
              Toplu Cari Aktarımı
            </DialogTitle>
            <DialogDescription>Eski defterden carileri toplu olarak ekleyin</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 flex-1 overflow-hidden">
            <div className="flex gap-1 p-0.5 rounded-md bg-muted/60">
              <button
                className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 ${bulkType === "customer" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
                onClick={() => setBulkType("customer")}
                data-testid="bulk-tab-customer"
              >
                <Store className="w-3.5 h-3.5" />
                Müşteri
              </button>
              <button
                className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 ${bulkType === "supplier" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
                onClick={() => setBulkType("supplier")}
                data-testid="bulk-tab-supplier"
              >
                <Truck className="w-3.5 h-3.5" />
                Tedarikçi
              </button>
            </div>

            <Card className="bg-sky-50/50 dark:bg-sky-950/10 border-sky-200/50 dark:border-sky-800/50">
              <CardContent className="p-3">
                <p className="text-xs font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wider mb-1">Format</p>
                <p className="text-xs text-gray-500 dark:text-muted-foreground leading-relaxed">
                  Her satıra: <strong>Ad, Bakiye, aldık/verdik, Tarih</strong> yazın. Stok etkilemez.
                </p>
                <div className="mt-2 p-2 rounded-md bg-white dark:bg-card border border-dashed border-gray-200 dark:border-muted">
                  <p className="text-[11px] text-gray-400 dark:text-muted-foreground font-mono leading-relaxed">
                    {bulkType === "customer" ? (
                      <>Ahmet Balıkçılık,50000,aldık,15.06.2024<br/>Ahmet Balıkçılık,25000,verdik,01.12.2024<br/>Deniz Market,3200,aldık<br/>Sahil Restaurant</>
                    ) : (
                      <>Karadeniz Su Ürünleri,80000,aldık,10.03.2024<br/>Karadeniz Su Ürünleri,40000,verdik,20.08.2024<br/>Marmara Balık,4500,aldık</>
                    )}
                  </p>
                </div>
                <p className="text-[10px] text-sky-600 dark:text-sky-400 mt-1">
                  Aynı cariyi birden fazla satırda yazabilirsiniz (hem aldık hem verdik)
                </p>
                <p className="text-[10px] text-gray-400 dark:text-muted-foreground">
                  Tarih: GG.AA.YYYY veya YYYY-AA-GG. Yazmazsanız bugünün tarihi kullanılır.
                </p>
                <div className="mt-1.5 flex flex-col gap-0.5">
                  <p className="text-[10px] text-gray-500 dark:text-muted-foreground">
                    {bulkType === "customer"
                      ? <><strong>aldık</strong> = müşteriden mal aldı, bize borcu var (alacak)</>
                      : <><strong>aldık</strong> = tedarikçiden mal aldık, biz borçluyuz</>}
                  </p>
                  <p className="text-[10px] text-gray-500 dark:text-muted-foreground">
                    {bulkType === "customer"
                      ? <><strong>verdik</strong> = müşteriye ödeme yaptık / fazla tahsilat</>
                      : <><strong>verdik</strong> = tedarikçiye ödeme yaptık</>}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-muted-foreground">
                    Belirtmezseniz varsayılan: <strong>aldık</strong>
                  </p>
                </div>
              </CardContent>
            </Card>

            <div>
              <Label className="text-xs font-medium mb-1.5 block text-gray-600 dark:text-muted-foreground">
                {bulkType === "customer" ? "Müşteri" : "Tedarikçi"} Listesi
              </Label>
              <Textarea
                placeholder={bulkType === "customer"
                  ? "Ahmet Balıkçılık,50000,aldık,15.06.2024\nAhmet Balıkçılık,25000,verdik,01.12.2024\nDeniz Market,3200,aldık\nSahil Restaurant"
                  : "Karadeniz Su Ürünleri,80000,aldık,10.03.2024\nKaradeniz Su Ürünleri,40000,verdik,20.08.2024\nMarmara Balık,4500,aldık"
                }
                value={bulkText}
                onChange={(e) => { setBulkText(e.target.value); setBulkResult(null); }}
                className="text-sm font-mono min-h-[140px] resize-none"
                data-testid="textarea-bulk-parties"
              />
              {bulkText.trim() && (
                <p className="text-[11px] text-gray-400 dark:text-muted-foreground mt-1">
                  {parseBulkText(bulkText).length} cari algılandı
                </p>
              )}
            </div>

            {bulkResult && (
              <Card className="border-green-200/60 dark:border-green-800/40 bg-green-50/40 dark:bg-green-950/10">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <div className="text-xs flex-1 min-w-0">
                      <p className="font-semibold text-green-800 dark:text-green-300">
                        {bulkResult.summary.created} cari eklendi
                      </p>
                      {(bulkResult.summary.balanceAdded || 0) > 0 && (
                        <p className="text-sky-600 dark:text-sky-400 mt-0.5">
                          {bulkResult.summary.balanceAdded} mevcut cariye bakiye eklendi
                        </p>
                      )}
                      {bulkResult.summary.existed > 0 && (
                        <p className="text-gray-500 dark:text-muted-foreground mt-0.5">
                          {bulkResult.summary.existed} zaten mevcut (atlandı)
                        </p>
                      )}
                      {bulkResult.summary.errors > 0 && (
                        <p className="text-red-500 mt-0.5">
                          {bulkResult.summary.errors} hata oluştu
                        </p>
                      )}
                      <div className="mt-2 flex flex-col gap-0.5 max-h-[120px] overflow-y-auto">
                        {bulkResult.results.map((r, i) => {
                          const label = r.status === "created" ? "Eklendi"
                            : r.status === "balance_added" ? "Bakiye eklendi"
                            : r.status === "exists" ? "Zaten mevcut"
                            : "Hata";
                          const color = r.status === "created" ? "text-green-700 dark:text-green-300"
                            : r.status === "balance_added" ? "text-sky-600 dark:text-sky-400"
                            : r.status === "exists" ? "text-amber-600 dark:text-amber-400"
                            : "text-red-600 dark:text-red-400";
                          return (
                            <div key={i} className="flex items-center gap-1.5">
                              {r.status === "created" && <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />}
                              {r.status === "balance_added" && <CheckCircle2 className="w-3 h-3 text-sky-500 flex-shrink-0" />}
                              {r.status === "exists" && <AlertCircle className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                              {r.status === "error" && <X className="w-3 h-3 text-red-500 flex-shrink-0" />}
                              <span className={`text-[11px] truncate ${color}`}>
                                {r.name} - {label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-2">
              <Button
                className="flex-1 gap-1.5"
                onClick={handleBulkImport}
                disabled={bulkMutation.isPending || !bulkText.trim()}
                data-testid="button-submit-bulk-parties"
              >
                <Upload className="w-4 h-4" />
                {bulkMutation.isPending ? "Ekleniyor..." : "Toplu Ekle"}
              </Button>
              {bulkResult && (
                <Button
                  variant="outline"
                  onClick={() => { setBulkText(""); setBulkResult(null); }}
                  data-testid="button-clear-bulk-parties"
                >
                  Temizle
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

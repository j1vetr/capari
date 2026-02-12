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
    summary: { added: number; notFound: number; errors: number; total: number };
    results: { name: string; status: string; message?: string }[];
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

  const parseBulkTransactions = (text: string): { name: string; amount: number; direction: "aldik" | "verdik"; txDate?: string }[] => {
    const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    const results: { name: string; amount: number; direction: "aldik" | "verdik"; txDate?: string }[] = [];
    for (const line of lines) {
      const parts = line.split(",").map(p => p.trim());
      const name = parts[0] || "";
      if (!name) continue;
      const amountStr = parts[1] || "";
      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) continue;
      const dirStr = (parts[2] || "aldik").toLowerCase();
      let direction: "aldik" | "verdik" = "aldik";
      if (dirStr.startsWith("ver") || dirStr === "verdik" || dirStr === "v") {
        direction = "verdik";
      }
      let txDate: string | undefined;
      const dateStr = parts[3] || "";
      if (dateStr) {
        const dotMatch = dateStr.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
        const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (dotMatch) {
          txDate = `${dotMatch[3]}-${dotMatch[2].padStart(2, "0")}-${dotMatch[1].padStart(2, "0")}`;
        } else if (isoMatch) {
          txDate = dateStr;
        }
      }
      results.push({ name, amount, direction, txDate });
    }
    return results;
  };

  const bulkMutation = useMutation({
    mutationFn: async (data: { type: "customer" | "supplier"; transactions: { name: string; amount: number; direction: "aldik" | "verdik"; txDate?: string }[] }) => {
      const res = await apiRequest("POST", "/api/counterparties/bulk-transactions", data);
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
      if (data.summary.added > 0) parts.push(`${data.summary.added} işlem eklendi`);
      if (data.summary.notFound > 0) parts.push(`${data.summary.notFound} cari bulunamadı`);
      if (data.summary.errors > 0) parts.push(`${data.summary.errors} hata`);
      toast({
        title: parts.join(", "),
        variant: data.summary.notFound > 0 ? "destructive" : undefined,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const handleBulkImport = () => {
    const parsed = parseBulkTransactions(bulkText);
    if (parsed.length === 0) {
      toast({ title: "Geçerli işlem bulunamadı", description: "Her satıra: Ad, Tutar, aldık/verdik yazın", variant: "destructive" });
      return;
    }
    setBulkResult(null);
    bulkMutation.mutate({ type: bulkType, transactions: parsed });
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
              Toplu İşlem Aktarımı
            </DialogTitle>
            <DialogDescription>Mevcut carilere eski defterden işlemleri toplu ekleyin</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 flex-1 overflow-hidden">
            <div className="flex gap-1 p-0.5 rounded-md bg-muted/60">
              <button
                className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 ${bulkType === "customer" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
                onClick={() => { setBulkType("customer"); setBulkResult(null); }}
                data-testid="bulk-tab-customer"
              >
                <Store className="w-3.5 h-3.5" />
                Müşteri
              </button>
              <button
                className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 ${bulkType === "supplier" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
                onClick={() => { setBulkType("supplier"); setBulkResult(null); }}
                data-testid="bulk-tab-supplier"
              >
                <Truck className="w-3.5 h-3.5" />
                Tedarikçi
              </button>
            </div>

            <Card className="bg-amber-50/50 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-800/50">
              <CardContent className="p-2.5">
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Carileri önce tek tek "Yeni Ekle" ile açın, sonra buradan işlemlerini toplu aktarın. Cari adı sistemde birebir eşleşmelidir.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-sky-50/50 dark:bg-sky-950/10 border-sky-200/50 dark:border-sky-800/50">
              <CardContent className="p-3">
                <p className="text-xs font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wider mb-1">Format</p>
                <p className="text-xs text-gray-500 dark:text-muted-foreground leading-relaxed">
                  Her satıra: <strong>Cari Adı, Tutar, aldık/verdik, Tarih</strong>. Stok etkilemez.
                </p>
                <div className="mt-2 p-2 rounded-md bg-white dark:bg-card border border-dashed border-gray-200 dark:border-muted">
                  <p className="text-[11px] text-gray-400 dark:text-muted-foreground font-mono leading-relaxed">
                    {bulkType === "customer" ? (
                      <>Ahmet Balıkçılık,50000,aldık,15.06.2024<br/>Ahmet Balıkçılık,25000,verdik,01.12.2024<br/>Deniz Market,3200,aldık</>
                    ) : (
                      <>Karadeniz Su Ürünleri,80000,aldık,10.03.2024<br/>Karadeniz Su Ürünleri,40000,verdik,20.08.2024<br/>Marmara Balık,4500,aldık</>
                    )}
                  </p>
                </div>
                <p className="text-[10px] text-gray-400 dark:text-muted-foreground mt-1">
                  Tarih: GG.AA.YYYY veya YYYY-AA-GG. Yazmazsanız bugünün tarihi kullanılır.
                </p>
                <div className="mt-1.5 flex flex-col gap-0.5">
                  <p className="text-[10px] text-gray-500 dark:text-muted-foreground">
                    {bulkType === "customer"
                      ? <><strong>aldık</strong> = müşteri mal aldı, bize borçlu</>
                      : <><strong>aldık</strong> = tedarikçiden mal aldık, biz borçluyuz</>}
                  </p>
                  <p className="text-[10px] text-gray-500 dark:text-muted-foreground">
                    {bulkType === "customer"
                      ? <><strong>verdik</strong> = müşteri ödeme yaptı / tahsilat</>
                      : <><strong>verdik</strong> = tedarikçiye ödeme yaptık</>}
                  </p>
                </div>
              </CardContent>
            </Card>

            <div>
              <Label className="text-xs font-medium mb-1.5 block text-gray-600 dark:text-muted-foreground">
                İşlem Listesi
              </Label>
              <Textarea
                placeholder={bulkType === "customer"
                  ? "Ahmet Balıkçılık,50000,aldık,15.06.2024\nAhmet Balıkçılık,25000,verdik,01.12.2024\nDeniz Market,3200,aldık"
                  : "Karadeniz Su Ürünleri,80000,aldık,10.03.2024\nKaradeniz Su Ürünleri,40000,verdik,20.08.2024\nMarmara Balık,4500,aldık"
                }
                value={bulkText}
                onChange={(e) => { setBulkText(e.target.value); setBulkResult(null); }}
                className="text-sm font-mono min-h-[140px] resize-none"
                data-testid="textarea-bulk-parties"
              />
              {bulkText.trim() && (
                <p className="text-[11px] text-gray-400 dark:text-muted-foreground mt-1">
                  {parseBulkTransactions(bulkText).length} işlem algılandı
                </p>
              )}
            </div>

            {bulkResult && (
              <Card className={`${bulkResult.summary.notFound > 0 ? "border-amber-200/60 dark:border-amber-800/40 bg-amber-50/40 dark:bg-amber-950/10" : "border-green-200/60 dark:border-green-800/40 bg-green-50/40 dark:bg-green-950/10"}`}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    {bulkResult.summary.notFound > 0
                      ? <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                      : <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />}
                    <div className="text-xs flex-1 min-w-0">
                      {bulkResult.summary.added > 0 && (
                        <p className="font-semibold text-green-800 dark:text-green-300">
                          {bulkResult.summary.added} işlem başarıyla eklendi
                        </p>
                      )}
                      {bulkResult.summary.notFound > 0 && (
                        <p className="text-amber-600 dark:text-amber-400 mt-0.5 font-medium">
                          {bulkResult.summary.notFound} cari sistemde bulunamadı
                        </p>
                      )}
                      {bulkResult.summary.errors > 0 && (
                        <p className="text-red-500 mt-0.5">
                          {bulkResult.summary.errors} hata oluştu
                        </p>
                      )}
                      <div className="mt-2 flex flex-col gap-0.5 max-h-[120px] overflow-y-auto">
                        {bulkResult.results.map((r, i) => {
                          const label = r.status === "added" ? "Eklendi"
                            : r.status === "not_found" ? "Cari bulunamadı"
                            : "Hata";
                          const color = r.status === "added" ? "text-green-700 dark:text-green-300"
                            : r.status === "not_found" ? "text-amber-600 dark:text-amber-400"
                            : "text-red-600 dark:text-red-400";
                          return (
                            <div key={i} className="flex items-center gap-1.5">
                              {r.status === "added" && <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />}
                              {r.status === "not_found" && <AlertCircle className="w-3 h-3 text-amber-500 flex-shrink-0" />}
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
                {bulkMutation.isPending ? "Aktarılıyor..." : "İşlemleri Aktar"}
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

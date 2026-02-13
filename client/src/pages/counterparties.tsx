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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Upload, CheckCircle2, AlertCircle, X, Plus, Trash2, Check
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { CounterpartyWithBalance } from "@shared/schema";

type CheckEntry = {
  id: number;
  kind: "check" | "note";
  direction: "received" | "given";
  amount: string;
  dueDate: string;
  receivedDate: string;
  notes: string;
};

let nextCheckId = 1;
function emptyCheckEntry(): CheckEntry {
  return { id: nextCheckId++, kind: "check", direction: "received", amount: "", dueDate: "", receivedDate: "", notes: "" };
}

export default function Counterparties() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [tab, setTab] = useState<"customer" | "supplier">("customer");
  const [search, setSearch] = useState("");

  const [showBulk, setShowBulk] = useState(false);
  const [bulkType, setBulkType] = useState<"customer" | "supplier">("customer");
  const [bulkPartyId, setBulkPartyId] = useState<string>("");
  const [bulkText, setBulkText] = useState("");
  const [bulkResult, setBulkResult] = useState<{
    summary: { added: number; errors: number; total: number };
  } | null>(null);

  const [showBulkChecks, setShowBulkChecks] = useState(false);
  const [bulkCheckType, setBulkCheckType] = useState<"customer" | "supplier">("customer");
  const [bulkCheckPartyId, setBulkCheckPartyId] = useState<string>("");
  const [checkEntries, setCheckEntries] = useState<CheckEntry[]>([emptyCheckEntry()]);
  const [checkSaving, setCheckSaving] = useState(false);

  const { data: parties, isLoading } = useQuery<CounterpartyWithBalance[]>({
    queryKey: ["/api/counterparties"],
  });

  const filtered = parties
    ?.filter((p) => p.type === tab)
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, "tr")) || [];

  const totalBalance = filtered.reduce((s, p) => s + parseFloat(p.balance), 0);
  const count = filtered.length;

  const bulkParties = parties?.filter(p => p.type === bulkType).sort((a, b) => a.name.localeCompare(b.name, "tr")) || [];
  const bulkCheckParties = parties?.filter(p => p.type === bulkCheckType).sort((a, b) => a.name.localeCompare(b.name, "tr")) || [];

  const parseBulkTransactions = (text: string): { amount: number; direction: "aldik" | "verdik"; txDate?: string; description?: string }[] => {
    const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    const results: { amount: number; direction: "aldik" | "verdik"; txDate?: string; description?: string }[] = [];
    for (const line of lines) {
      const parts = line.split(",").map(p => p.trim());
      const amountStr = parts[0] || "";
      const amount = parseFloat(amountStr.replace(/\./g, "").replace(",", "."));
      if (isNaN(amount) || amount <= 0) continue;
      const dirStr = (parts[1] || "verdik").toLowerCase();
      let direction: "aldik" | "verdik" = "verdik";
      if (dirStr.startsWith("al") || dirStr === "aldik" || dirStr === "a") {
        direction = "aldik";
      }
      let txDate: string | undefined;
      const dateStr = parts[2] || "";
      if (dateStr) {
        const dotMatch = dateStr.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
        const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (dotMatch) {
          txDate = `${dotMatch[3]}-${dotMatch[2].padStart(2, "0")}-${dotMatch[1].padStart(2, "0")}`;
        } else if (isoMatch) {
          txDate = dateStr;
        }
      }
      const description = parts[3]?.trim() || undefined;
      results.push({ amount, direction, txDate, description });
    }
    return results;
  };

  const bulkMutation = useMutation({
    mutationFn: async (data: { counterpartyId: string; transactions: { amount: number; direction: "aldik" | "verdik"; txDate?: string; description?: string }[] }) => {
      const res = await apiRequest("POST", `/api/counterparties/${data.counterpartyId}/bulk-transactions`, { transactions: data.transactions });
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
      toast({
        title: `${data.summary.added} işlem başarıyla eklendi`,
        description: data.summary.errors > 0 ? `${data.summary.errors} hata oluştu` : undefined,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const handleBulkImport = () => {
    if (!bulkPartyId) {
      toast({ title: "Cari seçin", description: "Lütfen işlem eklenecek cariyi seçin", variant: "destructive" });
      return;
    }
    const parsed = parseBulkTransactions(bulkText);
    if (parsed.length === 0) {
      toast({ title: "Geçerli işlem bulunamadı", description: "Her satıra: Tutar, aldık/verdik yazın", variant: "destructive" });
      return;
    }
    setBulkResult(null);
    bulkMutation.mutate({ counterpartyId: bulkPartyId, transactions: parsed });
  };

  const addCheckEntry = () => {
    const last = checkEntries[checkEntries.length - 1];
    setCheckEntries([...checkEntries, { ...emptyCheckEntry(), kind: last.kind, direction: last.direction }]);
  };

  const removeCheckEntry = (id: number) => {
    if (checkEntries.length <= 1) return;
    setCheckEntries(checkEntries.filter(e => e.id !== id));
  };

  const updateCheckEntry = (id: number, field: keyof CheckEntry, value: string) => {
    setCheckEntries(checkEntries.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const checkTotalAmount = checkEntries.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const validCheckEntries = checkEntries.filter(e => parseFloat(e.amount) > 0 && e.dueDate);

  const handleSaveChecks = async () => {
    if (!bulkCheckPartyId) return;
    if (validCheckEntries.length === 0) {
      toast({ title: "En az bir geçerli kayıt girin", variant: "destructive" });
      return;
    }
    setCheckSaving(true);
    let successCount = 0;
    for (const e of validCheckEntries) {
      try {
        await apiRequest("POST", "/api/checks", {
          counterpartyId: bulkCheckPartyId,
          kind: e.kind,
          direction: e.direction,
          amount: parseFloat(e.amount).toFixed(2),
          dueDate: e.dueDate,
          receivedDate: e.receivedDate || null,
          status: "pending",
          notes: e.notes || null,
        });
        successCount++;
      } catch (err: any) {
        toast({ title: "Hata", description: err.message, variant: "destructive" });
      }
    }
    setCheckSaving(false);
    if (successCount > 0) {
      queryClient.invalidateQueries({ queryKey: ["/api/counterparties", bulkCheckPartyId, "checks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/checks/upcoming"] });
      toast({ title: `${successCount} kayıt eklendi` });
      setCheckEntries([emptyCheckEntry()]);
      setBulkCheckPartyId("");
      setShowBulkChecks(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 pb-24 max-w-lg mx-auto">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-gray-400 dark:text-muted-foreground uppercase tracking-wider mb-0.5">Cari Hesaplar</p>
          <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-foreground">Firmalar</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => { setShowBulkChecks(true); setBulkCheckType(tab); setBulkCheckPartyId(""); setCheckEntries([emptyCheckEntry()]); }}
            data-testid="button-bulk-checks"
          >
            <FileText className="w-4 h-4" />
            Toplu Çek/Senet
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => { setShowBulk(true); setBulkType(tab); setBulkPartyId(""); setBulkText(""); setBulkResult(null); }}
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
            <DialogDescription>Seçtiğiniz cariye eski defterden işlemleri toplu ekleyin</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 flex-1 overflow-hidden">
            <div className="flex gap-1 p-0.5 rounded-md bg-muted/60">
              <button
                className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 ${bulkType === "customer" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
                onClick={() => { setBulkType("customer"); setBulkPartyId(""); setBulkResult(null); }}
                data-testid="bulk-tab-customer"
              >
                <Store className="w-3.5 h-3.5" />
                Müşteri
              </button>
              <button
                className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 ${bulkType === "supplier" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
                onClick={() => { setBulkType("supplier"); setBulkPartyId(""); setBulkResult(null); }}
                data-testid="bulk-tab-supplier"
              >
                <Truck className="w-3.5 h-3.5" />
                Tedarikçi
              </button>
            </div>

            <div>
              <Label className="text-xs font-medium mb-1.5 block text-gray-600 dark:text-muted-foreground">
                {bulkType === "customer" ? "Müşteri" : "Tedarikçi"} Seçin
              </Label>
              <Select value={bulkPartyId} onValueChange={(v) => { setBulkPartyId(v); setBulkResult(null); }}>
                <SelectTrigger data-testid="select-bulk-party">
                  <SelectValue placeholder={`${bulkType === "customer" ? "Müşteri" : "Tedarikçi"} seçin...`} />
                </SelectTrigger>
                <SelectContent>
                  {bulkParties.map(p => (
                    <SelectItem key={p.id} value={p.id} data-testid={`select-bulk-party-${p.id}`}>
                      {p.name}
                    </SelectItem>
                  ))}
                  {bulkParties.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      Henüz {bulkType === "customer" ? "müşteri" : "tedarikçi"} eklenmemiş
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {bulkPartyId && (
              <>
                <Card className="bg-sky-50/50 dark:bg-sky-950/10 border-sky-200/50 dark:border-sky-800/50">
                  <CardContent className="p-3">
                    <p className="text-xs font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wider mb-1">Format</p>
                    <p className="text-xs text-gray-500 dark:text-muted-foreground leading-relaxed">
                      Her satıra: <strong>Tutar, aldık/verdik, Tarih, Not</strong>. Stok etkilemez.
                    </p>
                    <div className="mt-2 p-2 rounded-md bg-white dark:bg-card border border-dashed border-gray-200 dark:border-muted">
                      <p className="text-[11px] text-gray-400 dark:text-muted-foreground font-mono leading-relaxed">
                        {bulkType === "customer" ? (
                          <>106.050,verdik,30.11.2025,KALAN BAKİYE<br/>11.200,aldık,09.12.2025,TOPLAM FİŞ<br/>5000,verdik,15.12.2025</>
                        ) : (
                          <>80.000,aldık,10.03.2025,MAL ALIMI<br/>40.000,verdik,20.08.2025,HAVALE<br/>15.000,aldık,01.12.2025</>
                        )}
                      </p>
                    </div>
                    <div className="mt-1.5 flex flex-col gap-0.5">
                      <p className="text-[10px] text-gray-500 dark:text-muted-foreground">
                        {bulkType === "customer"
                          ? <><strong>verdik</strong> = müşteriye mal verdik, bize borçlu</>
                          : <><strong>aldık</strong> = tedarikçiden mal aldık, biz borçluyuz</>}
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-muted-foreground">
                        {bulkType === "customer"
                          ? <><strong>aldık</strong> = müşteriden para aldık / tahsilat</>
                          : <><strong>verdik</strong> = tedarikçiye ödeme yaptık</>}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-muted-foreground">
                        Tarih ve not opsiyonel. Tarih: GG.AA.YYYY. Tutar: 106.050 veya 106050
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
                      ? "106.050,verdik,30.11.2025,KALAN BAKİYE\n11.200,aldık,09.12.2025,TOPLAM FİŞ\n5000,verdik"
                      : "80.000,aldık,10.03.2025,MAL ALIMI\n40.000,verdik,20.08.2025,HAVALE\n15.000,aldık"
                    }
                    value={bulkText}
                    onChange={(e) => { setBulkText(e.target.value); setBulkResult(null); }}
                    className="text-sm font-mono min-h-[140px] resize-none"
                    data-testid="textarea-bulk-transactions"
                  />
                  {bulkText.trim() && (
                    <p className="text-[11px] text-gray-400 dark:text-muted-foreground mt-1">
                      {parseBulkTransactions(bulkText).length} işlem algılandı
                    </p>
                  )}
                </div>
              </>
            )}

            {bulkResult && (
              <Card className="border-green-200/60 dark:border-green-800/40 bg-green-50/40 dark:bg-green-950/10">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <div className="text-xs flex-1 min-w-0">
                      <p className="font-semibold text-green-800 dark:text-green-300">
                        {bulkResult.summary.added} işlem başarıyla eklendi
                      </p>
                      {bulkResult.summary.errors > 0 && (
                        <p className="text-red-500 mt-0.5">
                          {bulkResult.summary.errors} hata oluştu
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-2">
              <Button
                className="flex-1 gap-1.5"
                onClick={handleBulkImport}
                disabled={bulkMutation.isPending || !bulkText.trim() || !bulkPartyId}
                data-testid="button-submit-bulk-transactions"
              >
                <Upload className="w-4 h-4" />
                {bulkMutation.isPending ? "Aktarılıyor..." : "İşlemleri Aktar"}
              </Button>
              {bulkResult && (
                <Button
                  variant="outline"
                  onClick={() => { setBulkText(""); setBulkResult(null); }}
                  data-testid="button-clear-bulk"
                >
                  Temizle
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkChecks} onOpenChange={(open) => { setShowBulkChecks(open); }}>
        <DialogContent className="max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-sky-600" />
              Toplu Çek/Senet Girişi
            </DialogTitle>
            <DialogDescription>Seçtiğiniz cariye toplu çek veya senet ekleyin</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
            <div className="flex gap-1 p-0.5 rounded-md bg-muted/60">
              <button
                className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 ${bulkCheckType === "customer" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
                onClick={() => { setBulkCheckType("customer"); setBulkCheckPartyId(""); }}
                data-testid="bulk-check-tab-customer"
              >
                <Store className="w-3.5 h-3.5" />
                Müşteri
              </button>
              <button
                className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 ${bulkCheckType === "supplier" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
                onClick={() => { setBulkCheckType("supplier"); setBulkCheckPartyId(""); }}
                data-testid="bulk-check-tab-supplier"
              >
                <Truck className="w-3.5 h-3.5" />
                Tedarikçi
              </button>
            </div>

            <div>
              <Label className="text-xs font-medium mb-1.5 block text-gray-600 dark:text-muted-foreground">
                {bulkCheckType === "customer" ? "Müşteri" : "Tedarikçi"} Seçin
              </Label>
              <Select value={bulkCheckPartyId} onValueChange={setBulkCheckPartyId}>
                <SelectTrigger data-testid="select-bulk-check-party">
                  <SelectValue placeholder={`${bulkCheckType === "customer" ? "Müşteri" : "Tedarikçi"} seçin...`} />
                </SelectTrigger>
                <SelectContent>
                  {bulkCheckParties.map(p => (
                    <SelectItem key={p.id} value={p.id} data-testid={`select-bulk-check-party-${p.id}`}>
                      {p.name}
                    </SelectItem>
                  ))}
                  {bulkCheckParties.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      Henüz {bulkCheckType === "customer" ? "müşteri" : "tedarikçi"} eklenmemiş
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {bulkCheckPartyId && (
              <>
                <div className="flex flex-col gap-3">
                  {checkEntries.map((entry, idx) => (
                    <Card key={entry.id}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <Badge variant="outline" className="text-[10px]">#{idx + 1}</Badge>
                          {checkEntries.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeCheckEntry(entry.id)}
                              data-testid={`button-remove-check-entry-${entry.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div>
                            <Label className="text-[10px] text-gray-500 dark:text-muted-foreground mb-1 block">Tür</Label>
                            <Select value={entry.kind} onValueChange={(v) => updateCheckEntry(entry.id, "kind", v)}>
                              <SelectTrigger className="h-8 text-xs" data-testid={`select-check-kind-${entry.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="check">Çek</SelectItem>
                                <SelectItem value="note">Senet</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-500 dark:text-muted-foreground mb-1 block">Yön</Label>
                            <Select value={entry.direction} onValueChange={(v) => updateCheckEntry(entry.id, "direction", v)}>
                              <SelectTrigger className="h-8 text-xs" data-testid={`select-check-direction-${entry.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="received">Alınan</SelectItem>
                                <SelectItem value="given">Verilen</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div>
                            <Label className="text-[10px] text-gray-500 dark:text-muted-foreground mb-1 block">Tutar</Label>
                            <Input
                              type="number"
                              inputMode="decimal"
                              value={entry.amount}
                              onChange={(e) => updateCheckEntry(entry.id, "amount", e.target.value)}
                              placeholder="0.00"
                              className="h-8 text-xs"
                              data-testid={`input-check-amount-${entry.id}`}
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-500 dark:text-muted-foreground mb-1 block">Vade Tarihi</Label>
                            <Input
                              type="date"
                              value={entry.dueDate}
                              onChange={(e) => updateCheckEntry(entry.id, "dueDate", e.target.value)}
                              className="h-8 text-xs"
                              data-testid={`input-check-due-date-${entry.id}`}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div>
                            <Label className="text-[10px] text-gray-500 dark:text-muted-foreground mb-1 block">Teslim Tarihi</Label>
                            <Input
                              type="date"
                              value={entry.receivedDate}
                              onChange={(e) => updateCheckEntry(entry.id, "receivedDate", e.target.value)}
                              className="h-8 text-xs"
                              data-testid={`input-check-received-date-${entry.id}`}
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-500 dark:text-muted-foreground mb-1 block">Not (opsiyonel)</Label>
                            <Input
                              value={entry.notes}
                              onChange={(e) => updateCheckEntry(entry.id, "notes", e.target.value)}
                              placeholder="Banka, seri no vs."
                              className="h-8 text-xs"
                              data-testid={`input-check-notes-${entry.id}`}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Button variant="outline" className="w-full" onClick={addCheckEntry} data-testid="button-add-check-entry">
                  <Plus className="w-4 h-4 mr-1" />
                  Satır Ekle
                </Button>

                <Card className="bg-gray-50 dark:bg-muted/30 border-0">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-muted-foreground">Toplam</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-foreground">{formatCurrency(checkTotalAmount)}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">{validCheckEntries.length} geçerli kayıt</Badge>
                    </div>
                  </CardContent>
                </Card>

                <Button
                  className="w-full"
                  onClick={handleSaveChecks}
                  disabled={checkSaving || validCheckEntries.length === 0}
                  data-testid="button-save-all-checks"
                >
                  {checkSaving ? "Kaydediliyor..." : (
                    <>
                      <Check className="w-4 h-4 mr-1" />
                      {validCheckEntries.length} Kayıdı Ekle
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

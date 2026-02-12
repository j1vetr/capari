import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Textarea } from "@/components/ui/textarea";
import {
  Package, Plus, Search, AlertTriangle, X, PlusCircle, Fish, Trash2, Settings2, Upload, CheckCircle2, AlertCircle,
  ArrowDownToLine, ArrowUpFromLine, ChevronRight, History, Pencil
} from "lucide-react";
import { formatCurrency, formatDate, txTypeLabel } from "@/lib/formatters";
import type { ProductWithStock } from "@shared/schema";

type StockMovement = {
  quantity: string;
  unitPrice: string | null;
  txType: string;
  txDate: string;
  description: string | null;
  reversedOf: string | null;
  counterpartyName: string;
  counterpartyType: string;
};

type StockAdjustment = {
  quantity: string;
  notes: string | null;
  createdAt: string;
};

export default function Stock() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const [adjustProduct, setAdjustProduct] = useState<ProductWithStock | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustNotes, setAdjustNotes] = useState("");

  const [detailProduct, setDetailProduct] = useState<ProductWithStock | null>(null);
  const [showManage, setShowManage] = useState(false);
  const [manageTab, setManageTab] = useState<"list" | "bulk">("list");
  const [manageSearch, setManageSearch] = useState("");
  const [newFishName, setNewFishName] = useState("");
  const [newFishUnit, setNewFishUnit] = useState<"kg" | "kasa" | "adet">("kg");
  const [bulkText, setBulkText] = useState("");
  const [bulkResult, setBulkResult] = useState<{ summary: { created: number; existed: number; errors: number; total: number }; results: { name: string; status: string }[] } | null>(null);

  const { data: stockData, isLoading } = useQuery<ProductWithStock[]>({
    queryKey: ["/api/stock"],
  });

  const { data: movements, isLoading: movementsLoading, isError: movementsError } = useQuery<{ transactions: StockMovement[]; adjustments: StockAdjustment[] }>({
    queryKey: ["/api/stock", detailProduct?.id, "movements"],
    queryFn: async () => {
      const res = await fetch(`/api/stock/${detailProduct!.id}/movements`);
      if (!res.ok) throw new Error("Hareketler y\u00fcklenemedi");
      return res.json();
    },
    enabled: !!detailProduct,
  });

  const addMutation = useMutation({
    mutationFn: async (data: { name: string; unit: string }) => {
      const res = await apiRequest("POST", "/api/products", data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setNewFishName("");
      setNewFishUnit("kg");
      toast({ title: "Balık eklendi" });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/products/${id}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Balık silindi" });
    },
    onError: (err: Error) => {
      toast({ title: "Silinemedi", description: err.message, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/products/${id}`, { isActive });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const adjustMutation = useMutation({
    mutationFn: async (data: { productId: string; quantity: string; notes?: string }) => {
      const res = await apiRequest("POST", "/api/stock/adjust", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock"] });
      setAdjustProduct(null);
      setAdjustQty("");
      setAdjustNotes("");
      setDetailProduct(null);
      toast({ title: "Stok g\u00fcncellendi" });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async (products: { name: string; unit: string }[]) => {
      const res = await apiRequest("POST", "/api/products/bulk", { products });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setBulkResult(data);
      toast({
        title: `${data.summary.created} balık eklendi`,
        description: data.summary.existed > 0 ? `${data.summary.existed} zaten mevcut` : undefined,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const parseBulkText = (text: string): { name: string; unit: string }[] => {
    const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    return lines.map(line => {
      const parts = line.split(",").map(p => p.trim());
      const name = parts[0] || "";
      let unit = (parts[1] || "kg").toLowerCase();
      if (!["kg", "kasa", "adet"].includes(unit)) unit = "kg";
      return { name, unit };
    }).filter(item => item.name.length > 0);
  };

  const handleBulkImport = () => {
    const parsed = parseBulkText(bulkText);
    if (parsed.length === 0) {
      toast({ title: "Eklenecek balık bulunamadı", description: "Her satıra bir balık yazın", variant: "destructive" });
      return;
    }
    setBulkResult(null);
    bulkMutation.mutate(parsed);
  };

  const handleAddFish = () => {
    if (!newFishName.trim()) {
      toast({ title: "Balık adı gerekli", variant: "destructive" });
      return;
    }
    addMutation.mutate({ name: newFishName.trim(), unit: newFishUnit });
  };

  const handleAdjust = () => {
    if (!adjustProduct) return;
    const qty = parseFloat(adjustQty);
    if (isNaN(qty) || qty === 0) {
      toast({ title: "Geçerli bir miktar girin", variant: "destructive" });
      return;
    }
    adjustMutation.mutate({
      productId: adjustProduct.id,
      quantity: adjustQty,
      notes: adjustNotes.trim() || undefined,
    });
  };

  const activeProducts = stockData?.filter(p => p.isActive) || [];
  const filtered = activeProducts.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const allProducts = stockData || [];
  const managedFiltered = allProducts.filter(p =>
    p.name.toLowerCase().includes(manageSearch.toLowerCase())
  );

  const unitLabel = (u: string) => {
    switch (u) {
      case "kg": return "Kg";
      case "kasa": return "Kasa";
      case "adet": return "Adet";
      default: return u;
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 pb-24 max-w-lg mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-gray-400 dark:text-muted-foreground uppercase tracking-wider mb-0.5">Envanter</p>
          <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-foreground" data-testid="text-stock-title">
            Stok Durumu
          </h2>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => { setShowManage(true); setManageTab("list"); setManageSearch(""); setNewFishName(""); setBulkText(""); setBulkResult(null); }} data-testid="button-manage-fish">
          <Fish className="w-4 h-4" />
          Balık Yönet
        </Button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Ürün ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
          data-testid="input-search-product"
        />
      </div>

      {isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-3"><Skeleton className="h-12 w-full" /></CardContent></Card>
          ))}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-10">
          <Fish className="w-10 h-10 mx-auto mb-2 text-gray-300 dark:text-muted-foreground" />
          <p className="text-sm font-medium text-gray-500 dark:text-muted-foreground">
            {search ? "Ürün bulunamadı" : "Henüz balık eklenmemiş"}
          </p>
          {!search && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 gap-1.5"
              onClick={() => { setShowManage(true); setManageSearch(""); setNewFishName(""); }}
              data-testid="button-manage-fish-empty"
            >
              <Fish className="w-4 h-4" />
              Balık Ekle
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {filtered.map((product) => {
          const stock = parseFloat(product.currentStock);
          const isLow = stock <= 0;
          return (
            <Card
              key={product.id}
              data-testid={`card-product-${product.id}`}
              className="cursor-pointer hover-elevate"
              onClick={() => setDetailProduct(product)}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-md flex-shrink-0 ${
                    isLow ? "bg-red-50 dark:bg-red-950/30" : "bg-sky-50 dark:bg-sky-950/30"
                  }`}>
                    {isLow
                      ? <AlertTriangle className="w-5 h-5 text-red-500" />
                      : <Package className="w-5 h-5 text-sky-600 dark:text-sky-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-foreground truncate">{product.name}</p>
                    <p className="text-[10px] text-gray-400 dark:text-muted-foreground">
                      Birim: {unitLabel(product.unit)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 flex items-center gap-2">
                    <div>
                      <p className={`text-base font-bold tabular-nums ${
                        isLow ? "text-red-600 dark:text-red-400" : "text-gray-800 dark:text-foreground"
                      }`}>
                        {parseFloat(product.currentStock).toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </p>
                      <Badge variant={isLow ? "destructive" : "secondary"} className="text-[9px]">
                        {unitLabel(product.unit)}
                      </Badge>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAdjustProduct(product);
                        setAdjustQty("");
                        setAdjustNotes("");
                      }}
                      data-testid={`button-adjust-stock-${product.id}`}
                    >
                      <PlusCircle className="w-4 h-4" />
                    </Button>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={showManage} onOpenChange={(open) => { setShowManage(open); if (!open) { setManageTab("list"); setBulkResult(null); } }}>
        <DialogContent className="max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Fish className="w-5 h-5 text-amber-600" />
              Balık Yönetimi
            </DialogTitle>
            <DialogDescription>Balıkları ekleyin, silin veya toplu aktarın</DialogDescription>
          </DialogHeader>

          <div className="flex gap-1 p-0.5 rounded-md bg-muted/60">
            <button
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all ${manageTab === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
              onClick={() => { setManageTab("list"); setBulkResult(null); }}
              data-testid="tab-list"
            >
              Balık Listesi
            </button>
            <button
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 ${manageTab === "bulk" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
              onClick={() => setManageTab("bulk")}
              data-testid="tab-bulk"
            >
              <Upload className="w-3.5 h-3.5" />
              Toplu Aktar
            </button>
          </div>

          {manageTab === "list" && (
            <div className="flex flex-col gap-3 flex-1 overflow-hidden">
              <Card className="bg-amber-50/50 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-800/50">
                <CardContent className="p-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wider mb-2">Yeni Balık Ekle</p>
                  <div className="flex items-end gap-2">
                    <div className="flex-1 min-w-0">
                      <Input
                        placeholder="Balık adı (ör: Granyöz)"
                        value={newFishName}
                        onChange={(e) => setNewFishName(e.target.value)}
                        className="bg-white dark:bg-card text-sm"
                        data-testid="input-new-fish-name"
                        onKeyDown={(e) => { if (e.key === "Enter") handleAddFish(); }}
                      />
                    </div>
                    <Select value={newFishUnit} onValueChange={(v) => setNewFishUnit(v as any)}>
                      <SelectTrigger className="w-24 bg-white dark:bg-card text-sm" data-testid="select-new-fish-unit">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="kasa">kasa</SelectItem>
                        <SelectItem value="adet">adet</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="gap-1 flex-shrink-0"
                      onClick={handleAddFish}
                      disabled={addMutation.isPending || !newFishName.trim()}
                      data-testid="button-add-fish"
                    >
                      <Plus className="w-4 h-4" />
                      Ekle
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Balık ara..."
                  value={manageSearch}
                  onChange={(e) => setManageSearch(e.target.value)}
                  className="pl-10 text-sm"
                  data-testid="input-manage-search"
                />
                {manageSearch && (
                  <button onClick={() => setManageSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 min-h-0">
                {managedFiltered.length === 0 && (
                  <div className="text-center py-6">
                    <Fish className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-muted-foreground" />
                    <p className="text-sm text-gray-500 dark:text-muted-foreground">
                      {manageSearch ? `"${manageSearch}" bulunamadı` : "Henüz balık eklenmemiş"}
                    </p>
                  </div>
                )}
                {managedFiltered.map((product) => (
                  <div
                    key={product.id}
                    className={`flex items-center gap-3 p-2.5 rounded-md border transition-all ${
                      product.isActive
                        ? "border-gray-200 dark:border-muted"
                        : "border-gray-100 dark:border-muted/50 opacity-50"
                    }`}
                    data-testid={`manage-product-${product.id}`}
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-md bg-amber-50 dark:bg-amber-950/30 flex-shrink-0">
                      <Fish className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${product.isActive ? "text-gray-900 dark:text-foreground" : "text-gray-400 dark:text-muted-foreground line-through"}`}>
                        {product.name}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-[9px]">{unitLabel(product.unit)}</Badge>
                        {!product.isActive && <Badge variant="secondary" className="text-[9px]">Pasif</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!product.isActive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => toggleActiveMutation.mutate({ id: product.id, isActive: true })}
                          data-testid={`button-activate-${product.id}`}
                        >
                          Aktifleştir
                        </Button>
                      )}
                      {product.isActive && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleActiveMutation.mutate({ id: product.id, isActive: false })}
                          data-testid={`button-deactivate-${product.id}`}
                        >
                          <X className="w-3.5 h-3.5 text-gray-400" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`"${product.name}" silinsin mi? İşlem kaydı varsa silinemez.`)) {
                            deleteMutation.mutate(product.id);
                          }
                        }}
                        data-testid={`button-delete-${product.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-1">
                <p className="text-[11px] text-gray-400 dark:text-muted-foreground text-center">
                  {allProducts.filter(p => p.isActive).length} aktif, {allProducts.filter(p => !p.isActive).length} pasif balık
                </p>
              </div>
            </div>
          )}

          {manageTab === "bulk" && (
            <div className="flex flex-col gap-3 flex-1 overflow-hidden">
              <Card className="bg-sky-50/50 dark:bg-sky-950/10 border-sky-200/50 dark:border-sky-800/50">
                <CardContent className="p-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wider mb-1">Format</p>
                  <p className="text-xs text-gray-500 dark:text-muted-foreground leading-relaxed">
                    Her satıra bir balık yazın. Birim belirtmezseniz varsayılan <strong>kg</strong> olarak eklenir.
                  </p>
                  <div className="mt-2 p-2 rounded-md bg-white dark:bg-card border border-dashed border-gray-200 dark:border-muted">
                    <p className="text-[11px] text-gray-400 dark:text-muted-foreground font-mono leading-relaxed">
                      Hamsi,kg<br/>
                      Levrek,kg<br/>
                      Somon,kg<br/>
                      Karides,kasa<br/>
                      Midye,adet
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div>
                <Label className="text-xs font-medium mb-1.5 block text-gray-600 dark:text-muted-foreground">
                  Balık Listesi
                </Label>
                <Textarea
                  placeholder={"Hamsi,kg\nLevrek,kg\nSomon,kg\nKarides,kasa"}
                  value={bulkText}
                  onChange={(e) => { setBulkText(e.target.value); setBulkResult(null); }}
                  className="text-sm font-mono min-h-[140px] resize-none"
                  data-testid="textarea-bulk-import"
                />
                {bulkText.trim() && (
                  <p className="text-[11px] text-gray-400 dark:text-muted-foreground mt-1">
                    {parseBulkText(bulkText).length} balık algılandı
                  </p>
                )}
              </div>

              {bulkResult && (
                <Card className="border-green-200/60 dark:border-green-800/40 bg-green-50/40 dark:bg-green-950/10">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                      <div className="text-xs">
                        <p className="font-semibold text-green-800 dark:text-green-300">
                          {bulkResult.summary.created} balık eklendi
                        </p>
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
                        <div className="mt-2 flex flex-col gap-0.5 max-h-[100px] overflow-y-auto">
                          {bulkResult.results.map((r, i) => (
                            <div key={i} className="flex items-center gap-1.5">
                              {r.status === "created" && <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />}
                              {r.status === "exists" && <AlertCircle className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                              {r.status === "error" && <X className="w-3 h-3 text-red-500 flex-shrink-0" />}
                              <span className={`text-[11px] ${r.status === "created" ? "text-green-700 dark:text-green-300" : r.status === "exists" ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                                {r.name} - {r.status === "created" ? "Eklendi" : r.status === "exists" ? "Zaten mevcut" : "Hata"}
                              </span>
                            </div>
                          ))}
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
                  data-testid="button-bulk-import"
                >
                  <Upload className="w-4 h-4" />
                  {bulkMutation.isPending ? "Ekleniyor..." : "Toplu Ekle"}
                </Button>
                {bulkResult && (
                  <Button
                    variant="outline"
                    onClick={() => { setBulkText(""); setBulkResult(null); }}
                    data-testid="button-bulk-clear"
                  >
                    Temizle
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!adjustProduct} onOpenChange={(open) => { if (!open) setAdjustProduct(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manuel Stok Düzenleme</DialogTitle>
          </DialogHeader>
          {adjustProduct && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
                <Package className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold">{adjustProduct.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Mevcut stok: {parseFloat(adjustProduct.currentStock).toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} {unitLabel(adjustProduct.unit)}
                  </p>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium mb-1.5 block">
                  Miktar ({unitLabel(adjustProduct.unit)})
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder={`Ör: 50 (eklemek için) veya -10 (çıkarmak için)`}
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  data-testid="input-adjust-quantity"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Pozitif = stok ekleme, negatif = stok çıkarma
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium mb-1.5 block">
                  Not (isteğe bağlı)
                </Label>
                <Input
                  placeholder="Ör: Depodan sayım düzeltmesi"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  data-testid="input-adjust-notes"
                />
              </div>
              <Button
                className="gap-1.5"
                onClick={handleAdjust}
                disabled={adjustMutation.isPending || !adjustQty}
                data-testid="button-save-adjustment"
              >
                <PlusCircle className="w-4 h-4" />
                {adjustMutation.isPending ? "Kaydediliyor..." : "Stoku Güncelle"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailProduct} onOpenChange={(open) => { if (!open) setDetailProduct(null); }}>
        <DialogContent className="max-h-[85vh] flex flex-col">
          {detailProduct && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-sky-600" />
                  {detailProduct.name}
                </DialogTitle>
                <DialogDescription>
                  Stok: {parseFloat(detailProduct.currentStock).toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} {unitLabel(detailProduct.unit)}
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto -mx-2 px-2" data-testid="product-movements-list">
                {movementsLoading && (
                  <div className="flex flex-col gap-2 py-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 w-full" />
                    ))}
                  </div>
                )}

                {movementsError && (
                  <div className="text-center py-8">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-400" />
                    <p className="text-sm text-red-500">Hareketler y{"\u00FC"}klenemedi</p>
                  </div>
                )}

                {!movementsLoading && !movementsError && movements && (
                  <div className="flex flex-col gap-1.5">
                    {movements.adjustments.length > 0 && (
                      <>
                        <p className="text-[10px] font-semibold text-gray-400 dark:text-muted-foreground uppercase tracking-wider mt-2 mb-1">
                          Manuel Stok Düzeltmeleri
                        </p>
                        {movements.adjustments.map((adj, i) => {
                          const qty = parseFloat(adj.quantity);
                          return (
                            <div key={`adj-${i}`} className="flex items-center gap-3 p-2.5 rounded-md bg-muted/40" data-testid={`adjustment-row-${i}`}>
                              <div className={`flex items-center justify-center w-8 h-8 rounded-md flex-shrink-0 ${
                                qty > 0 ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-red-50 dark:bg-red-950/30"
                              }`}>
                                <Pencil className={`w-4 h-4 ${qty > 0 ? "text-emerald-600" : "text-red-500"}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-700 dark:text-foreground">
                                  Manuel D{"\u00FC"}zeltme
                                </p>
                                {adj.notes && (
                                  <p className="text-[10px] text-gray-500 dark:text-muted-foreground truncate">{adj.notes}</p>
                                )}
                                <p className="text-[10px] text-gray-400 dark:text-muted-foreground">
                                  {new Date(adj.createdAt).toLocaleDateString("tr-TR")}
                                </p>
                              </div>
                              <p className={`text-sm font-bold tabular-nums ${qty > 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {qty > 0 ? "+" : ""}{qty.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} {unitLabel(detailProduct.unit)}
                              </p>
                            </div>
                          );
                        })}
                      </>
                    )}

                    {movements.transactions.length > 0 && (
                      <>
                        <p className="text-[10px] font-semibold text-gray-400 dark:text-muted-foreground uppercase tracking-wider mt-3 mb-1">
                          {"\u0130\u015Flem Hareketleri"}
                        </p>
                        {movements.transactions.map((mv, i) => {
                          const qty = parseFloat(mv.quantity);
                          const isIncoming = mv.txType === "purchase";
                          const isReversed = !!mv.reversedOf;
                          return (
                            <div key={`tx-${i}`} className={`flex items-center gap-3 p-2.5 rounded-md ${isReversed ? "bg-gray-100/50 dark:bg-gray-800/30 opacity-60" : "bg-muted/40"}`} data-testid={`movement-row-${i}`}>
                              <div className={`flex items-center justify-center w-8 h-8 rounded-md flex-shrink-0 ${
                                isIncoming ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-orange-50 dark:bg-orange-950/30"
                              }`}>
                                {isIncoming
                                  ? <ArrowDownToLine className="w-4 h-4 text-emerald-600" />
                                  : <ArrowUpFromLine className="w-4 h-4 text-orange-600" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-700 dark:text-foreground truncate">
                                  {mv.counterpartyName}
                                  {isReversed && <span className="ml-1 text-[10px] text-gray-400">(iptal)</span>}
                                </p>
                                <p className="text-[10px] text-gray-500 dark:text-muted-foreground">
                                  {txTypeLabel(mv.txType)} - {formatDate(mv.txDate)}
                                </p>
                                {mv.unitPrice && (
                                  <p className="text-[10px] text-gray-400 dark:text-muted-foreground">
                                    Birim fiyat: {formatCurrency(mv.unitPrice)}
                                  </p>
                                )}
                              </div>
                              <p className={`text-sm font-bold tabular-nums ${isIncoming ? "text-emerald-600" : "text-orange-600"}`}>
                                {isIncoming ? "+" : "-"}{qty.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} {unitLabel(detailProduct.unit)}
                              </p>
                            </div>
                          );
                        })}
                      </>
                    )}

                    {movements.transactions.length === 0 && movements.adjustments.length === 0 && (
                      <div className="text-center py-8">
                        <History className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-muted-foreground" />
                        <p className="text-sm text-gray-500 dark:text-muted-foreground">Hen{"\u00FC"}z hareket yok</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setDetailProduct(null);
                    setAdjustProduct(detailProduct);
                    setAdjustQty("");
                    setAdjustNotes("");
                  }}
                  data-testid="button-adjust-from-detail"
                >
                  <PlusCircle className="w-4 h-4" />
                  Stok D{"\u00FC"}zelt
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

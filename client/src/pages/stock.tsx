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
import {
  Package, Plus, Search, AlertTriangle, X, PlusCircle, Fish, Trash2, Settings2
} from "lucide-react";
import type { ProductWithStock } from "@shared/schema";

export default function Stock() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const [adjustProduct, setAdjustProduct] = useState<ProductWithStock | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustNotes, setAdjustNotes] = useState("");

  const [showManage, setShowManage] = useState(false);
  const [manageSearch, setManageSearch] = useState("");
  const [newFishName, setNewFishName] = useState("");
  const [newFishUnit, setNewFishUnit] = useState<"kg" | "kasa" | "adet">("kg");

  const { data: stockData, isLoading } = useQuery<ProductWithStock[]>({
    queryKey: ["/api/stock"],
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
      toast({ title: "Stok güncellendi" });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

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
        <Button size="sm" className="gap-1.5" onClick={() => { setShowManage(true); setManageSearch(""); setNewFishName(""); }} data-testid="button-manage-fish">
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
            <Card key={product.id} data-testid={`card-product-${product.id}`}>
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
                      onClick={() => {
                        setAdjustProduct(product);
                        setAdjustQty("");
                        setAdjustNotes("");
                      }}
                      data-testid={`button-adjust-stock-${product.id}`}
                    >
                      <PlusCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={showManage} onOpenChange={setShowManage}>
        <DialogContent className="max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Fish className="w-5 h-5 text-amber-600" />
              Balık Yönetimi
            </DialogTitle>
            <DialogDescription>Balıkları ekleyin, silin veya düzenleyin</DialogDescription>
          </DialogHeader>

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
    </div>
  );
}

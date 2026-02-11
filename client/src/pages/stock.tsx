import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Package, Plus, Search, AlertTriangle, X, PlusCircle
} from "lucide-react";
import type { ProductWithStock } from "@shared/schema";

export default function Stock() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState<"kg" | "kasa" | "adet">("kg");

  const [adjustProduct, setAdjustProduct] = useState<ProductWithStock | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustNotes, setAdjustNotes] = useState("");

  const { data: stockData, isLoading } = useQuery<ProductWithStock[]>({
    queryKey: ["/api/stock"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: { name: string; unit: string }) => {
      const res = await apiRequest("POST", "/api/products", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setNewName("");
      setNewUnit("kg");
      setShowAdd(false);
      toast({ title: "Yeni ürün eklendi" });
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

  const handleAdd = () => {
    if (!newName.trim()) {
      toast({ title: "Ürün adı gerekli", variant: "destructive" });
      return;
    }
    addMutation.mutate({ name: newName.trim(), unit: newUnit });
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

  const filtered = stockData?.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

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
        <Button size="sm" className="gap-1.5" onClick={() => setShowAdd(!showAdd)} data-testid="button-add-product">
          {showAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAdd ? "Kapat" : "Yeni Ürün"}
        </Button>
      </div>

      {showAdd && (
        <Card data-testid="card-add-product">
          <CardContent className="p-4 flex flex-col gap-3">
            <p className="text-sm font-semibold text-gray-700 dark:text-foreground">Yeni Ürün Ekle</p>
            <Input
              placeholder="Ürün adı (ör: Levrek)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              data-testid="input-product-name"
            />
            <Select value={newUnit} onValueChange={(v) => setNewUnit(v as any)}>
              <SelectTrigger data-testid="select-product-unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kg">Kilogram (kg)</SelectItem>
                <SelectItem value="kasa">Kasa</SelectItem>
                <SelectItem value="adet">Adet</SelectItem>
              </SelectContent>
            </Select>
            <Button
              className="gap-1.5"
              onClick={handleAdd}
              disabled={addMutation.isPending}
              data-testid="button-save-product"
            >
              <Plus className="w-4 h-4" />
              {addMutation.isPending ? "Kaydediliyor..." : "Ekle"}
            </Button>
          </CardContent>
        </Card>
      )}

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
          <Package className="w-10 h-10 mx-auto mb-2 text-gray-300 dark:text-muted-foreground" />
          <p className="text-sm font-medium text-gray-500 dark:text-muted-foreground">
            {search ? "Ürün bulunamadı" : "Henüz ürün eklenmemiş"}
          </p>
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
                <label className="text-sm font-medium mb-1.5 block">
                  Miktar ({unitLabel(adjustProduct.unit)})
                </label>
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
                <label className="text-sm font-medium mb-1.5 block">
                  Not (isteğe bağlı)
                </label>
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

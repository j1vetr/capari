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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Package, Plus, Search, AlertTriangle, X
} from "lucide-react";
import type { ProductWithStock } from "@shared/schema";

export default function Stock() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState<"kg" | "kasa" | "adet">("kg");

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

  const handleAdd = () => {
    if (!newName.trim()) {
      toast({ title: "Ürün adı gerekli", variant: "destructive" });
      return;
    }
    addMutation.mutate({ name: newName.trim(), unit: newUnit });
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
                  <div className="text-right flex-shrink-0">
                    <p className={`text-base font-bold tabular-nums ${
                      isLow ? "text-red-600 dark:text-red-400" : "text-gray-800 dark:text-foreground"
                    }`}>
                      {parseFloat(product.currentStock).toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </p>
                    <Badge variant={isLow ? "destructive" : "secondary"} className="text-[9px]">
                      {unitLabel(product.unit)}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

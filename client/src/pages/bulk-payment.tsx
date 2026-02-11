import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowLeft, Store, Truck, Check, ArrowDownToLine, ArrowUpFromLine,
  CheckSquare, Square
} from "lucide-react";
import { formatCurrency, todayISO } from "@/lib/formatters";
import type { CounterpartyWithBalance } from "@shared/schema";

type BulkEntry = {
  counterpartyId: string;
  name: string;
  type: string;
  balance: string;
  amount: string;
  selected: boolean;
};

export default function BulkPayment() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [mode, setMode] = useState<"collection" | "payment">("collection");
  const [entries, setEntries] = useState<BulkEntry[]>([]);

  const { data: counterparties, isLoading } = useQuery<CounterpartyWithBalance[]>({
    queryKey: ["/api/counterparties"],
  });

  useEffect(() => {
    if (!counterparties) return;
    const filtered = counterparties.filter(c => {
      const bal = parseFloat(c.balance);
      if (mode === "collection") return c.type === "customer" && bal > 0;
      return c.type === "supplier" && bal > 0;
    });
    setEntries(filtered.map(c => ({
      counterpartyId: c.id,
      name: c.name,
      type: c.type,
      balance: c.balance,
      amount: "",
      selected: false,
    })));
  }, [counterparties, mode]);

  const toggleSelect = (idx: number) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, selected: !e.selected } : e));
  };

  const toggleAll = () => {
    const allSelected = entries.every(e => e.selected);
    setEntries(prev => prev.map(e => ({ ...e, selected: !allSelected })));
  };

  const updateAmount = (idx: number, val: string) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, amount: val } : e));
  };

  const fillFullAmount = (idx: number) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, amount: e.balance, selected: true } : e));
  };

  const bulkMutation = useMutation({
    mutationFn: async (txs: { counterpartyId: string; txType: string; amount: string; description: string; txDate: string }[]) => {
      const results = [];
      for (const tx of txs) {
        const res = await apiRequest("POST", "/api/transactions", tx);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(`${tx.counterpartyId}: ${err.message}`);
        }
        results.push(await res.json());
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["/api/counterparties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recent-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: `${results.length} ${mode === "collection" ? "tahsilat" : "ödeme"} kaydedildi`,
      });
      navigate("/");
    },
    onError: (err: Error) => {
      toast({ title: "Hata oluştu", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    const selected = entries.filter(e => e.selected && parseFloat(e.amount) > 0);
    if (selected.length === 0) {
      toast({ title: "Hiç işlem seçilmedi", variant: "destructive" });
      return;
    }
    const txType = mode === "collection" ? "collection" : "payment";
    const txs = selected.map(e => ({
      counterpartyId: e.counterpartyId,
      txType,
      amount: e.amount,
      description: `Toplu ${mode === "collection" ? "tahsilat" : "ödeme"}`,
      txDate: todayISO(),
    }));
    bulkMutation.mutate(txs);
  };

  const selectedCount = entries.filter(e => e.selected && parseFloat(e.amount) > 0).length;
  const selectedTotal = entries
    .filter(e => e.selected && parseFloat(e.amount) > 0)
    .reduce((sum, e) => sum + parseFloat(e.amount), 0);

  return (
    <div className="flex flex-col gap-4 p-4 pb-24 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <p className="text-xs font-medium text-gray-400 dark:text-muted-foreground uppercase tracking-wider mb-0.5">Toplu İşlem</p>
          <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-foreground">
            {mode === "collection" ? "Toplu Tahsilat" : "Toplu Ödeme"}
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={mode === "collection" ? "default" : "outline"}
          className="gap-1.5"
          onClick={() => switchMode("collection")}
          data-testid="button-mode-collection"
        >
          <ArrowDownToLine className="w-4 h-4" />
          Tahsilat
        </Button>
        <Button
          variant={mode === "payment" ? "default" : "outline"}
          className="gap-1.5"
          onClick={() => switchMode("payment")}
          data-testid="button-mode-payment"
        >
          <ArrowUpFromLine className="w-4 h-4" />
          Ödeme
        </Button>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}><CardContent className="p-3"><Skeleton className="h-12 w-full" /></CardContent></Card>
          ))}
        </div>
      )}

      {!isLoading && entries.length === 0 && (
        <div className="text-center py-10">
          <p className="text-sm font-medium text-gray-500 dark:text-muted-foreground">
            {mode === "collection" ? "Bakiyesi olan müşteri yok" : "Bakiyesi olan tedarikçi yok"}
          </p>
        </div>
      )}

      {entries.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={toggleAll} data-testid="button-toggle-all">
              {entries.every(e => e.selected) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              Tümünü Seç
            </Button>
            <Badge variant="secondary" className="text-[10px]">{entries.length} cari</Badge>
          </div>

          <div className="flex flex-col gap-2">
            {entries.map((entry, idx) => (
              <Card key={entry.counterpartyId} data-testid={`card-bulk-${entry.counterpartyId}`}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <button
                      className="flex-shrink-0"
                      onClick={() => toggleSelect(idx)}
                      data-testid={`checkbox-${entry.counterpartyId}`}
                    >
                      {entry.selected
                        ? <CheckSquare className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                        : <Square className="w-5 h-5 text-gray-300 dark:text-muted-foreground" />}
                    </button>
                    <div className={`flex items-center justify-center w-8 h-8 rounded-md flex-shrink-0 ${
                      entry.type === "customer" ? "bg-sky-50 dark:bg-sky-950/30" : "bg-amber-50 dark:bg-amber-950/30"
                    }`}>
                      {entry.type === "customer"
                        ? <Store className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                        : <Truck className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-foreground truncate">{entry.name}</p>
                      <p className="text-[10px] text-gray-400 dark:text-muted-foreground">
                        Bakiye: {formatCurrency(entry.balance)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Tutar"
                        value={entry.amount}
                        onChange={(e) => updateAmount(idx, e.target.value)}
                        className="w-24 h-8 text-xs text-right"
                        data-testid={`input-amount-${entry.counterpartyId}`}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-[10px]"
                        onClick={() => fillFullAmount(idx)}
                        data-testid={`button-fill-${entry.counterpartyId}`}
                      >
                        Tam
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {selectedCount > 0 && (
        <Card className="border-0 bg-sky-50 dark:bg-sky-950/20 sticky bottom-20 z-30">
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-foreground">
                  {selectedCount} {mode === "collection" ? "tahsilat" : "ödeme"} seçildi
                </p>
                <p className="text-sm font-bold text-sky-700 dark:text-sky-300">
                  Toplam: {formatCurrency(selectedTotal)}
                </p>
              </div>
              <Button
                className="gap-1.5"
                onClick={handleSubmit}
                disabled={bulkMutation.isPending}
                data-testid="button-submit-bulk"
              >
                <Check className="w-4 h-4" />
                {bulkMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

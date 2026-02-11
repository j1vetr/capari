import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Search, Plus, ShoppingCart, ArrowDownToLine, Banknote, ArrowUpFromLine, Check, ArrowLeft, UserPlus } from "lucide-react";
import { formatCurrency, txTypeLabel } from "@/lib/formatters";
import type { Counterparty, CounterpartyWithBalance } from "@shared/schema";

const TX_TYPES = [
  { value: "sale", label: "Satış", icon: ShoppingCart, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" },
  { value: "collection", label: "Tahsilat", icon: ArrowDownToLine, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 border-blue-200 dark:border-blue-800" },
  { value: "purchase", label: "Alım", icon: Banknote, color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400 border-orange-200 dark:border-orange-800" },
  { value: "payment", label: "Ödeme", icon: ArrowUpFromLine, color: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400 border-rose-200 dark:border-rose-800" },
];

export default function QuickTransaction() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedParty, setSelectedParty] = useState<CounterpartyWithBalance | null>(null);
  const [txType, setTxType] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"customer" | "supplier">("customer");
  const [newPhone, setNewPhone] = useState("");
  const amountRef = useRef<HTMLInputElement>(null);

  const { data: parties } = useQuery<CounterpartyWithBalance[]>({
    queryKey: ["/api/counterparties"],
  });

  const filtered = parties?.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const createPartyMutation = useMutation({
    mutationFn: async (data: { name: string; type: string; phone?: string }) => {
      const res = await apiRequest("POST", "/api/counterparties", data);
      return res.json();
    },
    onSuccess: (newParty: CounterpartyWithBalance) => {
      queryClient.invalidateQueries({ queryKey: ["/api/counterparties"] });
      setSelectedParty(newParty);
      setShowAddModal(false);
      setNewName("");
      setNewPhone("");
      toast({ title: "Cari eklendi" });
    },
  });

  const createTxMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/transactions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/counterparties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "İşlem kaydedildi" });
      setSelectedParty(null);
      setTxType("");
      setAmount("");
      setDescription("");
      setSearch("");
    },
  });

  const handleSubmit = () => {
    if (!selectedParty || !txType || !amount) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({ title: "Geçersiz tutar", variant: "destructive" });
      return;
    }
    createTxMutation.mutate({
      counterpartyId: selectedParty.id,
      txType,
      amount: numAmount.toFixed(2),
      description: description || undefined,
      txDate: new Date().toISOString().split("T")[0],
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && selectedParty && txType && amount) {
      e.preventDefault();
      handleSubmit();
    }
  };

  useEffect(() => {
    if (selectedParty && txType && amountRef.current) {
      amountRef.current.focus();
    }
  }, [selectedParty, txType]);

  const visibleTypes = selectedParty
    ? selectedParty.type === "customer"
      ? TX_TYPES.filter((t) => t.value === "sale" || t.value === "collection")
      : TX_TYPES.filter((t) => t.value === "purchase" || t.value === "payment")
    : TX_TYPES;

  return (
    <div className="flex flex-col gap-4 p-4 pb-24 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Hızlı İşlem</h1>
          <p className="text-sm text-muted-foreground">İşlem kaydet</p>
        </div>
      </div>

      {!selectedParty ? (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              autoFocus
              data-testid="input-search-counterparty"
            />
          </div>

          <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto">
            {filtered.map((p) => (
              <Card
                key={p.id}
                className="hover-elevate cursor-pointer"
                onClick={() => { setSelectedParty(p); setTxType(""); }}
                data-testid={`card-counterparty-${p.id}`}
              >
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.type === "customer" ? "Müşteri" : "Tedarikçi"}
                    </p>
                  </div>
                  <p className={`text-sm font-semibold whitespace-nowrap ${parseFloat(p.balance) > 0
                    ? p.type === "customer" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    : "text-muted-foreground"
                    }`}>
                    {formatCurrency(p.balance)}
                  </p>
                </CardContent>
              </Card>
            ))}
            {search && filtered.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-3">Sonuç bulunamadı</p>
                <Button
                  variant="outline"
                  onClick={() => { setNewName(search); setShowAddModal(true); }}
                  className="gap-2"
                  data-testid="button-add-new-counterparty"
                >
                  <UserPlus className="w-4 h-4" />
                  Yeni Cari Ekle
                </Button>
              </div>
            )}
            {!search && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setShowAddModal(true)}
                data-testid="button-open-add-modal"
              >
                <Plus className="w-4 h-4" />
                Yeni Cari Ekle
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium truncate">{selectedParty.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedParty.type === "customer" ? "Müşteri" : "Tedarikçi"}
                  {" · Bakiye: "}
                  <span className="font-medium">{formatCurrency(selectedParty.balance)}</span>
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedParty(null)} data-testid="button-change-counterparty">
                Değiştir
              </Button>
            </CardContent>
          </Card>

          <div>
            <Label className="text-sm font-medium mb-2 block">İşlem Tipi</Label>
            <div className="grid grid-cols-2 gap-2">
              {visibleTypes.map((t) => {
                const Icon = t.icon;
                const isSelected = txType === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={() => setTxType(t.value)}
                    className={`flex items-center gap-2 p-3 rounded-md border-2 transition-colors ${isSelected ? t.color + " border-current" : "border-transparent bg-card"
                      }`}
                    data-testid={`button-tx-type-${t.value}`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium text-sm">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {txType && (
            <div className="flex flex-col gap-3">
              <div>
                <Label htmlFor="amount" className="text-sm font-medium mb-1.5 block">Tutar (₺)</Label>
                <Input
                  id="amount"
                  ref={amountRef}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="text-2xl h-14 font-semibold"
                  data-testid="input-amount"
                />
              </div>
              <div>
                <Label htmlFor="desc" className="text-sm font-medium mb-1.5 block">Açıklama (opsiyonel)</Label>
                <Textarea
                  id="desc"
                  placeholder="Not ekle..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="resize-none"
                  rows={2}
                  data-testid="input-description"
                />
              </div>
              <Button
                size="lg"
                className="w-full h-14 text-lg font-semibold gap-2"
                onClick={handleSubmit}
                disabled={createTxMutation.isPending || !amount || parseFloat(amount) <= 0}
                data-testid="button-save-transaction"
              >
                <Check className="w-5 h-5" />
                {createTxMutation.isPending ? "Kaydediliyor..." : `${txTypeLabel(txType)} Kaydet`}
              </Button>
            </div>
          )}
        </div>
      )}

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Cari Ekle</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">İsim</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Cari ismi"
                autoFocus
                data-testid="input-new-name"
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Tür</Label>
              <RadioGroup value={newType} onValueChange={(v) => setNewType(v as any)} className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="customer" id="r-customer" />
                  <Label htmlFor="r-customer">Müşteri</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="supplier" id="r-supplier" />
                  <Label htmlFor="r-supplier">Tedarikçi</Label>
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Telefon (opsiyonel)</Label>
              <Input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="0555 123 4567"
                type="tel"
                data-testid="input-new-phone"
              />
            </div>
            <Button
              onClick={() => createPartyMutation.mutate({ name: newName, type: newType, phone: newPhone || undefined })}
              disabled={!newName.trim() || createPartyMutation.isPending}
              data-testid="button-save-counterparty"
            >
              {createPartyMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
  Search, Plus, ShoppingCart, ArrowDownToLine, Banknote, ArrowUpFromLine,
  Check, ArrowLeft, UserPlus, X, ChevronRight, Store, Truck, Trash2, FileText, CalendarDays, PackagePlus, Fish, ClipboardPaste, List
} from "lucide-react";
import { formatCurrency, txTypeLabel, todayISO } from "@/lib/formatters";
import type { CounterpartyWithBalance } from "@shared/schema";

type LineItem = {
  id: number;
  productName: string;
  productUnit: string;
  quantity: string;
  unitPrice: string;
};

let nextItemId = 1;

const TX_TYPES_CUSTOMER = [
  {
    value: "sale", label: "Satış", desc: "Müşteriye mal verildi", icon: ShoppingCart,
    bgClass: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800",
    iconClass: "text-emerald-600 dark:text-emerald-400",
    activeClass: "ring-2 ring-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700",
  },
  {
    value: "collection", label: "Tahsilat", desc: "Müşteriden ödeme alındı", icon: ArrowDownToLine,
    bgClass: "bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800",
    iconClass: "text-sky-600 dark:text-sky-400",
    activeClass: "ring-2 ring-sky-500 bg-sky-50 dark:bg-sky-950/40 border-sky-300 dark:border-sky-700",
  },
  {
    value: "purchase", label: "Alım", desc: "Müşteriden mal alındı", icon: Banknote,
    bgClass: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
    iconClass: "text-amber-600 dark:text-amber-400",
    activeClass: "ring-2 ring-amber-500 bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700",
  },
];

const TX_TYPES_SUPPLIER = [
  {
    value: "purchase", label: "Alım", desc: "Tedarikçiden mal alındı", icon: Banknote,
    bgClass: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
    iconClass: "text-amber-600 dark:text-amber-400",
    activeClass: "ring-2 ring-amber-500 bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700",
  },
  {
    value: "payment", label: "Ödeme", desc: "Tedarikçiye ödeme yapıldı", icon: ArrowUpFromLine,
    bgClass: "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800",
    iconClass: "text-rose-600 dark:text-rose-400",
    activeClass: "ring-2 ring-rose-500 bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700",
  },
];

export default function QuickTransaction() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedParty, setSelectedParty] = useState<CounterpartyWithBalance | null>(null);
  const [txType, setTxType] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"customer" | "supplier">("customer");
  const [newPhone, setNewPhone] = useState("");
  const [newInvoiced, setNewInvoiced] = useState(false);
  const [newTaxNumber, setNewTaxNumber] = useState("");
  const [newTaxOffice, setNewTaxOffice] = useState("");
  const [newCompanyTitle, setNewCompanyTitle] = useState("");
  const [newAddress, setNewAddress] = useState("");

  const isSaleOrPurchase = txType === "sale" || txType === "purchase" || txType === "collection";

  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: nextItemId++, productName: "", productUnit: "kg", quantity: "", unitPrice: "" },
  ]);
  const [directAmount, setDirectAmount] = useState("");
  const [directDescription, setDirectDescription] = useState("");
  const [txDate, setTxDate] = useState(todayISO());

  const { data: parties } = useQuery<CounterpartyWithBalance[]>({
    queryKey: ["/api/counterparties"],
  });

  const filtered = parties?.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const createPartyMutation = useMutation({
    mutationFn: async (data: { name: string; type: string; phone?: string; invoiced?: boolean }) => {
      const res = await apiRequest("POST", "/api/counterparties", data);
      return res.json();
    },
    onSuccess: (newParty: CounterpartyWithBalance) => {
      queryClient.invalidateQueries({ queryKey: ["/api/counterparties"] });
      setSelectedParty(newParty);
      setShowAddModal(false);
      setNewName("");
      setNewPhone("");
      setNewInvoiced(false);
      setNewTaxNumber("");
      setNewTaxOffice("");
      setNewCompanyTitle("");
      setNewAddress("");
      toast({ title: "Yeni cari eklendi" });
    },
    onError: () => {
      toast({ title: "Cari eklenemedi", description: "Bir hata oluştu, lütfen tekrar deneyin", variant: "destructive" });
    },
  });

  const createTxMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/transactions", data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/counterparties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recent-transactions"] });
      toast({ title: `${txTypeLabel(txType)} kaydedildi`, description: `${selectedParty?.name} - ${formatCurrency(computedTotal)}` });
      setSelectedParty(null);
      setTxType("");
      setLineItems([{ id: nextItemId++, productName: "", productUnit: "kg", quantity: "", unitPrice: "" }]);
      setDirectAmount("");
      setDirectDescription("");
      setTxDate(todayISO());
      setSearch("");
      setBulkMode(false);
      setBulkText("");
    },
    onError: (err: Error) => {
      toast({ title: "İşlem kaydedilemedi", description: err.message, variant: "destructive" });
    },
  });

  const addLineItem = () => {
    setLineItems([...lineItems, { id: nextItemId++, productName: "", productUnit: "kg", quantity: "", unitPrice: "" }]);
  };

  const removeLineItem = (id: number) => {
    if (lineItems.length <= 1) {
      setLineItems([{ id: nextItemId++, productName: "", productUnit: "kg", quantity: "", unitPrice: "" }]);
      return;
    }
    setLineItems(lineItems.filter((li) => li.id !== id));
  };

  const updateLineItem = (id: number, field: keyof LineItem, value: string) => {
    setLineItems(lineItems.map((li) => li.id === id ? { ...li, [field]: value } : li));
  };

  const lineItemTotal = (li: LineItem) => {
    const q = parseFloat(li.quantity) || 0;
    const p = parseFloat(li.unitPrice) || 0;
    return q * p;
  };

  const subtotal = isSaleOrPurchase
    ? lineItems.reduce((s, li) => s + lineItemTotal(li), 0)
    : parseFloat(directAmount) || 0;

  const isInvoiced = selectedParty?.invoiced === true;
  const kdvRate = 0.01;
  const kdvAmount = isInvoiced && isSaleOrPurchase ? subtotal * kdvRate : 0;
  const computedTotal = subtotal + kdvAmount;

  const unitLabel = (u: string) => u === "kg" ? "kg" : u === "kasa" ? "kasa" : "adet";

  const parseBulkText = (text: string): LineItem[] => {
    const lines = text.split("\n").filter(l => l.trim());
    const items: LineItem[] = [];
    for (const line of lines) {
      const parts = line.split(/[,;\t]+/).map(s => s.trim()).filter(Boolean);
      if (parts.length < 3) continue;
      const name = parts[0];
      let unit = "kg";
      let qtyStr = parts[1];
      let priceStr = parts[2];
      const qtyMatch = qtyStr.match(/^([\d.,]+)\s*(kg|kasa|adet)?$/i);
      if (qtyMatch) {
        qtyStr = qtyMatch[1].replace(",", ".");
        if (qtyMatch[2]) unit = qtyMatch[2].toLowerCase();
      } else {
        qtyStr = qtyStr.replace(",", ".");
      }
      const priceMatch = priceStr.match(/^([\d.,]+)\s*(tl|₺)?$/i);
      if (priceMatch) {
        priceStr = priceMatch[1].replace(",", ".");
      } else {
        priceStr = priceStr.replace(",", ".");
      }
      if (parts.length >= 4) {
        const unitCandidate = parts[1].toLowerCase().replace(/\s/g, "");
        if (["kg", "kasa", "adet"].includes(unitCandidate)) {
          unit = unitCandidate;
          qtyStr = parts[2].replace(",", ".");
          const p4 = parts[3].match(/^([\d.,]+)\s*(tl|₺)?$/i);
          priceStr = p4 ? p4[1].replace(",", ".") : parts[3].replace(",", ".");
        }
      }
      if (name && !isNaN(parseFloat(qtyStr)) && !isNaN(parseFloat(priceStr))) {
        items.push({ id: nextItemId++, productName: name, productUnit: unit, quantity: qtyStr, unitPrice: priceStr });
      }
    }
    return items;
  };

  const handleBulkParse = () => {
    const parsed = parseBulkText(bulkText);
    if (parsed.length === 0) {
      toast({ title: "Ayristirilamadi", description: "Her satir: Urun, Miktar, Fiyat seklinde olmali", variant: "destructive" });
      return;
    }
    setLineItems(parsed);
    setBulkMode(false);
    setBulkText("");
    toast({ title: `${parsed.length} kalem eklendi` });
  };

  const computedDescription = isSaleOrPurchase
    ? lineItems
      .filter((li) => li.productName.trim() && lineItemTotal(li) > 0)
      .map((li) => `${li.productName} ${li.quantity}${unitLabel(li.productUnit)} x ${formatCurrency(li.unitPrice)}`)
      .join(", ") + (kdvAmount > 0 ? ` [KDV %1: ${formatCurrency(kdvAmount)}]` : "")
    : directDescription;

  const canSubmit = selectedParty && txType && computedTotal > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (txDate > todayISO()) {
      toast({ title: "Gelecek tarihli işlem eklenemez", variant: "destructive" });
      return;
    }
    if (isSaleOrPurchase) {
      const validItems = lineItems.filter(li => li.productName.trim() && parseFloat(li.quantity) > 0);
      if (validItems.length === 0) {
        toast({ title: "En az bir ürün seçip miktar girin", variant: "destructive" });
        return;
      }
    }
    const txPayload: any = {
      counterpartyId: selectedParty!.id,
      txType,
      amount: computedTotal.toFixed(2),
      description: computedDescription || undefined,
      txDate,
    };

    if (isSaleOrPurchase) {
      const validItems = lineItems.filter(li => li.productName.trim() && parseFloat(li.quantity) > 0);
      txPayload.purchaseItems = validItems.map(li => ({
        productName: li.productName.trim(),
        productUnit: li.productUnit,
        quantity: li.quantity,
        unitPrice: li.unitPrice || undefined,
      }));
    }

    createTxMutation.mutate(txPayload);
  };

  const visibleTypes = selectedParty?.type === "customer" ? TX_TYPES_CUSTOMER : TX_TYPES_SUPPLIER;
  const stepNumber = !selectedParty ? 1 : !txType ? 2 : 3;

  return (
    <div className="flex flex-col gap-4 p-4 pb-24 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-bold tracking-tight text-gray-900 dark:text-foreground">İşlem Ekle</h1>
          <p className="text-xs text-gray-400 dark:text-muted-foreground">Satış, tahsilat, alım veya ödeme kaydet</p>
        </div>
      </div>

      <div className="flex items-center gap-2 px-1">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${s <= stepNumber
              ? "bg-sky-600 text-white"
              : "bg-gray-100 dark:bg-muted text-gray-400 dark:text-muted-foreground"
              }`}>
              {s < stepNumber ? <Check className="w-3.5 h-3.5" /> : s}
            </div>
            {s < 3 && <div className={`flex-1 h-0.5 rounded-full transition-colors ${s < stepNumber ? "bg-sky-600" : "bg-gray-100 dark:bg-muted"}`} />}
          </div>
        ))}
      </div>

      {!selectedParty ? (
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-foreground mb-2">1. Firma Seç</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-muted-foreground" />
              <Input
                placeholder="Firma adı yazarak ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                autoFocus
                data-testid="input-search-counterparty"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <Button
            variant="outline"
            className="gap-2 border-dashed border-gray-300 dark:border-muted text-gray-500 dark:text-muted-foreground"
            onClick={() => { setNewName(search); setShowAddModal(true); }}
            data-testid="button-open-add-modal"
          >
            <UserPlus className="w-4 h-4" />
            Yeni Firma Ekle
          </Button>

          <div className="flex flex-col gap-2 max-h-[55vh] overflow-y-auto">
            {filtered.map((p) => {
              const bal = parseFloat(p.balance);
              return (
                <Card
                  key={p.id}
                  className="hover-elevate active-elevate-2 cursor-pointer"
                  onClick={() => { setSelectedParty(p); setTxType(""); setBulkMode(false); setBulkText(""); }}
                  data-testid={`card-counterparty-${p.id}`}
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-md flex-shrink-0 ${p.type === "customer" ? "bg-sky-50 dark:bg-sky-950/30" : "bg-amber-50 dark:bg-amber-950/30"}`}>
                      {p.type === "customer"
                        ? <Store className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                        : <Truck className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900 dark:text-foreground truncate">{p.name}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-[10px]">
                          {p.type === "customer" ? "Müşteri" : "Tedarikçi"}
                        </Badge>
                        {p.invoiced && (
                          <Badge variant="secondary" className="text-[9px] gap-0.5 px-1.5">
                            <FileText className="w-2.5 h-2.5" />
                            Faturalı
                          </Badge>
                        )}
                        {p.phone && <span className="text-[11px] text-gray-400 dark:text-muted-foreground">{p.phone}</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-bold ${bal > 0
                        ? p.type === "customer" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        : "text-gray-400 dark:text-muted-foreground"}`}>
                        {formatCurrency(bal)}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-muted-foreground">{p.type === "customer" ? "alacak" : "borç"}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 dark:text-muted-foreground flex-shrink-0" />
                  </CardContent>
                </Card>
              );
            })}
            {search && filtered.length === 0 && (
              <div className="text-center py-10">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-muted mx-auto mb-3">
                  <Search className="w-5 h-5 text-gray-400 dark:text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-gray-500 dark:text-muted-foreground mb-1">"{search}" bulunamadı</p>
                <p className="text-xs text-gray-400 dark:text-muted-foreground mb-3">Yeni firma olarak ekleyebilirsiniz</p>
                <Button variant="outline" size="sm" onClick={() => { setNewName(search); setShowAddModal(true); }} className="gap-2" data-testid="button-add-new-counterparty">
                  <UserPlus className="w-4 h-4" />
                  "{search}" Ekle
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Card className="bg-sky-50/50 dark:bg-sky-950/20 border-sky-100 dark:border-sky-900">
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`flex items-center justify-center w-10 h-10 rounded-md flex-shrink-0 ${selectedParty.type === "customer" ? "bg-sky-100 dark:bg-sky-900/40" : "bg-amber-100 dark:bg-amber-900/40"}`}>
                {selectedParty.type === "customer"
                  ? <Store className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                  : <Truck className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-bold text-sm text-gray-900 dark:text-foreground truncate">{selectedParty.name}</p>
                  {selectedParty.invoiced && (
                    <Badge variant="secondary" className="text-[10px] gap-0.5">
                      <FileText className="w-2.5 h-2.5" />
                      Faturalı
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-muted-foreground">
                  {selectedParty.type === "customer" ? "Müşteri" : "Tedarikçi"}
                  {" · Bakiye: "}
                  <span className="font-semibold">{formatCurrency(selectedParty.balance)}</span>
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setSelectedParty(null); setTxType(""); setBulkMode(false); setBulkText(""); }} data-testid="button-change-counterparty">
                Değiştir
              </Button>
            </CardContent>
          </Card>

          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-foreground mb-3">2. İşlem Tipi Seç</p>
            <div className="grid grid-cols-1 gap-2">
              {visibleTypes.map((t) => {
                const Icon = t.icon;
                const isSelected = txType === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={() => {
                      setTxType(t.value);
                      setLineItems([{ id: nextItemId++, productName: "", productUnit: "kg", quantity: "", unitPrice: "" }]);
                      setDirectAmount("");
                      setDirectDescription("");
                      setBulkMode(false);
                      setBulkText("");
                    }}
                    className={`flex items-center gap-3 p-3.5 rounded-md border transition-all text-left ${isSelected ? t.activeClass : t.bgClass + " border-transparent"}`}
                    data-testid={`button-tx-type-${t.value}`}
                  >
                    <div className={`flex items-center justify-center w-10 h-10 rounded-md ${isSelected ? "bg-white/60 dark:bg-black/20" : "bg-white/50 dark:bg-black/10"}`}>
                      <Icon className={`w-5 h-5 ${t.iconClass}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900 dark:text-foreground">{t.label}</p>
                      <p className="text-xs text-gray-500 dark:text-muted-foreground">{t.desc}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? "border-sky-600 bg-sky-600" : "border-gray-300 dark:border-muted"}`}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {txType && (
            <div className="flex flex-col gap-4">
              <Separator />

              {isSaleOrPurchase ? (
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="text-sm font-semibold text-gray-700 dark:text-foreground">3. Urunleri Gir</p>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">{lineItems.length} kalem</Badge>
                      <Button
                        variant={bulkMode ? "default" : "outline"}
                        size="sm"
                        onClick={() => setBulkMode(!bulkMode)}
                        className="gap-1 text-xs"
                        data-testid="button-toggle-bulk"
                      >
                        {bulkMode ? <List className="w-3.5 h-3.5" /> : <ClipboardPaste className="w-3.5 h-3.5" />}
                        {bulkMode ? "Tekli Giris" : "Toplu Yapistir"}
                      </Button>
                    </div>
                  </div>

                  {bulkMode ? (
                    <Card>
                      <CardContent className="p-3">
                        <Textarea
                          placeholder={"Her satira bir urun yazin:\nLevrek, 5, 120\nCipura, kg, 3, 95\nHamsi, kasa, 2, 250"}
                          value={bulkText}
                          onChange={(e) => setBulkText(e.target.value)}
                          rows={6}
                          className="text-sm font-mono bg-white dark:bg-card mb-2"
                          data-testid="textarea-bulk-input"
                        />
                        <p className="text-[10px] text-gray-400 dark:text-muted-foreground mb-2">
                          Format: Urun, Miktar, Fiyat veya Urun, Birim, Miktar, Fiyat
                        </p>
                        <Button onClick={handleBulkParse} className="w-full gap-1.5" data-testid="button-parse-bulk">
                          <ClipboardPaste className="w-4 h-4" />
                          Ayristir ve Ekle
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                  <>
                  <div className="flex flex-col gap-3">
                    {lineItems.map((li, idx) => (
                      <Card key={li.id} className="relative" data-testid={`card-line-item-${li.id}`}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-[11px] font-bold text-gray-400 dark:text-muted-foreground uppercase tracking-wider">Kalem {idx + 1}</span>
                            {lineItems.length > 1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeLineItem(li.id)}
                                data-testid={`button-remove-item-${li.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-gray-400" />
                              </Button>
                            )}
                          </div>
                          <div className="flex flex-col gap-2">
                            <div className="flex gap-2">
                              <Input
                                placeholder="Ürün adı"
                                value={li.productName}
                                onChange={(e) => updateLineItem(li.id, "productName", e.target.value)}
                                className="bg-white dark:bg-card text-sm flex-1"
                                data-testid={`input-product-name-${li.id}`}
                              />
                              <Select
                                value={li.productUnit}
                                onValueChange={(val) => updateLineItem(li.id, "productUnit", val)}
                              >
                                <SelectTrigger className="bg-white dark:bg-card text-sm w-24" data-testid={`select-unit-${li.id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="kg">kg</SelectItem>
                                  <SelectItem value="kasa">kasa</SelectItem>
                                  <SelectItem value="adet">adet</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="relative">
                                <Input
                                  type="number"
                                  inputMode="decimal"
                                  step="0.1"
                                  min="0"
                                  placeholder={`Miktar (${unitLabel(li.productUnit)})`}
                                  value={li.quantity}
                                  onChange={(e) => updateLineItem(li.id, "quantity", e.target.value)}
                                  className="bg-white dark:bg-card text-sm pr-12"
                                  data-testid={`input-quantity-${li.id}`}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-muted-foreground font-medium">{unitLabel(li.productUnit)}</span>
                              </div>
                              <div className="relative">
                                <Input
                                  type="number"
                                  inputMode="decimal"
                                  step="0.01"
                                  min="0"
                                  placeholder="Birim fiyat"
                                  value={li.unitPrice}
                                  onChange={(e) => updateLineItem(li.id, "unitPrice", e.target.value)}
                                  className="bg-white dark:bg-card text-sm pl-6"
                                  data-testid={`input-unit-price-${li.id}`}
                                />
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-muted-foreground font-bold">₺</span>
                              </div>
                            </div>
                            {lineItemTotal(li) > 0 && (
                              <div className="flex items-center justify-end gap-1 mt-0.5">
                                <span className="text-[11px] text-gray-400 dark:text-muted-foreground">Tutar:</span>
                                <span className="text-sm font-bold text-gray-900 dark:text-foreground">{formatCurrency(lineItemTotal(li))}</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <Button
                    variant="outline"
                    className="w-full mt-2 gap-2 border-dashed border-gray-300 dark:border-muted text-gray-500 dark:text-muted-foreground"
                    onClick={addLineItem}
                    data-testid="button-add-line-item"
                  >
                    <Plus className="w-4 h-4" />
                    Yeni Kalem Ekle
                  </Button>
                  </>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-foreground mb-3">3. Tutar ve Detay</p>
                  <div className="flex flex-col gap-3">
                    <div>
                      <Label htmlFor="directAmount" className="text-xs font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wider mb-1.5 block">
                        Tutar (₺)
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-300 dark:text-muted-foreground">₺</span>
                        <Input
                          id="directAmount"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0.01"
                          placeholder="0,00"
                          value={directAmount}
                          onChange={(e) => setDirectAmount(e.target.value)}
                          className="text-2xl h-16 font-bold pl-10 bg-white dark:bg-card"
                          data-testid="input-direct-amount"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="directDesc" className="text-xs font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wider mb-1.5 block">
                        Açıklama (opsiyonel)
                      </Label>
                      <Input
                        id="directDesc"
                        placeholder="Örn: Nakit tahsilat..."
                        value={directDescription}
                        onChange={(e) => setDirectDescription(e.target.value)}
                        className="bg-white dark:bg-card"
                        data-testid="input-direct-description"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <Label className="text-xs font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  <CalendarDays className="w-3.5 h-3.5 inline mr-1" />
                  İşlem Tarihi
                </Label>
                <Input
                  type="date"
                  value={txDate}
                  max={todayISO()}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="bg-white dark:bg-card"
                  data-testid="input-tx-date"
                />
              </div>

              {computedTotal > 0 && (
                <Card className="bg-gray-50 dark:bg-muted/30 border-gray-200 dark:border-muted">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold text-gray-400 dark:text-muted-foreground uppercase tracking-wider mb-3">İşlem Özeti</p>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-500 dark:text-muted-foreground">Firma</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-foreground">{selectedParty.name}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-500 dark:text-muted-foreground">İşlem</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-foreground">{txTypeLabel(txType)}</span>
                      </div>
                      {isSaleOrPurchase && lineItems.filter(li => lineItemTotal(li) > 0).length > 0 && (
                        <>
                          <Separator className="my-1" />
                          {lineItems.filter(li => lineItemTotal(li) > 0).map((li) => (
                            <div key={li.id} className="flex items-center justify-between gap-2">
                              <span className="text-xs text-gray-500 dark:text-muted-foreground">
                                {li.productName || "Ürün"} ({li.quantity}{unitLabel(li.productUnit)} x {formatCurrency(li.unitPrice)})
                              </span>
                              <span className="text-xs font-semibold text-gray-700 dark:text-foreground">{formatCurrency(lineItemTotal(li))}</span>
                            </div>
                          ))}
                          <Separator className="my-1" />
                        </>
                      )}
                      {kdvAmount > 0 && (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-gray-500 dark:text-muted-foreground">Ara Toplam</span>
                            <span className="text-sm font-semibold text-gray-700 dark:text-foreground">{formatCurrency(subtotal)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-gray-500 dark:text-muted-foreground flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              KDV (%1)
                            </span>
                            <span className="text-sm font-semibold text-sky-600 dark:text-sky-400">{formatCurrency(kdvAmount)}</span>
                          </div>
                          <Separator className="my-1" />
                        </>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-gray-700 dark:text-foreground">Toplam</span>
                        <span className="text-xl font-bold text-gray-900 dark:text-foreground">{formatCurrency(computedTotal)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Button
                size="lg"
                className="w-full h-14 text-base font-bold gap-2"
                onClick={handleSubmit}
                disabled={createTxMutation.isPending || !canSubmit}
                data-testid="button-save-transaction"
              >
                {createTxMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Kaydediliyor...
                  </div>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    {txTypeLabel(txType)} Kaydet ({formatCurrency(computedTotal)})
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Firma Ekle</DialogTitle>
            <DialogDescription>Müşteri veya tedarikçi olarak yeni cari hesap açın</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div>
              <Label className="text-xs font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wider mb-1.5 block">Firma Adı</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Firma adını girin" autoFocus data-testid="input-new-name" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wider mb-2 block">Firma Türü</Label>
              <RadioGroup value={newType} onValueChange={(v) => setNewType(v as any)} className="grid grid-cols-2 gap-2">
                <Label
                  htmlFor="r-customer"
                  className={`flex items-center gap-2 p-3 rounded-md border cursor-pointer transition-all ${newType === "customer"
                    ? "ring-2 ring-sky-500 bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800"
                    : "border-gray-200 dark:border-muted"}`}
                >
                  <RadioGroupItem value="customer" id="r-customer" />
                  <div>
                    <p className="font-semibold text-sm">Müşteri</p>
                    <p className="text-[11px] text-gray-400 dark:text-muted-foreground">Mal sattığınız</p>
                  </div>
                </Label>
                <Label
                  htmlFor="r-supplier"
                  className={`flex items-center gap-2 p-3 rounded-md border cursor-pointer transition-all ${newType === "supplier"
                    ? "ring-2 ring-amber-500 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                    : "border-gray-200 dark:border-muted"}`}
                >
                  <RadioGroupItem value="supplier" id="r-supplier" />
                  <div>
                    <p className="font-semibold text-sm">Tedarikçi</p>
                    <p className="text-[11px] text-gray-400 dark:text-muted-foreground">Mal aldığınız</p>
                  </div>
                </Label>
              </RadioGroup>
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wider mb-1.5 block">Telefon (opsiyonel)</Label>
              <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="0555 123 4567" type="tel" data-testid="input-new-phone" />
            </div>
            <div className="flex items-center justify-between gap-3 p-3 rounded-md border border-gray-200 dark:border-muted">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-500 dark:text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-foreground">Faturalı Firma</p>
                  <p className="text-[11px] text-gray-400 dark:text-muted-foreground">Faturalı ise %1 KDV ayrıca eklenir</p>
                </div>
              </div>
              <Switch
                checked={newInvoiced}
                onCheckedChange={setNewInvoiced}
                data-testid="switch-invoiced"
              />
            </div>
            {newInvoiced && (
              <div className="flex flex-col gap-3 p-3 rounded-md bg-sky-50/50 dark:bg-sky-950/10 border border-sky-100 dark:border-sky-900">
                <p className="text-xs font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wider">Fatura Bilgileri</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] text-gray-500 dark:text-muted-foreground mb-1 block">Vergi No</Label>
                    <Input
                      value={newTaxNumber}
                      onChange={(e) => setNewTaxNumber(e.target.value)}
                      placeholder="1234567890"
                      className="bg-white dark:bg-card text-sm"
                      data-testid="input-tax-number"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-gray-500 dark:text-muted-foreground mb-1 block">Vergi Dairesi</Label>
                    <Input
                      value={newTaxOffice}
                      onChange={(e) => setNewTaxOffice(e.target.value)}
                      placeholder="Örn: Karşıyaka"
                      className="bg-white dark:bg-card text-sm"
                      data-testid="input-tax-office"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-[11px] text-gray-500 dark:text-muted-foreground mb-1 block">Firma Unvanı</Label>
                  <Input
                    value={newCompanyTitle}
                    onChange={(e) => setNewCompanyTitle(e.target.value)}
                    placeholder="Örn: ABC Balık Tic. Ltd. Şti."
                    className="bg-white dark:bg-card text-sm"
                    data-testid="input-company-title"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-gray-500 dark:text-muted-foreground mb-1 block">Adres</Label>
                  <Input
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    placeholder="Firma adresi"
                    className="bg-white dark:bg-card text-sm"
                    data-testid="input-address"
                  />
                </div>
              </div>
            )}
            <Button
              onClick={() => createPartyMutation.mutate({
                name: newName,
                type: newType,
                phone: newPhone || undefined,
                invoiced: newInvoiced,
                ...(newInvoiced ? {
                  taxNumber: newTaxNumber || undefined,
                  taxOffice: newTaxOffice || undefined,
                  companyTitle: newCompanyTitle || undefined,
                  address: newAddress || undefined,
                } : {}),
              })}
              disabled={!newName.trim() || createPartyMutation.isPending}
              className="h-12 font-semibold"
              data-testid="button-save-counterparty"
            >
              {createPartyMutation.isPending ? "Kaydediliyor..." : "Firmayı Kaydet"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

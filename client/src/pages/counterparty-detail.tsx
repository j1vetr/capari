import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowLeft, Phone, MessageCircle, Plus, Store, Truck,
  RotateCcw, ShoppingCart, ArrowDownToLine, Banknote, ArrowUpFromLine,
  Download, Check, AlertCircle
} from "lucide-react";
import { formatCurrency, formatDate, txTypeLabel, txTypeColor, txTypeBg, parseLineItems } from "@/lib/formatters";
import { ChevronDown, Fish } from "lucide-react";
import type { CounterpartyWithBalance, Transaction } from "@shared/schema";

export default function CounterpartyDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showAddTx, setShowAddTx] = useState(false);
  const [txType, setTxType] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [confirmReverse, setConfirmReverse] = useState<string | null>(null);
  const [expandedTx, setExpandedTx] = useState<string | null>(null);

  const { data: party, isLoading: partyLoading } = useQuery<CounterpartyWithBalance>({
    queryKey: ["/api/counterparties", params.id],
  });

  const { data: txList, isLoading: txLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/counterparties", params.id, "transactions"],
  });

  const createTxMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/transactions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/counterparties", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/counterparties", params.id, "transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/counterparties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "İşlem kaydedildi" });
      setShowAddTx(false);
      setTxType("");
      setAmount("");
      setDescription("");
    },
  });

  const reverseMutation = useMutation({
    mutationFn: async (txId: string) => {
      const res = await apiRequest("POST", `/api/transactions/${txId}/reverse`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/counterparties", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/counterparties", params.id, "transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/counterparties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "İşlem düzeltildi (ters kayıt oluşturuldu)" });
      setConfirmReverse(null);
    },
  });

  const handleSaveTx = () => {
    if (!txType || !amount) return;
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      toast({ title: "Geçersiz tutar", variant: "destructive" });
      return;
    }
    createTxMutation.mutate({
      counterpartyId: params.id,
      txType,
      amount: num.toFixed(2),
      description: description || undefined,
      txDate: new Date().toISOString().split("T")[0],
    });
  };

  const handleExportPDF = () => {
    window.open(`/api/counterparties/${params.id}/pdf`, "_blank");
  };

  const handleWhatsApp = () => {
    if (!party || !txList) return;
    const lastTxs = txList.slice(0, 5);
    let msg = `*Çapari Balık Dağıtım*\n*Cari Özeti*\n\n`;
    msg += `Firma: ${party.name}\n`;
    msg += `Bakiye: ${formatCurrency(party.balance)}\n`;
    msg += `Tarih: ${new Date().toLocaleDateString("tr-TR")}\n\n`;
    if (lastTxs.length > 0) {
      msg += `Son ${lastTxs.length} İşlem:\n`;
      msg += `${"─".repeat(20)}\n`;
      lastTxs.forEach((tx) => {
        msg += `${formatDate(tx.txDate)} | ${txTypeLabel(tx.txType)} | ${formatCurrency(tx.amount)}`;
        if (tx.description) msg += `\n   ${tx.description}`;
        msg += `\n`;
      });
      msg += `${"─".repeat(20)}\n`;
    }
    const encoded = encodeURIComponent(msg);
    const url = party.phone
      ? `https://wa.me/${party.phone.replace(/\D/g, "")}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, "_blank");
  };

  const filtered = txList?.filter((tx) => filterType === "all" || tx.txType === filterType) || [];

  const txTypeIcon = (type: string) => {
    switch (type) {
      case "sale": return <ShoppingCart className="w-4 h-4" />;
      case "collection": return <ArrowDownToLine className="w-4 h-4" />;
      case "purchase": return <Banknote className="w-4 h-4" />;
      case "payment": return <ArrowUpFromLine className="w-4 h-4" />;
      default: return null;
    }
  };

  const availableTypes = party?.type === "customer"
    ? [
      { value: "sale", label: "Satış", desc: "Mal verildi", icon: ShoppingCart, color: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400" },
      { value: "collection", label: "Tahsilat", desc: "Ödeme alındı", icon: ArrowDownToLine, color: "bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400" },
    ]
    : [
      { value: "purchase", label: "Alım", desc: "Mal alındı", icon: Banknote, color: "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400" },
      { value: "payment", label: "Ödeme", desc: "Ödeme yapıldı", icon: ArrowUpFromLine, color: "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400" },
    ];

  const txCount = txList?.length || 0;
  const reversedIds = new Set(txList?.filter(t => t.reversedOf).map(t => t.reversedOf) || []);

  return (
    <div className="flex flex-col gap-4 p-4 pb-24 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/counterparties")} data-testid="button-back-detail">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          {partyLoading ? (
            <Skeleton className="h-6 w-40" />
          ) : (
            <h1 className="text-lg font-bold tracking-tight text-gray-900 dark:text-foreground truncate">{party?.name}</h1>
          )}
          <p className="text-xs text-gray-400 dark:text-muted-foreground">Cari Kartı</p>
        </div>
      </div>

      {!partyLoading && party && (
        <>
          <Card className={`border-0 ${party.type === "customer"
            ? "bg-gradient-to-br from-sky-50 to-emerald-50 dark:from-sky-950/20 dark:to-emerald-950/20"
            : "bg-gradient-to-br from-amber-50 to-rose-50 dark:from-amber-950/20 dark:to-rose-950/20"
            }`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className={`flex items-center justify-center w-12 h-12 rounded-md ${party.type === "customer"
                    ? "bg-sky-100 dark:bg-sky-900/40"
                    : "bg-amber-100 dark:bg-amber-900/40"
                    }`}>
                    {party.type === "customer"
                      ? <Store className="w-6 h-6 text-sky-600 dark:text-sky-400" />
                      : <Truck className="w-6 h-6 text-amber-600 dark:text-amber-400" />}
                  </div>
                  <div>
                    <Badge variant="secondary" className="text-[10px] mb-1">
                      {party.type === "customer" ? "Müşteri" : "Tedarikçi"}
                    </Badge>
                    {party.phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-gray-400 dark:text-muted-foreground" />
                        <span className="text-xs text-gray-500 dark:text-muted-foreground">{party.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  {txCount} işlem
                </Badge>
              </div>

              <Separator className="my-3 bg-gray-200/50 dark:bg-muted" />

              <div className="text-center">
                <p className="text-xs font-medium text-gray-500 dark:text-muted-foreground uppercase tracking-wider mb-1">
                  {party.type === "customer" ? "Bakiye (Alacak)" : "Bakiye (Borç)"}
                </p>
                <p className={`text-4xl font-bold tracking-tight ${parseFloat(party.balance) > 0
                  ? party.type === "customer" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  : parseFloat(party.balance) < 0
                    ? party.type === "customer" ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                    : "text-gray-400 dark:text-muted-foreground"
                  }`}>
                  {formatCurrency(party.balance)}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" className="h-12 gap-1.5 text-xs font-semibold flex-col py-1" onClick={() => setShowAddTx(true)} data-testid="button-add-tx">
              <Plus className="w-4 h-4" />
              İşlem Ekle
            </Button>
            <Button variant="outline" className="h-12 gap-1.5 text-xs font-semibold flex-col py-1" onClick={handleExportPDF} data-testid="button-export-pdf">
              <Download className="w-4 h-4" />
              PDF İndir
            </Button>
            <Button variant="outline" className="h-12 gap-1.5 text-xs font-semibold flex-col py-1" onClick={handleWhatsApp} data-testid="button-whatsapp">
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </Button>
          </div>
        </>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-gray-400 dark:text-muted-foreground uppercase tracking-wider">İşlem Geçmişi</p>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-28 h-8 text-xs" data-testid="select-filter-type">
            <SelectValue placeholder="Filtrele" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tümü</SelectItem>
            <SelectItem value="sale">Satış</SelectItem>
            <SelectItem value="collection">Tahsilat</SelectItem>
            <SelectItem value="purchase">Alım</SelectItem>
            <SelectItem value="payment">Ödeme</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        {txLoading && Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-3 flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-md" />
              <div className="flex-1">
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-5 w-16" />
            </CardContent>
          </Card>
        ))}

        {!txLoading && filtered.length === 0 && (
          <div className="text-center py-10">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-muted mx-auto mb-3">
              <ShoppingCart className="w-5 h-5 text-gray-400 dark:text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-muted-foreground">Henüz işlem yok</p>
            <p className="text-xs text-gray-400 dark:text-muted-foreground mt-1">İlk işlemi yukarıdaki butondan ekleyin</p>
          </div>
        )}

        {filtered.map((tx) => {
          const isReversed = reversedIds.has(tx.id);
          const isReversal = !!tx.reversedOf;
          const parsedItems = parseLineItems(tx.description);
          const hasItems = !!parsedItems && parsedItems.length > 0;
          const isExpanded = expandedTx === tx.id;
          return (
            <Card
              key={tx.id}
              className={`${isReversed ? "opacity-50" : ""} ${isReversal ? "border-dashed" : ""} ${hasItems ? "cursor-pointer" : ""}`}
              onClick={() => hasItems && setExpandedTx(isExpanded ? null : tx.id)}
              data-testid={`card-tx-${tx.id}`}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className={`flex items-center justify-center w-9 h-9 rounded-md mt-0.5 flex-shrink-0 ${txTypeBg(tx.txType)}`}>
                    {txTypeIcon(tx.txType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-semibold ${txTypeColor(tx.txType)}`}>
                        {txTypeLabel(tx.txType)}
                      </span>
                      {hasItems && (
                        <Badge variant="secondary" className="text-[10px]">{parsedItems!.length} kalem</Badge>
                      )}
                      {isReversal && (
                        <Badge variant="secondary" className="text-[10px]">Düzeltme</Badge>
                      )}
                      {isReversed && (
                        <Badge variant="secondary" className="text-[10px] line-through">İptal Edildi</Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 dark:text-muted-foreground mt-0.5">{formatDate(tx.txDate)}</p>
                    {tx.description && !hasItems && (
                      <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1 leading-relaxed">{tx.description}</p>
                    )}
                    {hasItems && !isExpanded && (
                      <p className="text-xs text-gray-400 dark:text-muted-foreground mt-1 flex items-center gap-1">
                        <span className="truncate">{parsedItems!.map(i => i.product).join(", ")}</span>
                        <ChevronDown className="w-3 h-3 flex-shrink-0" />
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`text-sm font-bold ${isReversed ? "line-through text-gray-400 dark:text-muted-foreground" : "text-gray-900 dark:text-foreground"}`}>
                      {formatCurrency(tx.amount)}
                    </span>
                    {!isReversal && !isReversed && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] gap-1 text-gray-400 dark:text-muted-foreground px-1.5"
                        onClick={(e) => { e.stopPropagation(); setConfirmReverse(tx.id); }}
                        disabled={reverseMutation.isPending}
                        data-testid={`button-reverse-${tx.id}`}
                      >
                        <RotateCcw className="w-3 h-3" />
                        Düzelt
                      </Button>
                    )}
                  </div>
                </div>

                {hasItems && isExpanded && (
                  <div className="mt-3 ml-12" data-testid={`detail-items-${tx.id}`}>
                    <Separator className="mb-3" />
                    <div className="flex flex-col gap-2">
                      {parsedItems!.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2.5" data-testid={`line-item-${tx.id}-${idx}`}>
                          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-gray-50 dark:bg-muted flex-shrink-0">
                            <Fish className="w-3.5 h-3.5 text-gray-400 dark:text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 dark:text-foreground">{item.product}</p>
                            <p className="text-[11px] text-gray-400 dark:text-muted-foreground">
                              {item.quantity} kg x {formatCurrency(item.unitPrice)}
                            </p>
                          </div>
                          <span className="text-xs font-bold text-gray-700 dark:text-foreground flex-shrink-0">
                            {formatCurrency(item.total)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <Separator className="mt-3 mb-2" />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wider">Toplam</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-foreground">{formatCurrency(tx.amount)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={showAddTx} onOpenChange={setShowAddTx}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>İşlem Ekle</DialogTitle>
            <DialogDescription>{party?.name} için yeni işlem kaydet</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div>
              <Label className="text-xs font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wider mb-2 block">İşlem Tipi</Label>
              <div className="grid grid-cols-2 gap-2">
                {availableTypes.map((t) => {
                  const Icon = t.icon;
                  const isSelected = txType === t.value;
                  return (
                    <button
                      key={t.value}
                      onClick={() => setTxType(t.value)}
                      className={`flex items-center gap-2 p-3 rounded-md border transition-all ${isSelected
                        ? "ring-2 ring-sky-500 " + t.color
                        : "border-gray-200 dark:border-muted"
                        }`}
                      data-testid={`button-dialog-tx-${t.value}`}
                    >
                      <Icon className="w-4 h-4" />
                      <div className="text-left">
                        <p className="text-sm font-semibold">{t.label}</p>
                        <p className="text-[10px] text-gray-400 dark:text-muted-foreground">{t.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wider mb-1.5 block">Tutar (₺)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-gray-300 dark:text-muted-foreground">₺</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="text-xl h-14 font-bold pl-9"
                  data-testid="input-dialog-amount"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wider mb-1.5 block">Açıklama (opsiyonel)</Label>
              <Textarea
                placeholder="Örn: Levrek 5kg, Çipura 3kg..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="resize-none"
                rows={2}
                data-testid="input-dialog-description"
              />
            </div>
            <Button
              onClick={handleSaveTx}
              disabled={!txType || !amount || parseFloat(amount) <= 0 || createTxMutation.isPending}
              className="h-12 font-semibold"
              data-testid="button-dialog-save"
            >
              {createTxMutation.isPending ? "Kaydediliyor..." : "İşlemi Kaydet"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmReverse} onOpenChange={() => setConfirmReverse(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              İşlemi Düzelt
            </DialogTitle>
            <DialogDescription>
              Bu işlem için ters kayıt oluşturulacak. Orijinal işlem iptal edilmiş olarak görünecek. Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmReverse(null)}>
              Vazgeç
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => confirmReverse && reverseMutation.mutate(confirmReverse)}
              disabled={reverseMutation.isPending}
            >
              {reverseMutation.isPending ? "İşleniyor..." : "Düzelt"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

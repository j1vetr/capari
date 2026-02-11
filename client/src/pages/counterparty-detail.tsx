import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowLeft, Phone, FileText, MessageCircle, Plus,
  RotateCcw, ShoppingCart, ArrowDownToLine, Banknote, ArrowUpFromLine, Download
} from "lucide-react";
import { formatCurrency, formatDate, txTypeLabel, txTypeColor, txTypeBg } from "@/lib/formatters";
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
      toast({ title: "İşlem düzeltildi" });
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
    let msg = `*Çapari Balık Dağıtım - Cari Özeti*\n`;
    msg += `Firma: ${party.name}\n`;
    msg += `Bakiye: ${formatCurrency(party.balance)}\n\n`;
    msg += `Son işlemler:\n`;
    lastTxs.forEach((tx) => {
      msg += `• ${formatDate(tx.txDate)} - ${txTypeLabel(tx.txType)}: ${formatCurrency(tx.amount)}`;
      if (tx.description) msg += ` (${tx.description})`;
      msg += `\n`;
    });
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
    ? [{ value: "sale", label: "Satış" }, { value: "collection", label: "Tahsilat" }]
    : [{ value: "purchase", label: "Alım" }, { value: "payment", label: "Ödeme" }];

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
            <h1 className="text-xl font-bold tracking-tight truncate">{party?.name}</h1>
          )}
          <p className="text-sm text-muted-foreground">Cari Kartı</p>
        </div>
      </div>

      {!partyLoading && party && (
        <Card>
          <CardContent className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Badge variant="secondary">
                {party.type === "customer" ? "Müşteri" : "Tedarikçi"}
              </Badge>
              {party.phone && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Phone className="w-3.5 h-3.5" />
                  {party.phone}
                </div>
              )}
            </div>
            <div className="text-center py-2">
              <p className="text-sm text-muted-foreground">
                {party.type === "customer" ? "Bakiye (Alacak)" : "Bakiye (Borç)"}
              </p>
              <p className={`text-3xl font-bold tracking-tight ${parseFloat(party.balance) > 0
                ? party.type === "customer" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                : "text-muted-foreground"
                }`}>
                {formatCurrency(party.balance)}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" className="gap-1.5 flex-1" onClick={() => setShowAddTx(true)} data-testid="button-add-tx">
                <Plus className="w-4 h-4" />
                İşlem Ekle
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 flex-1" onClick={handleExportPDF} data-testid="button-export-pdf">
                <Download className="w-4 h-4" />
                PDF
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 flex-1" onClick={handleWhatsApp} data-testid="button-whatsapp">
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-sm font-medium text-muted-foreground">İşlem Geçmişi</h2>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-32" data-testid="select-filter-type">
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
        {txLoading && Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-3">
              <Skeleton className="h-5 w-full mb-1" />
              <Skeleton className="h-4 w-24" />
            </CardContent>
          </Card>
        ))}

        {!txLoading && filtered.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">Henüz işlem yok</p>
          </div>
        )}

        {filtered.map((tx) => (
          <Card key={tx.id} className={tx.reversedOf ? "opacity-60" : ""} data-testid={`card-tx-${tx.id}`}>
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-md mt-0.5 ${txTypeBg(tx.txType)}`}>
                    {txTypeIcon(tx.txType)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-medium ${txTypeColor(tx.txType)}`}>
                        {txTypeLabel(tx.txType)}
                      </span>
                      {tx.reversedOf && (
                        <Badge variant="secondary" className="text-xs">Düzeltme</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDate(tx.txDate)}</p>
                    {tx.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{tx.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold whitespace-nowrap">{formatCurrency(tx.amount)}</span>
                  {!tx.reversedOf && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7"
                      onClick={() => reverseMutation.mutate(tx.id)}
                      disabled={reverseMutation.isPending}
                      data-testid={`button-reverse-${tx.id}`}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showAddTx} onOpenChange={setShowAddTx}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>İşlem Ekle</DialogTitle>
            <DialogDescription>{party?.name}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div>
              <Label className="text-sm font-medium mb-2 block">İşlem Tipi</Label>
              <div className="grid grid-cols-2 gap-2">
                {availableTypes.map((t) => (
                  <Button
                    key={t.value}
                    variant={txType === t.value ? "default" : "outline"}
                    onClick={() => setTxType(t.value)}
                    data-testid={`button-dialog-tx-${t.value}`}
                  >
                    {t.label}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Tutar (₺)</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-xl h-12 font-semibold"
                data-testid="input-dialog-amount"
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Açıklama (opsiyonel)</Label>
              <Textarea
                placeholder="Not ekle..."
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
              data-testid="button-dialog-save"
            >
              {createTxMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

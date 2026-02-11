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
  Download, Check, AlertCircle, FileText, Clock, Pencil, Trash2, CalendarDays
} from "lucide-react";
import { formatCurrency, formatDate, txTypeLabel, txTypeColor, txTypeBg, parseLineItems, todayISO } from "@/lib/formatters";
import { ChevronDown, Fish } from "lucide-react";
import type { CounterpartyWithBalance, Transaction } from "@shared/schema";

type LineItem = {
  id: number;
  product: string;
  quantity: string;
  unitPrice: string;
};

let nextItemId = 1;

export default function CounterpartyDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showAddTx, setShowAddTx] = useState(false);
  const [txType, setTxType] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: nextItemId++, product: "", quantity: "", unitPrice: "" },
  ]);
  const [dialogTxDate, setDialogTxDate] = useState(todayISO());
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [txPage, setTxPage] = useState(0);
  const TX_PAGE_SIZE = 20;
  const [confirmReverse, setConfirmReverse] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [editingDueDay, setEditingDueDay] = useState(false);
  const [dueDayValue, setDueDayValue] = useState("");
  const [editingInfo, setEditingInfo] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");

  const { data: party, isLoading: partyLoading } = useQuery<CounterpartyWithBalance>({
    queryKey: ["/api/counterparties", params.id],
  });

  const txQueryParams = new URLSearchParams();
  if (filterStartDate) txQueryParams.set("startDate", filterStartDate);
  if (filterEndDate) txQueryParams.set("endDate", filterEndDate);
  txQueryParams.set("limit", String(TX_PAGE_SIZE));
  txQueryParams.set("offset", String(txPage * TX_PAGE_SIZE));
  const txQueryString = txQueryParams.toString();

  const { data: txData, isLoading: txLoading } = useQuery<{ transactions: Transaction[]; total: number }>({
    queryKey: ["/api/counterparties", params.id, "transactions", { filterStartDate, filterEndDate, txPage }],
    queryFn: async () => {
      const res = await fetch(`/api/counterparties/${params.id}/transactions?${txQueryString}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load transactions");
      return res.json();
    },
  });
  const txList = txData?.transactions;
  const txTotal = txData?.total ?? 0;

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
      setDialogTxDate(todayISO());
      setLineItems([{ id: nextItemId++, product: "", quantity: "", unitPrice: "" }]);
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

  const updateDueDayMutation = useMutation({
    mutationFn: async (day: number | null) => {
      const res = await apiRequest("PATCH", `/api/counterparties/${params.id}`, { paymentDueDay: day });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/counterparties", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/counterparties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Ödeme günü güncellendi" });
      setEditingDueDay(false);
    },
  });

  const updateInfoMutation = useMutation({
    mutationFn: async (data: { name: string; phone: string | null }) => {
      const res = await apiRequest("PATCH", `/api/counterparties/${params.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/counterparties", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/counterparties"] });
      toast({ title: "Firma bilgileri güncellendi" });
      setEditingInfo(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/counterparties/${params.id}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/counterparties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Cari silindi" });
      navigate("/cariler");
    },
    onError: (err: Error) => {
      toast({ title: "Silinemedi", description: err.message, variant: "destructive" });
    },
  });

  const isSaleOrPurchaseTx = txType === "sale" || txType === "purchase";

  const lineItemTotal = (li: LineItem) => {
    const q = parseFloat(li.quantity) || 0;
    const p = parseFloat(li.unitPrice) || 0;
    return q * p;
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { id: nextItemId++, product: "", quantity: "", unitPrice: "" }]);
  };

  const removeLineItem = (id: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((li) => li.id !== id));
  };

  const updateLineItem = (id: number, field: keyof LineItem, value: string) => {
    setLineItems(lineItems.map((li) => li.id === id ? { ...li, [field]: value } : li));
  };

  const dialogSubtotal = isSaleOrPurchaseTx
    ? lineItems.reduce((s, li) => s + lineItemTotal(li), 0)
    : parseFloat(amount) || 0;

  const detailKdvAmount = party?.invoiced && isSaleOrPurchaseTx ? dialogSubtotal * 0.01 : 0;
  const dialogTotal = dialogSubtotal + detailKdvAmount;

  const dialogDescription = isSaleOrPurchaseTx
    ? lineItems
      .filter((li) => li.product && lineItemTotal(li) > 0)
      .map((li) => `${li.product} ${li.quantity}kg x ${formatCurrency(li.unitPrice)}`)
      .join(", ") + (detailKdvAmount > 0 ? ` [KDV %1: ${formatCurrency(detailKdvAmount)}]` : "")
    : description;

  const handleSaveTx = () => {
    if (!txType) return;
    if (dialogTotal <= 0) {
      toast({ title: "Geçersiz tutar", variant: "destructive" });
      return;
    }
    if (dialogTxDate > todayISO()) {
      toast({ title: "Gelecek tarihli işlem eklenemez", variant: "destructive" });
      return;
    }
    createTxMutation.mutate({
      counterpartyId: params.id,
      txType,
      amount: dialogTotal.toFixed(2),
      description: dialogDescription || undefined,
      txDate: dialogTxDate,
    });
  };

  const handleExportPDF = () => {
    window.open(`/api/counterparties/${params.id}/pdf`, "_blank");
  };

  const [whatsappSending, setWhatsappSending] = useState(false);

  const buildWhatsAppMessage = () => {
    if (!party || !txList) return "";
    const lastTxs = txList.slice(0, 5);
    const bal = parseFloat(party.balance);
    const balLabel = party.type === "customer"
      ? (bal > 0 ? "Alacağımız" : bal < 0 ? "Borcumuz" : "Bakiye")
      : (bal > 0 ? "Borcumuz" : bal < 0 ? "Alacağımız" : "Bakiye");

    let msg = `🐟 *Çapari Balık Dağıtım*\n`;
    msg += `📋 *Cari Hesap Özeti*\n\n`;
    msg += `🏢 *${party.name}*\n`;
    msg += `📅 ${new Date().toLocaleDateString("tr-TR")}\n\n`;
    msg += `💰 *${balLabel}: ${formatCurrency(party.balance)}*\n\n`;

    if (lastTxs.length > 0) {
      msg += `📝 *Son ${lastTxs.length} İşlem:*\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━\n`;
      lastTxs.forEach((tx) => {
        const icon = tx.txType === "sale" ? "🛒" : tx.txType === "collection" ? "💵" : tx.txType === "purchase" ? "📦" : "💳";
        msg += `${icon} ${formatDate(tx.txDate)} - ${txTypeLabel(tx.txType)}\n`;
        msg += `     *${formatCurrency(tx.amount)}*`;
        if (tx.description) msg += `\n     _${tx.description}_`;
        msg += `\n\n`;
      });
      msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    }

    msg += `\n_Bu mesaj Çapari Balık Dağıtım cari takip sisteminden gönderilmiştir._`;
    return msg;
  };

  const handleWhatsApp = async () => {
    if (!party || !txList) return;
    const msg = buildWhatsAppMessage();

    if (party.phone) {
      setWhatsappSending(true);
      try {
        const res = await apiRequest("POST", "/api/whatsapp/send", {
          receiver: party.phone,
          message: msg,
        });
        const result = await res.json();
        if (result.success) {
          toast({ title: "WhatsApp mesajı gönderildi" });
        } else {
          toast({ title: "Mesaj gönderilemedi", description: result.message, variant: "destructive" });
        }
      } catch (e: any) {
        toast({ title: "WhatsApp gönderilemedi", description: e.message, variant: "destructive" });
      } finally {
        setWhatsappSending(false);
      }
    } else {
      const encoded = encodeURIComponent(msg);
      window.open(`https://wa.me/?text=${encoded}`, "_blank");
    }
  };

  const [pdfSending, setPdfSending] = useState(false);

  const handleWhatsAppDetailed = async () => {
    if (!party || !txList) return;
    if (!party.phone) {
      toast({ title: "Telefon numarası gerekli", description: "Detaylı cari göndermek için telefon numarası olmalı.", variant: "destructive" });
      return;
    }
    setPdfSending(true);
    try {
      const msg = buildWhatsAppMessage() + "\n\n📎 _Detayli cari hesap ekstreniz PDF olarak iletilmektedir._";
      const textRes = await apiRequest("POST", "/api/whatsapp/send", {
        receiver: party.phone,
        message: msg,
      });
      const textResult = await textRes.json();
      if (!textRes.ok) {
        toast({ title: "Mesaj gönderilemedi", description: textResult.message || "Bilinmeyen hata", variant: "destructive" });
        setPdfSending(false);
        return;
      }
      toast({ title: "Mesaj iletildi, PDF hazirlaniyor..." });

      const pdfRes = await apiRequest("POST", "/api/whatsapp/send-pdf", {
        receiver: party.phone,
        counterpartyId: party.id,
        message: `${party.name} - Cari Hesap Ekstre`,
      });
      const pdfResult = await pdfRes.json();
      if (pdfResult.success) {
        toast({ title: "PDF de WhatsApp ile iletildi" });
      } else {
        toast({ title: "PDF gönderilemedi", description: pdfResult.message, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Gönderilemedi", description: e.message, variant: "destructive" });
    } finally {
      setPdfSending(false);
    }
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
        <Button variant="ghost" size="icon" onClick={() => navigate("/cariler")} data-testid="button-back-detail">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          {partyLoading ? (
            <Skeleton className="h-6 w-40" />
          ) : (
            <div className="flex items-center gap-1.5">
              <h1 className="text-lg font-bold tracking-tight text-gray-900 dark:text-foreground truncate">{party?.name}</h1>
              <Button
                variant="ghost"
                size="icon"
                className="flex-shrink-0"
                onClick={() => {
                  if (party) {
                    setEditName(party.name);
                    setEditPhone(party.phone || "");
                    setEditingInfo(true);
                  }
                }}
                data-testid="button-edit-info"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            </div>
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
                    <div className="flex items-center gap-1 mb-1 flex-wrap">
                      <Badge variant="secondary" className="text-[10px]">
                        {party.type === "customer" ? "Müşteri" : "Tedarikçi"}
                      </Badge>
                      {party.invoiced && (
                        <Badge variant="secondary" className="text-[10px] gap-0.5">
                          <FileText className="w-2.5 h-2.5" />
                          Faturalı
                        </Badge>
                      )}
                    </div>
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

              {party.invoiced && (party.taxNumber || party.taxOffice || party.companyTitle || party.address) && (
                <div className="mt-2 p-3 rounded-md bg-white/50 dark:bg-black/10 border border-gray-100 dark:border-muted">
                  <p className="text-[10px] font-semibold text-gray-400 dark:text-muted-foreground uppercase tracking-wider mb-2">Fatura Bilgileri</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {party.companyTitle && (
                      <div className="col-span-2">
                        <p className="text-[10px] text-gray-400 dark:text-muted-foreground">Unvan</p>
                        <p className="text-xs font-medium text-gray-700 dark:text-foreground">{party.companyTitle}</p>
                      </div>
                    )}
                    {party.taxNumber && (
                      <div>
                        <p className="text-[10px] text-gray-400 dark:text-muted-foreground">Vergi No</p>
                        <p className="text-xs font-medium text-gray-700 dark:text-foreground">{party.taxNumber}</p>
                      </div>
                    )}
                    {party.taxOffice && (
                      <div>
                        <p className="text-[10px] text-gray-400 dark:text-muted-foreground">Vergi Dairesi</p>
                        <p className="text-xs font-medium text-gray-700 dark:text-foreground">{party.taxOffice}</p>
                      </div>
                    )}
                    {party.address && (
                      <div className="col-span-2 mt-1">
                        <p className="text-[10px] text-gray-400 dark:text-muted-foreground">Adres</p>
                        <p className="text-xs font-medium text-gray-700 dark:text-foreground">{party.address}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-3 p-3 rounded-md bg-white/50 dark:bg-black/10 border border-gray-100 dark:border-muted">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-orange-500" />
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 dark:text-muted-foreground uppercase tracking-wider">Ödeme Günü</p>
                      {party.paymentDueDay ? (
                        <p className="text-sm font-bold text-gray-800 dark:text-foreground">Her ayın {party.paymentDueDay}. günü</p>
                      ) : (
                        <p className="text-xs text-gray-400 dark:text-muted-foreground">Belirlenmedi</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setDueDayValue(party.paymentDueDay?.toString() || "");
                      setEditingDueDay(true);
                    }}
                    data-testid="button-edit-due-day"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </div>
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
            <Button variant="outline" className="h-12 gap-1.5 text-xs font-semibold flex-col py-1" onClick={handleWhatsApp} disabled={whatsappSending} data-testid="button-whatsapp">
              <MessageCircle className="w-4 h-4" />
              {whatsappSending ? "Gönderiliyor..." : "Hızlı Cari WhatsApp"}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-12 gap-1.5 text-xs font-semibold flex-col py-1" onClick={handleWhatsAppDetailed} disabled={pdfSending || !party?.phone} data-testid="button-whatsapp-pdf">
              <FileText className="w-4 h-4" />
              {pdfSending ? "Gönderiliyor..." : "Detaylı Cari WhatsApp"}
            </Button>
            <Button variant="outline" className="h-12 gap-1.5 text-xs font-semibold flex-col py-1 text-red-500 dark:text-red-400" onClick={() => setConfirmDelete(true)} data-testid="button-delete-counterparty">
              <Trash2 className="w-4 h-4" />
              Sil
            </Button>
          </div>
        </>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs font-semibold text-gray-400 dark:text-muted-foreground uppercase tracking-wider">İşlem Geçmişi</p>
          <div className="flex items-center gap-2 flex-wrap">
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
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            type="date"
            value={filterStartDate}
            onChange={(e) => { setFilterStartDate(e.target.value); setTxPage(0); }}
            className="h-8 text-xs w-[130px]"
            placeholder="Başlangıç"
            data-testid="input-filter-start-date"
          />
          <span className="text-xs text-gray-400">-</span>
          <Input
            type="date"
            value={filterEndDate}
            onChange={(e) => { setFilterEndDate(e.target.value); setTxPage(0); }}
            className="h-8 text-xs w-[130px]"
            placeholder="Bitiş"
            data-testid="input-filter-end-date"
          />
          {(filterStartDate || filterEndDate) && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterStartDate(""); setFilterEndDate(""); setTxPage(0); }} data-testid="button-clear-date-filter">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
          <Badge variant="secondary" className="text-[10px] ml-auto">{txTotal} işlem</Badge>
        </div>
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

        {txTotal > TX_PAGE_SIZE && (
          <div className="flex items-center justify-between gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTxPage(p => Math.max(0, p - 1))}
              disabled={txPage === 0}
              data-testid="button-prev-page"
            >
              Önceki
            </Button>
            <span className="text-xs text-gray-500 dark:text-muted-foreground">
              {txPage * TX_PAGE_SIZE + 1}-{Math.min((txPage + 1) * TX_PAGE_SIZE, txTotal)} / {txTotal}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTxPage(p => p + 1)}
              disabled={(txPage + 1) * TX_PAGE_SIZE >= txTotal}
              data-testid="button-next-page"
            >
              Sonraki
            </Button>
          </div>
        )}
      </div>

      <Dialog open={showAddTx} onOpenChange={setShowAddTx}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
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
                      onClick={() => {
                        setTxType(t.value);
                        setLineItems([{ id: nextItemId++, product: "", quantity: "", unitPrice: "" }]);
                        setAmount("");
                        setDescription("");
                      }}
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

            {txType && isSaleOrPurchaseTx && (
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <Label className="text-xs font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wider">Ürünler</Label>
                  <Badge variant="secondary" className="text-[10px]">{lineItems.length} kalem</Badge>
                </div>
                <div className="flex flex-col gap-2.5">
                  {lineItems.map((li, idx) => (
                    <Card key={li.id} data-testid={`card-dialog-line-item-${li.id}`}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[11px] font-bold text-gray-400 dark:text-muted-foreground uppercase tracking-wider">Kalem {idx + 1}</span>
                          {lineItems.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeLineItem(li.id)}
                              data-testid={`button-dialog-remove-item-${li.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-gray-400" />
                            </Button>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <Input
                            placeholder="Ürün adı (örn: Levrek)"
                            value={li.product}
                            onChange={(e) => updateLineItem(li.id, "product", e.target.value)}
                            className="text-sm"
                            data-testid={`input-dialog-product-${li.id}`}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <div className="relative">
                              <Input
                                type="number"
                                inputMode="decimal"
                                step="0.1"
                                min="0"
                                placeholder="Miktar (kg)"
                                value={li.quantity}
                                onChange={(e) => updateLineItem(li.id, "quantity", e.target.value)}
                                className="text-sm pr-8"
                                data-testid={`input-dialog-quantity-${li.id}`}
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-muted-foreground font-medium">kg</span>
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
                                className="text-sm pl-6"
                                data-testid={`input-dialog-unit-price-${li.id}`}
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
                  data-testid="button-dialog-add-line-item"
                >
                  <Plus className="w-4 h-4" />
                  Yeni Kalem Ekle
                </Button>
              </div>
            )}

            {txType && !isSaleOrPurchaseTx && (
              <>
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
                    placeholder="Örn: Nakit ödeme..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="resize-none"
                    rows={2}
                    data-testid="input-dialog-description"
                  />
                </div>
              </>
            )}

            {txType && (
              <div>
                <Label className="text-xs font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  <CalendarDays className="w-3.5 h-3.5 inline mr-1" />
                  İşlem Tarihi
                </Label>
                <Input
                  type="date"
                  value={dialogTxDate}
                  max={todayISO()}
                  onChange={(e) => setDialogTxDate(e.target.value)}
                  data-testid="input-dialog-tx-date"
                />
              </div>
            )}

            {txType && dialogSubtotal > 0 && (
              <div className="flex flex-col gap-1.5 p-3 rounded-md bg-sky-50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500 dark:text-muted-foreground">Ara Toplam</span>
                  <span className="text-sm font-semibold text-gray-700 dark:text-foreground">{formatCurrency(dialogSubtotal)}</span>
                </div>
                {detailKdvAmount > 0 && (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-500 dark:text-muted-foreground flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        KDV (%1)
                      </span>
                      <span className="text-sm font-semibold text-sky-600 dark:text-sky-400">{formatCurrency(detailKdvAmount)}</span>
                    </div>
                    <Separator />
                  </>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-gray-700 dark:text-foreground">Toplam</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-foreground">{formatCurrency(dialogTotal)}</span>
                </div>
              </div>
            )}

            <Button
              onClick={handleSaveTx}
              disabled={!txType || dialogTotal <= 0 || createTxMutation.isPending}
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

      <Dialog open={editingInfo} onOpenChange={setEditingInfo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-sky-500" />
              Firma Bilgilerini Düzenle
            </DialogTitle>
            <DialogDescription>
              Firma adını ve telefon numarasını güncelleyin.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div>
              <Label className="text-xs font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Firma Adı
              </Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Firma adı"
                data-testid="input-edit-name"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Telefon
              </Label>
              <Input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="05xx xxx xx xx"
                data-testid="input-edit-phone"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditingInfo(false)}>
                Vazgeç
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  if (!editName.trim()) {
                    toast({ title: "Firma adı boş olamaz", variant: "destructive" });
                    return;
                  }
                  updateInfoMutation.mutate({
                    name: editName.trim(),
                    phone: editPhone.trim() || null,
                  });
                }}
                disabled={updateInfoMutation.isPending}
                data-testid="button-save-info"
              >
                {updateInfoMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editingDueDay} onOpenChange={setEditingDueDay}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              Ödeme Günü Belirle
            </DialogTitle>
            <DialogDescription>
              Bu firma için ayın hangi günü ödeme yapılacağını belirleyin. Kaldırmak için boş bırakıp kaydedin.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div>
              <Label className="text-xs font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Ayın Günü (1-31)
              </Label>
              <Input
                type="number"
                min="1"
                max="31"
                value={dueDayValue}
                onChange={(e) => setDueDayValue(e.target.value)}
                placeholder="Örn: 15"
                data-testid="input-due-day"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditingDueDay(false)}>
                Vazgeç
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  const val = dueDayValue.trim();
                  if (!val) {
                    updateDueDayMutation.mutate(null);
                  } else {
                    const num = parseInt(val);
                    if (num >= 1 && num <= 31) {
                      updateDueDayMutation.mutate(num);
                    } else {
                      toast({ title: "1-31 arası bir gün girin", variant: "destructive" });
                    }
                  }
                }}
                disabled={updateDueDayMutation.isPending}
                data-testid="button-save-due-day"
              >
                {updateDueDayMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <Trash2 className="w-5 h-5" />
              Cari Sil
            </DialogTitle>
            <DialogDescription>
              {party?.name} ve tüm işlem geçmişi kalıcı olarak silinecek. Bu işlem geri alınamaz.
              {party && parseFloat(party.balance) !== 0 && (
                <span className="block mt-2 text-red-600 dark:text-red-400 font-semibold">
                  Bakiyesi sıfır olmayan cari silinemez.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>
              Vazgeç
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending || (party ? parseFloat(party.balance) !== 0 : true)}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Siliniyor..." : "Evet, Sil"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

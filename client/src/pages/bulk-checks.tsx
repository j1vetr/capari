import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Search, Plus, ArrowLeft, Check, Trash2, Store, Truck } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { CounterpartyWithBalance } from "@shared/schema";

type CheckEntry = {
  id: number;
  kind: "check" | "note";
  direction: "received" | "given";
  amount: string;
  dueDate: string;
  notes: string;
};

let nextId = 1;

function emptyEntry(): CheckEntry {
  return { id: nextId++, kind: "check", direction: "received", amount: "", dueDate: "", notes: "" };
}

export default function BulkChecks() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedParty, setSelectedParty] = useState<CounterpartyWithBalance | null>(null);
  const [entries, setEntries] = useState<CheckEntry[]>([emptyEntry()]);
  const [saving, setSaving] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: parties } = useQuery<CounterpartyWithBalance[]>({
    queryKey: ["/api/counterparties"],
  });

  const filtered = parties?.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const addEntry = () => {
    const last = entries[entries.length - 1];
    setEntries([...entries, { ...emptyEntry(), kind: last.kind, direction: last.direction }]);
  };

  const removeEntry = (id: number) => {
    if (entries.length <= 1) return;
    setEntries(entries.filter(e => e.id !== id));
  };

  const updateEntry = (id: number, field: keyof CheckEntry, value: string) => {
    setEntries(entries.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const totalAmount = entries.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  const validEntries = entries.filter(e => parseFloat(e.amount) > 0 && e.dueDate);

  const handleSaveAll = async () => {
    if (!selectedParty) return;
    if (validEntries.length === 0) {
      toast({ title: "En az bir ge\u00E7erli kay\u0131t girin", variant: "destructive" });
      return;
    }
    setSaving(true);
    let successCount = 0;
    for (const e of validEntries) {
      try {
        await apiRequest("POST", "/api/checks", {
          counterpartyId: selectedParty.id,
          kind: e.kind,
          direction: e.direction,
          amount: parseFloat(e.amount).toFixed(2),
          dueDate: e.dueDate,
          status: "pending",
          notes: e.notes || null,
        });
        successCount++;
      } catch (err: any) {
        toast({ title: "Hata", description: err.message, variant: "destructive" });
      }
    }
    setSaving(false);
    if (successCount > 0) {
      queryClient.invalidateQueries({ queryKey: ["/api/counterparties", selectedParty.id, "checks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/checks/upcoming"] });
      toast({ title: `${successCount} kay\u0131t eklendi` });
      setEntries([emptyEntry()]);
      setSelectedParty(null);
      setSearch("");
    }
  };

  if (!selectedParty) {
    return (
      <div className="flex flex-col gap-4 p-4 pb-24 max-w-lg mx-auto" data-testid="page-bulk-checks">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-foreground">Toplu \u00C7ek/Senet</h1>
            <p className="text-xs text-gray-500 dark:text-muted-foreground">Cari se\u00E7in, toplu giri\u015F yap\u0131n</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari ara\u2026"
            className="pl-10"
            autoFocus
            data-testid="input-search-party"
          />
        </div>

        <div className="flex flex-col gap-2">
          {filtered.length === 0 && search.length > 0 && (
            <p className="text-center text-sm text-gray-400 dark:text-muted-foreground py-6">Sonu\u00E7 bulunamad\u0131</p>
          )}
          {(search.length > 0 ? filtered : (parties || []).slice(0, 20)).map((p) => {
            const bal = parseFloat(p.balance);
            const isCustomer = p.type === "customer";
            return (
              <Card
                key={p.id}
                className="hover-elevate cursor-pointer"
                onClick={() => setSelectedParty(p)}
                data-testid={`card-party-${p.id}`}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`flex items-center justify-center w-9 h-9 rounded-md ${isCustomer ? "bg-sky-50 dark:bg-sky-950/30" : "bg-amber-50 dark:bg-amber-950/30"}`}>
                    {isCustomer ? <Store className="w-4 h-4 text-sky-600 dark:text-sky-400" /> : <Truck className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-foreground truncate">{p.name}</p>
                    <p className="text-[10px] text-gray-400 dark:text-muted-foreground">
                      {isCustomer ? "M\u00FC\u015Fteri" : "Tedarik\u00E7i"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${bal > 0 ? "text-emerald-600 dark:text-emerald-400" : bal < 0 ? "text-red-600 dark:text-red-400" : "text-gray-400"}`}>
                      {formatCurrency(p.balance)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-24 max-w-lg mx-auto" data-testid="page-bulk-checks-entry">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => { setSelectedParty(null); setSearch(""); setEntries([emptyEntry()]); }} data-testid="button-back-to-search">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 dark:text-foreground truncate">{selectedParty.name}</h1>
          <p className="text-xs text-gray-500 dark:text-muted-foreground">Toplu \u00E7ek/senet giri\u015Fi</p>
        </div>
        <Badge variant="secondary" className="text-xs">
          {selectedParty.type === "customer" ? "M\u00FC\u015Fteri" : "Tedarik\u00E7i"}
        </Badge>
      </div>

      <div className="flex flex-col gap-3">
        {entries.map((entry, idx) => (
          <Card key={entry.id}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <Badge variant="outline" className="text-[10px]">#{idx + 1}</Badge>
                {entries.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeEntry(entry.id)}
                    data-testid={`button-remove-entry-${entry.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <Label className="text-[10px] text-gray-500 dark:text-muted-foreground mb-1 block">Tur</Label>
                  <Select value={entry.kind} onValueChange={(v) => updateEntry(entry.id, "kind", v)}>
                    <SelectTrigger className="h-8 text-xs" data-testid={`select-kind-${entry.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="check">\u00C7ek</SelectItem>
                      <SelectItem value="note">Senet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] text-gray-500 dark:text-muted-foreground mb-1 block">Yon</Label>
                  <Select value={entry.direction} onValueChange={(v) => updateEntry(entry.id, "direction", v)}>
                    <SelectTrigger className="h-8 text-xs" data-testid={`select-direction-${entry.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="received">Al\u0131nan</SelectItem>
                      <SelectItem value="given">Verilen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <Label className="text-[10px] text-gray-500 dark:text-muted-foreground mb-1 block">Tutar</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={entry.amount}
                    onChange={(e) => updateEntry(entry.id, "amount", e.target.value)}
                    placeholder="0.00"
                    className="h-8 text-xs"
                    data-testid={`input-amount-${entry.id}`}
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-gray-500 dark:text-muted-foreground mb-1 block">Vade</Label>
                  <Input
                    type="date"
                    value={entry.dueDate}
                    onChange={(e) => updateEntry(entry.id, "dueDate", e.target.value)}
                    className="h-8 text-xs"
                    data-testid={`input-due-date-${entry.id}`}
                  />
                </div>
              </div>

              <div>
                <Label className="text-[10px] text-gray-500 dark:text-muted-foreground mb-1 block">Not (opsiyonel)</Label>
                <Input
                  value={entry.notes}
                  onChange={(e) => updateEntry(entry.id, "notes", e.target.value)}
                  placeholder="Banka, seri no vs."
                  className="h-8 text-xs"
                  data-testid={`input-notes-${entry.id}`}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button variant="outline" className="w-full" onClick={addEntry} data-testid="button-add-entry">
        <Plus className="w-4 h-4 mr-1" />
        Sat\u0131r Ekle
      </Button>

      <Card className="bg-gray-50 dark:bg-muted/30 border-0">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 dark:text-muted-foreground">Toplam</p>
              <p className="text-lg font-bold text-gray-900 dark:text-foreground">{formatCurrency(totalAmount)}</p>
            </div>
            <Badge variant="secondary" className="text-xs">{validEntries.length} ge\u00E7erli kay\u0131t</Badge>
          </div>
        </CardContent>
      </Card>

      <Button
        className="w-full"
        onClick={handleSaveAll}
        disabled={saving || validEntries.length === 0}
        data-testid="button-save-all"
      >
        {saving ? "Kaydediliyor..." : (
          <>
            <Check className="w-4 h-4 mr-1" />
            {validEntries.length} Kay\u0131d\u0131 Ekle
          </>
        )}
      </Button>
    </div>
  );
}

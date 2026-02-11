import { useState, useEffect } from "react";
import { Switch, Route, useLocation, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LayoutDashboard, Plus, Users, FileBarChart, LogOut, Search, Store, Truck, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/formatters";
import type { CounterpartyWithBalance } from "@shared/schema";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import QuickTransaction from "@/pages/quick-transaction";
import Counterparties from "@/pages/counterparties";
import CounterpartyDetail from "@/pages/counterparty-detail";
import Reports from "@/pages/reports";
import Stock from "@/pages/stock";
import Login from "@/pages/login";

const NAV_ITEMS = [
  { path: "/", label: "Ana Sayfa", icon: LayoutDashboard, match: (l: string) => l === "/" },
  { path: "/islem-ekle", label: "İşlem Ekle", icon: Plus, match: (l: string) => l.startsWith("/islem-ekle") },
  { path: "/cariler", label: "Cariler", icon: Users, match: (l: string) => l.startsWith("/cariler") },
  { path: "/stok", label: "Stok", icon: Package, match: (l: string) => l.startsWith("/stok") },
  { path: "/raporlar", label: "Raporlar", icon: FileBarChart, match: (l: string) => l.startsWith("/raporlar") },
];

function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white dark:bg-card border-gray-200 dark:border-card-border safe-area-bottom" data-testid="nav-bottom">
      <div className="max-w-lg mx-auto grid grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.match(location);
          return (
            <Link key={item.path} href={item.path}>
              <div
                className={`flex flex-col items-center gap-0.5 py-2.5 transition-colors ${isActive
                  ? "text-sky-600 dark:text-sky-400"
                  : "text-gray-400 dark:text-muted-foreground"
                  }`}
                data-testid={`nav-item-${item.path.replace("/", "") || "home"}`}
              >
                <div className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors ${isActive ? "bg-sky-50 dark:bg-sky-950/30" : ""}`}>
                  <Icon className={`w-5 h-5 ${item.path === "/islem-ekle" && !isActive ? "stroke-[2.5]" : ""}`} />
                </div>
                <span className="text-[10px] font-semibold leading-tight tracking-wide">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/islem-ekle" component={QuickTransaction} />
      <Route path="/cariler" component={Counterparties} />
      <Route path="/cariler/:id" component={CounterpartyDetail} />
      <Route path="/stok" component={Stock} />
      <Route path="/raporlar" component={Reports} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp({ onLogout }: { onLogout: () => void }) {
  const [, navigate] = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CounterpartyWithBalance[]>([]);
  const [allCounterparties, setAllCounterparties] = useState<CounterpartyWithBalance[]>([]);

  useEffect(() => {
    if (searchOpen && allCounterparties.length === 0) {
      fetch("/api/counterparties", { credentials: "include" })
        .then(r => r.json())
        .then(data => setAllCounterparties(data))
        .catch(() => {});
    }
  }, [searchOpen]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(allCounterparties.slice(0, 10));
    } else {
      const q = searchQuery.toLowerCase();
      setSearchResults(allCounterparties.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q))
      ).slice(0, 10));
    }
  }, [searchQuery, allCounterparties]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    queryClient.clear();
    onLogout();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      <header className="sticky top-0 z-40 bg-white dark:bg-card border-b border-gray-100 dark:border-card-border">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9">
              <img src="/logo.png" alt="Çapari Balık" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight leading-tight text-gray-900 dark:text-foreground">Çapari Balık</h1>
              <p className="text-[10px] font-medium text-gray-400 dark:text-muted-foreground tracking-wider uppercase">Dağıtım</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setSearchOpen(true); setSearchQuery(""); }}
              data-testid="button-global-search"
            >
              <Search className="w-4 h-4 text-gray-500" />
            </Button>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-medium text-gray-400 dark:text-muted-foreground">Çevrimiçi</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4 text-gray-400" />
            </Button>
          </div>
        </div>
      </header>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cari Ara</DialogTitle>
            <DialogDescription>Ad veya telefon numarasıyla arayın</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Cari adı veya telefon..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            data-testid="input-global-search"
          />
          <div className="flex flex-col gap-1.5 mt-2">
            {searchResults.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-muted-foreground text-center py-4">Sonuç bulunamadı</p>
            )}
            {searchResults.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 p-2.5 rounded-md cursor-pointer hover-elevate"
                onClick={() => { setSearchOpen(false); navigate(`/cariler/${c.id}`); }}
                data-testid={`search-result-${c.id}`}
              >
                <div className={`flex items-center justify-center w-8 h-8 rounded-md flex-shrink-0 ${c.type === "customer" ? "bg-sky-50 dark:bg-sky-950/30" : "bg-amber-50 dark:bg-amber-950/30"}`}>
                  {c.type === "customer" ? <Store className="w-4 h-4 text-sky-600 dark:text-sky-400" /> : <Truck className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 dark:text-foreground truncate">{c.name}</p>
                  <p className="text-[10px] text-gray-400 dark:text-muted-foreground">
                    {c.type === "customer" ? "Müşteri" : "Tedarikçi"}{c.phone ? ` - ${c.phone}` : ""}
                  </p>
                </div>
                <span className={`text-xs font-bold flex-shrink-0 ${parseFloat(c.balance) > 0 ? "text-red-600 dark:text-red-400" : parseFloat(c.balance) < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-muted-foreground"}`}>
                  {formatCurrency(c.balance)}
                </span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <main className="pb-20">
        <Router />
      </main>
      <BottomNav />
    </div>
  );
}

function App() {
  const [authState, setAuthState] = useState<"loading" | "login" | "authenticated">("loading");

  useEffect(() => {
    fetch("/api/auth/check", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        setAuthState(data.authenticated ? "authenticated" : "login");
      })
      .catch(() => {
        setAuthState("login");
      });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {authState === "loading" && (
          <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-background">
            <div className="flex flex-col items-center gap-4">
              <div className="w-36 h-36">
                <img src="/logo.png" alt="Çapari Balık" className="w-full h-full object-contain" />
              </div>
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        )}
        {authState === "login" && (
          <Login onSuccess={() => setAuthState("authenticated")} />
        )}
        {authState === "authenticated" && (
          <AuthenticatedApp onLogout={() => setAuthState("login")} />
        )}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

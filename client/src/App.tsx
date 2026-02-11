import { Switch, Route, useLocation, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LayoutDashboard, Plus, Users, FileBarChart, Fish } from "lucide-react";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import QuickTransaction from "@/pages/quick-transaction";
import Counterparties from "@/pages/counterparties";
import CounterpartyDetail from "@/pages/counterparty-detail";
import Reports from "@/pages/reports";

const NAV_ITEMS = [
  { path: "/", label: "Ana Sayfa", icon: LayoutDashboard, match: (l: string) => l === "/" },
  { path: "/quick", label: "İşlem Ekle", icon: Plus, match: (l: string) => l.startsWith("/quick") },
  { path: "/counterparties", label: "Cariler", icon: Users, match: (l: string) => l.startsWith("/counterparties") },
  { path: "/reports", label: "Raporlar", icon: FileBarChart, match: (l: string) => l.startsWith("/reports") },
];

function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white dark:bg-card border-gray-200 dark:border-card-border safe-area-bottom" data-testid="nav-bottom">
      <div className="max-w-lg mx-auto grid grid-cols-4">
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
                  <Icon className={`w-5 h-5 ${item.path === "/quick" && !isActive ? "stroke-[2.5]" : ""}`} />
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
      <Route path="/quick" component={QuickTransaction} />
      <Route path="/counterparties" component={Counterparties} />
      <Route path="/counterparties/:id" component={CounterpartyDetail} />
      <Route path="/reports" component={Reports} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-gray-50 dark:bg-background">
          <header className="sticky top-0 z-40 bg-white dark:bg-card border-b border-gray-100 dark:border-card-border">
            <div className="max-w-lg mx-auto flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-9 h-9 rounded-md bg-sky-600 text-white">
                  <Fish className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-base font-bold tracking-tight leading-tight text-gray-900 dark:text-foreground">Çapari Balık</h1>
                  <p className="text-[10px] font-medium text-gray-400 dark:text-muted-foreground tracking-wider uppercase">Dağıtım</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-medium text-gray-400 dark:text-muted-foreground">Çevrimiçi</span>
              </div>
            </div>
          </header>
          <main className="pb-20">
            <Router />
          </main>
          <BottomNav />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

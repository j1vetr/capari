import { Switch, Route, useLocation, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LayoutDashboard, Zap, Users, FileBarChart } from "lucide-react";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import QuickTransaction from "@/pages/quick-transaction";
import Counterparties from "@/pages/counterparties";
import CounterpartyDetail from "@/pages/counterparty-detail";
import Reports from "@/pages/reports";

const NAV_ITEMS = [
  { path: "/", label: "Ana Sayfa", icon: LayoutDashboard },
  { path: "/quick", label: "Hızlı İşlem", icon: Zap },
  { path: "/counterparties", label: "Cariler", icon: Users },
  { path: "/reports", label: "Raporlar", icon: FileBarChart },
];

function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-card-border" data-testid="nav-bottom">
      <div className="max-w-lg mx-auto flex">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.path === "/"
            ? location === "/"
            : location.startsWith(item.path);
          return (
            <Link key={item.path} href={item.path} className="flex-1">
              <div
                className={`flex flex-col items-center gap-0.5 py-2 px-1 transition-colors ${isActive
                  ? "text-primary"
                  : "text-muted-foreground"
                  }`}
                data-testid={`nav-item-${item.path.replace("/", "") || "home"}`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium leading-tight">{item.label}</span>
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
        <div className="min-h-screen bg-background">
          <header className="sticky top-0 z-40 bg-primary text-primary-foreground">
            <div className="max-w-lg mx-auto flex items-center justify-between gap-2 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight">Çapari Balık</span>
              </div>
              <span className="text-xs opacity-80">Dağıtım</span>
            </div>
          </header>
          <main className="pb-16">
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

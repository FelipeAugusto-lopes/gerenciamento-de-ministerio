import { Link, useLocation, useNavigate } from "react-router-dom";
import { Calendar, Users, Church, Menu, X, LayoutDashboard, Search, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import GlobalSearch from "@/components/GlobalSearch";

const navItems = [
  { to: "/", label: "Início", icon: LayoutDashboard },
  { to: "/escalas", label: "Escalas", icon: Calendar },
  { to: "/membros", label: "Membros", icon: Users },
  { to: "/ministerios", label: "Ministérios", icon: Church },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Global ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen(o => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-card/70 backdrop-blur-xl supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-16 items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 group">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
              <Church className="h-5 w-5" />
            </span>
            <div className="flex flex-col leading-none">
              <span className="font-display text-lg font-bold tracking-tight text-foreground">INA Escalas</span>
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Servir juntos</span>
            </div>
          </Link>

          <nav className="hidden gap-1 md:flex items-center rounded-full border border-border/60 bg-muted/40 p-1">
            {navItems.map(item => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all",
                    active
                      ? "nav-pill-active bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Buscar (Ctrl+K)"
              className="hidden md:inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 hover:bg-muted transition-colors px-3 py-1.5 text-xs text-muted-foreground"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Buscar…</span>
              <kbd className="ml-1 rounded border bg-card px-1.5 py-0.5 text-[10px] font-mono">
                {isMac ? "⌘" : "Ctrl"}K
              </kbd>
            </button>
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Buscar"
              className="md:hidden inline-flex items-center justify-center rounded-full h-9 w-9 text-foreground hover:bg-muted transition-colors"
            >
              <Search className="h-5 w-5" />
            </button>
            <button
              className="md:hidden text-foreground p-2 -mr-2"
              aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav className="border-t bg-card/95 backdrop-blur-xl p-4 md:hidden animate-fade-in space-y-1">
            {navItems.map(item => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      <main className="container py-6 sm:py-8 px-4 sm:px-6">{children}</main>

      {/* Floating Action Button — Nova Escala */}
      <button
        onClick={() => {
          const today = new Date().toISOString().split("T")[0];
          navigate(`/?new=1&date=${today}`);
        }}
        aria-label="Nova escala"
        className="fixed bottom-5 right-5 sm:bottom-8 sm:right-8 z-40 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-elegant hover:scale-105 active:scale-95 transition-transform h-14 pl-4 pr-5 font-semibold"
      >
        <Plus className="h-5 w-5" />
        <span className="hidden sm:inline">Nova escala</span>
      </button>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}

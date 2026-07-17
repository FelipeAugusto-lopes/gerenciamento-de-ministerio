import { Link, useLocation, useNavigate } from "react-router-dom";
import { Calendar, Users, Church, Menu, X, LayoutDashboard, Search, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import GlobalSearch from "@/components/GlobalSearch";
import ThemeToggle from "@/components/ThemeToggle";

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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-primary focus:text-primary-foreground focus:px-3 focus:py-2"
      >
        Pular para o conteúdo
      </a>
      <header className="sticky top-0 z-50 border-b border-border/60 bg-card/70 backdrop-blur-xl supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-16 items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 group" aria-label="INA Escalas — Início">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
              <Church className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="flex flex-col leading-none">
              <span className="font-display text-lg font-bold tracking-tight text-foreground">INA Escalas</span>
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Servir juntos</span>
            </div>
          </Link>

          <nav aria-label="Principal" className="hidden gap-1 md:flex items-center rounded-full border border-border/60 bg-muted/40 p-1">
            {navItems.map(item => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                    active
                      ? "nav-pill-active bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Buscar (Ctrl+K)"
              className="hidden md:inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 hover:bg-muted transition-colors px-3 py-1.5 text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Buscar…</span>
              <kbd className="ml-1 rounded border bg-card px-1.5 py-0.5 text-[10px] font-mono">
                {isMac ? "⌘" : "Ctrl"}K
              </kbd>
            </button>
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Buscar"
              className="md:hidden inline-flex items-center justify-center rounded-full h-11 w-11 text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Search className="h-5 w-5" aria-hidden="true" />
            </button>
            <ThemeToggle className="h-11 w-11 md:h-9 md:w-9" />
            <button
              className="md:hidden text-foreground inline-flex items-center justify-center h-11 w-11 -mr-1 rounded-full hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav aria-label="Menu móvel" className="border-t bg-card/95 backdrop-blur-xl p-4 md:hidden animate-fade-in space-y-1">
            {navItems.map(item => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors min-h-11",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      <main id="main-content" className="container py-6 sm:py-8 px-4 sm:px-6 pb-28 md:pb-8">{children}</main>

      {/* Bottom navigation (mobile) */}
      <nav
        aria-label="Navegação inferior"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-card/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="grid grid-cols-4">
          {navItems.map(item => {
            const active = location.pathname === item.to;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-14 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon className={cn("h-5 w-5", active && "scale-110 transition-transform")} aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Floating Action Button — Nova Escala */}
      <button
        onClick={() => {
          const today = new Date().toISOString().split("T")[0];
          navigate(`/?new=1&date=${today}`);
        }}
        aria-label="Nova escala"
        className="fixed right-4 sm:right-8 bottom-20 md:bottom-8 z-40 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-elegant hover:scale-105 active:scale-95 transition-transform h-14 pl-4 pr-5 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        <Plus className="h-5 w-5" aria-hidden="true" />
        <span className="hidden sm:inline">Nova escala</span>
      </button>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}

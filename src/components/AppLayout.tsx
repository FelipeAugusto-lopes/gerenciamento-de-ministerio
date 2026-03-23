import { Link, useLocation } from "react-router-dom";
import { Calendar, Users, Church, Menu, X, LogOut, Shield, UserCircle } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/store/AuthContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { currentUser, logout, isAdmin } = useAuth();

  const navItems = [
    { to: "/", label: "Escalas", icon: Calendar, show: true },
    { to: "/membros", label: "Membros", icon: Users, show: true },
    { to: "/ministerios", label: "Ministérios", icon: Church, show: true },
    { to: "/usuarios", label: "Usuários", icon: Shield, show: isAdmin },
  ].filter(i => i.show);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Church className="h-6 w-6 text-primary" />
            <span className="font-display text-xl font-bold text-foreground">Escalas</span>
          </Link>

          <nav className="hidden gap-1 md:flex items-center">
            {navItems.map(item => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  location.pathname === item.to
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
            <div className="ml-3 pl-3 border-l border-border flex items-center gap-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <UserCircle className="h-4 w-4" />
                <span className="max-w-[120px] truncate">{currentUser?.name}</span>
                <span className="text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded bg-muted">
                  {currentUser?.role === "admin" ? "Admin" : "Líder"}
                </span>
              </div>
              <button onClick={logout} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors" title="Sair">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </nav>

          <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {mobileOpen && (
          <nav className="border-t bg-card p-4 md:hidden animate-fade-in space-y-1">
            {navItems.map(item => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                  location.pathname === item.to
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            ))}
            <div className="border-t border-border mt-2 pt-2">
              <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
                <UserCircle className="h-4 w-4" />
                {currentUser?.name}
                <span className="text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded bg-muted">
                  {currentUser?.role === "admin" ? "Admin" : "Líder"}
                </span>
              </div>
              <button
                onClick={() => { logout(); setMobileOpen(false); }}
                className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 w-full"
              >
                <LogOut className="h-5 w-5" /> Sair
              </button>
            </div>
          </nav>
        )}
      </header>

      <main className="container py-6">{children}</main>
    </div>
  );
}

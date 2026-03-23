import { useState } from "react";
import { useAuth } from "@/store/AuthContext";
import { Church, LogIn, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const { login } = useAuth();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    if (!name.trim() || !password.trim()) {
      setError("Preencha todos os campos");
      return;
    }
    setLoading(true);
    // Simulate brief delay for UX
    await new Promise(r => setTimeout(r, 300));
    const ok = login(name.trim(), password);
    if (!ok) setError("Nome ou senha incorretos");
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8 animate-fade-in">
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mb-4">
            <Church className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">Escalas</h1>
          <p className="text-sm text-muted-foreground mt-1">Sistema de Gestão de Ministérios</p>
        </div>

        <div className="rounded-xl border bg-card p-6 space-y-4 shadow-sm">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Nome</label>
            <Input
              placeholder="Digite seu nome"
              value={name}
              onChange={e => { setName(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              className="h-12 text-base"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Senha</label>
            <Input
              type="password"
              placeholder="Digite sua senha"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              className="h-12 text-base"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive animate-fade-in">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <Button onClick={handleLogin} disabled={loading} className="w-full h-12 text-base gap-2">
            <LogIn className="h-5 w-5" />
            {loading ? "Entrando..." : "Entrar"}
          </Button>

          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium">Acesso inicial:</p>
            <p>Nome: <span className="font-mono text-foreground">Administrador</span></p>
            <p>Senha: <span className="font-mono text-foreground">admin123</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}

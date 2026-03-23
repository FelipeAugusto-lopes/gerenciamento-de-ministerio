import { useState } from "react";
import { useAuth } from "@/store/AuthContext";
import { useStore } from "@/store/StoreContext";
import { Plus, Trash2, Shield, User, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

export default function UsersPage() {
  const { users, addUser, deleteUser, currentUser } = useAuth();
  const { ministries } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ name: "", password: "", role: "leader" as UserRole, ministryId: "" });

  const handleAdd = () => {
    if (!form.name.trim() || !form.password.trim()) return;
    if (form.role === "leader" && !form.ministryId) return;
    addUser({
      name: form.name.trim(),
      password: form.password,
      role: form.role,
      ministryId: form.role === "leader" ? form.ministryId : undefined,
    });
    setForm({ name: "", password: "", role: "leader", ministryId: "" });
    setShowAdd(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Usuários</h1>
          <p className="text-sm text-muted-foreground">Gerencie quem acessa o sistema</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-2 h-12 px-6 text-base">
          <Plus className="h-5 w-5" /> Novo Usuário
        </Button>
      </div>

      {saved && (
        <div className="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 p-3 text-sm text-primary animate-fade-in">
          <CheckCircle2 className="h-4 w-4" /> Usuário salvo com sucesso!
        </div>
      )}

      {showAdd && (
        <div className="rounded-lg border bg-card p-5 space-y-4 animate-fade-in">
          <Input placeholder="Nome do usuário" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-12 text-base" />
          <Input type="password" placeholder="Senha" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="h-12 text-base" />
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Tipo de acesso</label>
            <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as UserRole }))}>
              <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador (acesso total)</SelectItem>
                <SelectItem value="leader">Líder de Ministério</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.role === "leader" && (
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Ministério vinculado</label>
              <Select value={form.ministryId} onValueChange={v => setForm(f => ({ ...f, ministryId: v }))}>
                <SelectTrigger className="h-12 text-base"><SelectValue placeholder="Selecione o ministério" /></SelectTrigger>
                <SelectContent>
                  {ministries.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={handleAdd} className="h-12 px-6 text-base">Salvar</Button>
            <Button variant="outline" onClick={() => setShowAdd(false)} className="h-12 px-6 text-base">Cancelar</Button>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {users.map(u => {
          const ministry = ministries.find(m => m.id === u.ministryId);
          return (
            <div key={u.id} className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex items-center justify-center h-10 w-10 rounded-full",
                    u.role === "admin" ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"
                  )}>
                    {u.role === "admin" ? <Shield className="h-5 w-5" /> : <User className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{u.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {u.role === "admin" ? "Administrador" : `Líder — ${ministry?.name || "?"}`}
                    </p>
                  </div>
                </div>
                {u.id !== currentUser?.id && (
                  <button onClick={() => deleteUser(u.id)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

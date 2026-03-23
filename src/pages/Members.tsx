import { useState } from "react";
import { useStore } from "@/store/StoreContext";
import { getMinistryStyle } from "@/lib/helpers";
import { Plus, Pencil, Trash2, X, Check, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function MembersPage() {
  const { members, ministries, addMember, updateMember, deleteMember } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", ministryIds: [] as string[] });

  const resetForm = () => setForm({ name: "", phone: "", ministryIds: [] });

  const toggleMinistry = (id: string) => {
    setForm(prev => ({
      ...prev,
      ministryIds: prev.ministryIds.includes(id)
        ? prev.ministryIds.filter(x => x !== id)
        : [...prev.ministryIds, id],
    }));
  };

  const handleAdd = () => {
    if (!form.name.trim()) return;
    addMember({ name: form.name.trim(), phone: form.phone || undefined, ministryIds: form.ministryIds });
    resetForm();
    setShowAdd(false);
  };

  const handleSave = () => {
    if (!form.name.trim() || !editId) return;
    updateMember({ id: editId, name: form.name.trim(), phone: form.phone || undefined, ministryIds: form.ministryIds });
    setEditId(null);
    resetForm();
  };

  const startEdit = (m: typeof members[0]) => {
    setEditId(m.id);
    setForm({ name: m.name, phone: m.phone || "", ministryIds: m.ministryIds });
  };

  const FormFields = ({ onSubmit }: { onSubmit: () => void }) => (
    <div className="space-y-3">
      <Input placeholder="Nome completo" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} onKeyDown={e => e.key === "Enter" && onSubmit()} />
      <Input placeholder="Telefone (opcional)" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
      <div>
        <p className="text-xs text-muted-foreground mb-2">Ministérios:</p>
        <div className="flex flex-wrap gap-2">
          {ministries.map(min => (
            <button key={min.id} onClick={() => toggleMinistry(min.id)} className={cn("ministry-badge border transition-all", form.ministryIds.includes(min.id) ? "ring-2 ring-offset-1 ring-foreground/20" : "opacity-50")} style={getMinistryStyle(min.colorIndex)}>
              {min.name}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onSubmit}><Check className="h-4 w-4 mr-1" /> Salvar</Button>
        <Button size="sm" variant="outline" onClick={() => { setShowAdd(false); setEditId(null); resetForm(); }}><X className="h-4 w-4 mr-1" /> Cancelar</Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Membros</h1>
          <p className="text-sm text-muted-foreground">{members.length} membro{members.length !== 1 ? "s" : ""} cadastrado{members.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => { resetForm(); setShowAdd(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Novo
        </Button>
      </div>

      {showAdd && (
        <div className="rounded-lg border bg-card p-4 animate-fade-in">
          <FormFields onSubmit={handleAdd} />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {members.map(m => (
          <div key={m.id} className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-md">
            {editId === m.id ? (
              <FormFields onSubmit={handleSave} />
            ) : (
              <>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-foreground">{m.name}</h3>
                    {m.phone && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Phone className="h-3 w-3" /> {m.phone}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(m)} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => deleteMember(m.id)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {m.ministryIds.map(mid => {
                    const min = ministries.find(x => x.id === mid);
                    if (!min) return null;
                    return <span key={mid} className="ministry-badge border" style={getMinistryStyle(min.colorIndex)}>{min.name}</span>;
                  })}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

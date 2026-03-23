import { useState, useMemo } from "react";
import { useStore } from "@/store/StoreContext";
import { useAuth } from "@/store/AuthContext";
import { getMinistryStyle, formatDate, getDayOfWeek } from "@/lib/helpers";
import { Plus, Pencil, Trash2, X, Check, Phone, Search, History, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { MINISTRY_COLORS, type ScheduleStatus } from "@/types";

const statusColors: Record<ScheduleStatus, string> = {
  Pendente: "bg-accent/20 text-accent-foreground border-accent/30",
  Confirmado: "bg-primary/15 text-primary border-primary/30",
  Concluído: "bg-muted text-muted-foreground border-border",
};

export default function MembersPage() {
  const { members, ministries, schedules, addMember, updateMember, deleteMember } = useStore();
  const { isAdmin } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", ministryIds: [] as string[] });
  const [search, setSearch] = useState("");
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [historyMemberId, setHistoryMemberId] = useState<string | null>(null);

  const showSaved = () => { setSavedFeedback(true); setTimeout(() => setSavedFeedback(false), 2000); };

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
    showSaved();
  };

  const handleSave = () => {
    if (!form.name.trim() || !editId) return;
    updateMember({ id: editId, name: form.name.trim(), phone: form.phone || undefined, ministryIds: form.ministryIds });
    setEditId(null);
    resetForm();
    showSaved();
  };

  const startEdit = (m: typeof members[0]) => {
    setEditId(m.id);
    setForm({ name: m.name, phone: m.phone || "", ministryIds: m.ministryIds });
  };

  const filteredMembers = useMemo(() => {
    if (!search) return members;
    const s = search.toLowerCase();
    return members.filter(m => m.name.toLowerCase().includes(s));
  }, [members, search]);

  const memberHistory = useMemo(() => {
    if (!historyMemberId) return [];
    return schedules.filter(s => s.memberId === historyMemberId).sort((a, b) => b.date.localeCompare(a.date));
  }, [historyMemberId, schedules]);

  const FormFields = ({ onSubmit }: { onSubmit: () => void }) => (
    <div className="space-y-4">
      <Input placeholder="Nome completo" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} onKeyDown={e => e.key === "Enter" && onSubmit()} className="h-12 text-base" />
      <Input placeholder="Telefone (opcional)" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="h-12 text-base" />
      <div>
        <p className="text-sm font-medium text-foreground mb-2">Ministérios:</p>
        <div className="flex flex-wrap gap-2">
          {ministries.map(min => (
            <button key={min.id} onClick={() => toggleMinistry(min.id)} className={cn("ministry-badge border transition-all text-sm py-1 px-3", form.ministryIds.includes(min.id) ? "ring-2 ring-offset-1 ring-foreground/20" : "opacity-50")} style={getMinistryStyle(min.colorIndex)}>
              {min.name}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Button className="h-12 px-6 text-base" onClick={onSubmit}><Check className="h-5 w-5 mr-1" /> Salvar</Button>
        <Button className="h-12 px-6 text-base" variant="outline" onClick={() => { setShowAdd(false); setEditId(null); resetForm(); }}><X className="h-5 w-5 mr-1" /> Cancelar</Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {savedFeedback && (
        <div className="fixed top-20 right-4 z-50 flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-3 shadow-lg animate-fade-in">
          <CheckCircle2 className="h-5 w-5" /> Salvo com sucesso!
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Membros</h1>
          <p className="text-sm text-muted-foreground">{members.length} membro{members.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => { resetForm(); setShowAdd(true); }} className="gap-2 h-12 px-6 text-base">
          <Plus className="h-5 w-5" /> Novo Membro
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-12 text-base pl-11"
        />
      </div>

      {showAdd && (
        <div className="rounded-lg border bg-card p-5 animate-fade-in">
          <FormFields onSubmit={handleAdd} />
        </div>
      )}

      {/* Member history dialog */}
      <Dialog open={!!historyMemberId} onOpenChange={() => setHistoryMemberId(null)}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <History className="h-5 w-5 text-primary" />
              Histórico — {members.find(m => m.id === historyMemberId)?.name}
            </DialogTitle>
          </DialogHeader>
          {memberHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma escala registrada.</p>
          ) : (
            <div className="space-y-2 pt-2">
              {memberHistory.map(s => {
                const ministry = ministries.find(m => m.id === s.ministryId);
                return (
                  <div key={s.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                    <span className="ministry-badge border" style={ministry ? getMinistryStyle(ministry.colorIndex) : {}}>{ministry?.name || "?"}</span>
                    <div className="flex-1 text-sm">
                      <span className="text-foreground">{formatDate(s.date)}</span>
                      <span className="text-muted-foreground ml-2">{getDayOfWeek(s.date)} • {s.shift}</span>
                    </div>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full border", statusColors[s.status])}>{s.status}</span>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredMembers.map(m => (
          <div key={m.id} className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-md">
            {editId === m.id ? (
              <FormFields onSubmit={handleSave} />
            ) : (
              <>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <button onClick={() => setHistoryMemberId(m.id)} className="font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1.5">
                      {m.name}
                      <History className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    {m.phone && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Phone className="h-3 w-3" /> {m.phone}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(m)} className="rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => deleteMember(m.id)} className="rounded p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
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
        {filteredMembers.length === 0 && (
          <div className="col-span-full text-center py-8 text-muted-foreground text-sm">
            Nenhum membro encontrado.
          </div>
        )}
      </div>
    </div>
  );
}

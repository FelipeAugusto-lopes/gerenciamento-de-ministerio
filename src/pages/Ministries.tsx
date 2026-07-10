import { useState, useMemo } from "react";
import { useStore } from "@/store/StoreContext";
import { useAudit } from "@/store/AuditContext";
import { getMinistryStyle, sortMinistries } from "@/lib/helpers";
import { MINISTRY_COLORS } from "@/types";
import { Plus, Pencil, Trash2, X, Check, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function MinistriesPage() {
  const { ministries, addMinistry, updateMinistry, deleteMinistry } = useStore();
  const { addEntry } = useAudit();
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(0);
  const [savedFeedback, setSavedFeedback] = useState(false);

  const sortedMinistries = useMemo(() => sortMinistries(ministries), [ministries]);

  const showSaved = () => { setSavedFeedback(true); setTimeout(() => setSavedFeedback(false), 2000); };

  const handleAdd = () => {
    if (!newName.trim()) return;
    addMinistry({ name: newName.trim(), colorIndex: newColor });
    addEntry("Adicionou ministério", newName.trim());
    setNewName(""); setNewColor(0); setShowAdd(false); showSaved();
  };

  const handleSave = () => {
    if (!editName.trim() || !editId) return;
    updateMinistry({ id: editId, name: editName.trim(), colorIndex: editColor });
    addEntry("Editou ministério", editName.trim());
    setEditId(null); showSaved();
  };

  const handleDelete = (m: typeof ministries[0]) => {
    deleteMinistry(m.id);
    addEntry("Removeu ministério", m.name);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {savedFeedback && (
        <div className="fixed top-20 right-4 z-50 flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-3 shadow-lg animate-fade-in">
          <CheckCircle2 className="h-5 w-5" /> Salvo com sucesso!
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Ministérios</h1>
          <p className="page-subtitle">Gerencie os ministérios da igreja</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-2 h-12 px-6 text-base shadow-md hover:shadow-lg transition-shadow">
          <Plus className="h-5 w-5" /> Novo Ministério
        </Button>
      </div>

      {showAdd && (
        <div className="content-card p-5 space-y-4 animate-fade-in">
          <Input placeholder="Nome do ministério" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdd()} className="h-12 text-base" />
          <div className="flex flex-wrap gap-2">
            {MINISTRY_COLORS.map((c, i) => (
              <button key={i} onClick={() => setNewColor(i)} className={cn("h-10 w-10 rounded-full border-2 transition-transform", newColor === i ? "scale-125 border-foreground" : "border-transparent")} style={{ backgroundColor: `hsl(${c})` }} />
            ))}
          </div>
          <div className="flex gap-2">
            <Button className="h-12 px-6 text-base" onClick={handleAdd}><Check className="h-5 w-5 mr-1" /> Salvar</Button>
            <Button className="h-12 px-6 text-base" variant="outline" onClick={() => setShowAdd(false)}><X className="h-5 w-5 mr-1" /> Cancelar</Button>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sortedMinistries.map(m => (
          <div key={m.id} className="item-card" style={{ borderLeftWidth: 4, borderLeftColor: `hsl(${MINISTRY_COLORS[m.colorIndex % MINISTRY_COLORS.length]})` }}>
            {editId === m.id ? (
              <div className="space-y-3">
                <Input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSave()} className="h-12 text-base" />
                <div className="flex flex-wrap gap-2">
                  {MINISTRY_COLORS.map((c, i) => (
                    <button key={i} onClick={() => setEditColor(i)} className={cn("h-8 w-8 rounded-full border-2 transition-transform", editColor === i ? "scale-125 border-foreground" : "border-transparent")} style={{ backgroundColor: `hsl(${c})` }} />
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button className="h-12 px-6 text-base" onClick={handleSave}><Check className="h-5 w-5" /></Button>
                  <Button className="h-12 px-6 text-base" variant="outline" onClick={() => setEditId(null)}><X className="h-5 w-5" /></Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="ministry-badge border text-sm" style={getMinistryStyle(m.colorIndex)}>{m.name}</span>
                <div className="flex gap-1">
                  <button onClick={() => { setEditId(m.id); setEditName(m.name); setEditColor(m.colorIndex); }} className="rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(m)} className="rounded p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

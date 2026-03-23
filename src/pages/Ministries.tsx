import { useState } from "react";
import { useStore } from "@/store/StoreContext";
import { getMinistryStyle } from "@/lib/helpers";
import { MINISTRY_COLORS } from "@/types";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function MinistriesPage() {
  const { ministries, addMinistry, updateMinistry, deleteMinistry } = useStore();
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(0);

  const handleAdd = () => {
    if (!newName.trim()) return;
    addMinistry({ name: newName.trim(), colorIndex: newColor });
    setNewName("");
    setNewColor(0);
    setShowAdd(false);
  };

  const handleSave = () => {
    if (!editName.trim() || !editId) return;
    updateMinistry({ id: editId, name: editName.trim(), colorIndex: editColor });
    setEditId(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Ministérios</h1>
          <p className="text-sm text-muted-foreground">Gerencie os ministérios da igreja</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Novo
        </Button>
      </div>

      {showAdd && (
        <div className="rounded-lg border bg-card p-4 space-y-3 animate-fade-in">
          <Input placeholder="Nome do ministério" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdd()} />
          <div className="flex flex-wrap gap-2">
            {MINISTRY_COLORS.map((c, i) => (
              <button key={i} onClick={() => setNewColor(i)} className={cn("h-8 w-8 rounded-full border-2 transition-transform", newColor === i ? "scale-125 border-foreground" : "border-transparent")} style={{ backgroundColor: `hsl(${c})` }} />
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd}><Check className="h-4 w-4 mr-1" /> Salvar</Button>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}><X className="h-4 w-4 mr-1" /> Cancelar</Button>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ministries.map(m => (
          <div key={m.id} className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-md" style={{ borderLeftWidth: 4, borderLeftColor: `hsl(${MINISTRY_COLORS[m.colorIndex % MINISTRY_COLORS.length]})` }}>
            {editId === m.id ? (
              <div className="space-y-3">
                <Input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSave()} />
                <div className="flex flex-wrap gap-2">
                  {MINISTRY_COLORS.map((c, i) => (
                    <button key={i} onClick={() => setEditColor(i)} className={cn("h-6 w-6 rounded-full border-2 transition-transform", editColor === i ? "scale-125 border-foreground" : "border-transparent")} style={{ backgroundColor: `hsl(${c})` }} />
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSave}><Check className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => setEditId(null)}><X className="h-4 w-4" /></Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="ministry-badge border" style={getMinistryStyle(m.colorIndex)}>{m.name}</span>
                <div className="flex gap-1">
                  <button onClick={() => { setEditId(m.id); setEditName(m.name); setEditColor(m.colorIndex); }} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => deleteMinistry(m.id)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
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

import { useState, useMemo } from "react";
import { useStore } from "@/store/StoreContext";
import { getMinistryStyle, getDayOfWeek, formatDate } from "@/lib/helpers";
import { MINISTRY_COLORS, type Shift, type ScheduleStatus } from "@/types";
import { Plus, Trash2, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusColors: Record<ScheduleStatus, string> = {
  Pendente: "bg-accent/20 text-accent-foreground border-accent/30",
  Confirmado: "bg-primary/15 text-primary border-primary/30",
  Concluído: "bg-muted text-muted-foreground border-border",
};

export default function SchedulesPage() {
  const { schedules, ministries, members, addSchedule, updateSchedule, deleteSchedule } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [filterDate, setFilterDate] = useState("");
  const [filterMinistry, setFilterMinistry] = useState("all");
  const [filterShift, setFilterShift] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const [newForm, setNewForm] = useState({
    ministryId: "",
    date: new Date().toISOString().split("T")[0],
    shift: "Manhã" as Shift,
    memberId: "",
    status: "Pendente" as ScheduleStatus,
  });

  const filtered = useMemo(() => {
    return schedules
      .filter(s => !filterDate || s.date === filterDate)
      .filter(s => filterMinistry === "all" || s.ministryId === filterMinistry)
      .filter(s => filterShift === "all" || s.shift === filterShift)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [schedules, filterDate, filterMinistry, filterShift]);

  const handleAdd = () => {
    if (!newForm.ministryId || !newForm.memberId || !newForm.date) return;
    addSchedule(newForm);
    setShowAdd(false);
    setNewForm({ ministryId: "", date: new Date().toISOString().split("T")[0], shift: "Manhã", memberId: "", status: "Pendente" });
  };

  const activeFilters = (filterDate ? 1 : 0) + (filterMinistry !== "all" ? 1 : 0) + (filterShift !== "all" ? 1 : 0);

  // Members filtered by selected ministry
  const availableMembers = newForm.ministryId
    ? members.filter(m => m.ministryIds.includes(newForm.ministryId))
    : members;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Escalas</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} escala{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="gap-2 relative">
            <Filter className="h-4 w-4" /> Filtros
            {activeFilters > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold">{activeFilters}</span>
            )}
          </Button>
          <Button onClick={() => setShowAdd(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Nova
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="rounded-lg border bg-card p-4 animate-fade-in">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Data</label>
              <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Ministério</label>
              <Select value={filterMinistry} onValueChange={setFilterMinistry}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {ministries.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Turno</label>
              <Select value={filterShift} onValueChange={setFilterShift}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Manhã">Manhã</SelectItem>
                  <SelectItem value="Noite">Noite</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => { setFilterDate(""); setFilterMinistry("all"); setFilterShift("all"); }}>
              <X className="h-3 w-3 mr-1" /> Limpar filtros
            </Button>
          )}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="rounded-lg border bg-card p-4 space-y-3 animate-fade-in">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Ministério</label>
              <Select value={newForm.ministryId} onValueChange={v => setNewForm(f => ({ ...f, ministryId: v, memberId: "" }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {ministries.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Pessoa</label>
              <Select value={newForm.memberId} onValueChange={v => setNewForm(f => ({ ...f, memberId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {availableMembers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Data</label>
              <Input type="date" value={newForm.date} onChange={e => setNewForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Turno</label>
              <Select value={newForm.shift} onValueChange={v => setNewForm(f => ({ ...f, shift: v as Shift }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Manhã">Manhã</SelectItem>
                  <SelectItem value="Noite">Noite</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd}>Adicionar</Button>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Schedule cards (mobile) / table (desktop) */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Calendar className="h-12 w-12 mb-3 opacity-40" />
          <p className="text-sm">Nenhuma escala encontrada</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden">
            {filtered.map(s => {
              const ministry = ministries.find(m => m.id === s.ministryId);
              const member = members.find(m => m.id === s.memberId);
              return (
                <div key={s.id} className="rounded-lg border bg-card p-4 space-y-2" style={{ borderLeftWidth: 4, borderLeftColor: ministry ? `hsl(${MINISTRY_COLORS[ministry.colorIndex % MINISTRY_COLORS.length]})` : undefined }}>
                  <div className="flex items-center justify-between">
                    <span className="ministry-badge border" style={ministry ? getMinistryStyle(ministry.colorIndex) : {}}>{ministry?.name || "?"}</span>
                    <button onClick={() => deleteSchedule(s.id)} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <p className="font-medium text-foreground">{member?.name || "?"}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatDate(s.date)}</span>
                    <span>{getDayOfWeek(s.date)}</span>
                    <span>{s.shift}</span>
                  </div>
                  <Select value={s.status} onValueChange={v => updateSchedule({ ...s, status: v as ScheduleStatus })}>
                    <SelectTrigger className={cn("w-fit h-7 text-xs border", statusColors[s.status])}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pendente">Pendente</SelectItem>
                      <SelectItem value="Confirmado">Confirmado</SelectItem>
                      <SelectItem value="Concluído">Concluído</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ministério</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Data</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Dia</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Turno</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Pessoa</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const ministry = ministries.find(m => m.id === s.ministryId);
                  const member = members.find(m => m.id === s.memberId);
                  return (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="ministry-badge border" style={ministry ? getMinistryStyle(ministry.colorIndex) : {}}>{ministry?.name || "?"}</span>
                      </td>
                      <td className="px-4 py-3 text-foreground">{formatDate(s.date)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{getDayOfWeek(s.date)}</td>
                      <td className="px-4 py-3 text-foreground">{s.shift}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{member?.name || "?"}</td>
                      <td className="px-4 py-3">
                        <Select value={s.status} onValueChange={v => updateSchedule({ ...s, status: v as ScheduleStatus })}>
                          <SelectTrigger className={cn("w-fit h-7 text-xs border", statusColors[s.status])}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pendente">Pendente</SelectItem>
                            <SelectItem value="Confirmado">Confirmado</SelectItem>
                            <SelectItem value="Concluído">Concluído</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => deleteSchedule(s.id)} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// Need to import Calendar icon
import { Calendar } from "lucide-react";

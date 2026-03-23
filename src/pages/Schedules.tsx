import { useState, useMemo } from "react";
import { useStore } from "@/store/StoreContext";
import { getMinistryStyle, getDayOfWeek, formatDate } from "@/lib/helpers";
import { MINISTRY_COLORS, type Shift, type ScheduleStatus } from "@/types";
import { Plus, Trash2, Filter, X, Calendar, AlertTriangle, Shield, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const statusColors: Record<ScheduleStatus, string> = {
  Pendente: "bg-accent/20 text-accent-foreground border-accent/30",
  Confirmado: "bg-primary/15 text-primary border-primary/30",
  Concluído: "bg-muted text-muted-foreground border-border",
};

interface ConflictInfo {
  memberId: string;
  existingSchedules: { ministryName: string; shift: string }[];
  sameShift: boolean;
}

export default function SchedulesPage() {
  const { schedules, ministries, members, addSchedule, updateSchedule, deleteSchedule } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [filterDate, setFilterDate] = useState("");
  const [filterMinistry, setFilterMinistry] = useState("all");
  const [filterShift, setFilterShift] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [blockSameDay, setBlockSameDay] = useState(true);
  const [blockSameShift, setBlockSameShift] = useState(false);

  const [newForm, setNewForm] = useState({
    ministryId: "",
    date: new Date().toISOString().split("T")[0],
    shift: "Manhã" as Shift,
    memberId: "",
    status: "Pendente" as ScheduleStatus,
  });

  // Conflict detection for current form
  const getConflictsForMember = (memberId: string, date: string, shift: Shift): ConflictInfo | null => {
    if (!memberId || !date) return null;
    const existing = schedules.filter(s => s.memberId === memberId && s.date === date);
    if (existing.length === 0) return null;
    const mapped = existing.map(s => {
      const min = ministries.find(m => m.id === s.ministryId);
      return { ministryName: min?.name || "?", shift: s.shift };
    });
    return { memberId, existingSchedules: mapped, sameShift: existing.some(s => s.shift === shift) };
  };

  const currentConflict = useMemo(
    () => getConflictsForMember(newForm.memberId, newForm.date, newForm.shift),
    [newForm.memberId, newForm.date, newForm.shift, schedules]
  );

  const isBlocked = currentConflict && (blockSameDay || (blockSameShift && currentConflict.sameShift));

  // Conflicts per member for the dropdown annotations
  const memberConflictMap = useMemo(() => {
    if (!newForm.date) return new Map<string, ConflictInfo>();
    const map = new Map<string, ConflictInfo>();
    members.forEach(m => {
      const c = getConflictsForMember(m.id, newForm.date, newForm.shift);
      if (c) map.set(m.id, c);
    });
    return map;
  }, [newForm.date, newForm.shift, schedules, members]);

  // Detect conflicts in existing schedule list (highlight rows)
  const scheduleConflicts = useMemo(() => {
    const conflictIds = new Set<string>();
    const byDayMember = new Map<string, string[]>();
    schedules.forEach(s => {
      const key = `${s.date}__${s.memberId}`;
      const list = byDayMember.get(key) || [];
      list.push(s.id);
      byDayMember.set(key, list);
    });
    byDayMember.forEach(ids => {
      if (ids.length > 1) ids.forEach(id => conflictIds.add(id));
    });
    return conflictIds;
  }, [schedules]);

  const filtered = useMemo(() => {
    return schedules
      .filter(s => !filterDate || s.date === filterDate)
      .filter(s => filterMinistry === "all" || s.ministryId === filterMinistry)
      .filter(s => filterShift === "all" || s.shift === filterShift)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [schedules, filterDate, filterMinistry, filterShift]);

  const handleAdd = () => {
    if (!newForm.ministryId || !newForm.memberId || !newForm.date) return;
    if (isBlocked) return;
    addSchedule(newForm);
    setShowAdd(false);
    setNewForm({ ministryId: "", date: new Date().toISOString().split("T")[0], shift: "Manhã", memberId: "", status: "Pendente" });
  };

  const activeFilters = (filterDate ? 1 : 0) + (filterMinistry !== "all" ? 1 : 0) + (filterShift !== "all" ? 1 : 0);

  const availableMembers = newForm.ministryId
    ? members.filter(m => m.ministryIds.includes(newForm.ministryId))
    : members;

  const getConflictTooltip = (scheduleId: string) => {
    const s = schedules.find(x => x.id === scheduleId);
    if (!s) return null;
    const others = schedules.filter(x => x.id !== scheduleId && x.date === s.date && x.memberId === s.memberId);
    if (others.length === 0) return null;
    return others.map(o => {
      const min = ministries.find(m => m.id === o.ministryId);
      return `${min?.name || "?"} (${o.shift})`;
    }).join(", ");
  };

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
        <div className="rounded-lg border bg-card p-4 animate-fade-in space-y-4">
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
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setFilterDate(""); setFilterMinistry("all"); setFilterShift("all"); }}>
              <X className="h-3 w-3 mr-1" /> Limpar filtros
            </Button>
          )}
        </div>
      )}

      {/* Conflict rules config */}
      {showAdd && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 animate-fade-in space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Shield className="h-4 w-4" />
            Regras de Conflito
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center justify-between rounded-lg border bg-card p-3 cursor-pointer">
              <div>
                <p className="text-sm font-medium text-foreground">Bloquear mesmo dia</p>
                <p className="text-xs text-muted-foreground">Impede escalar a mesma pessoa duas vezes no mesmo dia</p>
              </div>
              <Switch checked={blockSameDay} onCheckedChange={setBlockSameDay} />
            </label>
            <label className="flex items-center justify-between rounded-lg border bg-card p-3 cursor-pointer">
              <div>
                <p className="text-sm font-medium text-foreground">Bloquear mesmo turno</p>
                <p className="text-xs text-muted-foreground">Permite no mesmo dia, mas bloqueia no mesmo turno</p>
              </div>
              <Switch checked={blockSameShift} onCheckedChange={v => { setBlockSameShift(v); if (v) setBlockSameDay(false); }} />
            </label>
          </div>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className={cn("rounded-lg border bg-card p-4 space-y-3 animate-fade-in", isBlocked && "border-destructive/50")} >
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
                <SelectTrigger className={cn(currentConflict && "border-destructive")}><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {availableMembers.map(m => {
                    const conflict = memberConflictMap.get(m.id);
                    const blocked = conflict && (blockSameDay || (blockSameShift && conflict.sameShift));
                    return (
                      <SelectItem key={m.id} value={m.id} disabled={!!blocked}>
                        <span className="flex items-center gap-2">
                          {m.name}
                          {conflict && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-destructive">
                              <AlertTriangle className="h-3 w-3" />
                              {conflict.existingSchedules.map(e => e.ministryName).join(", ")}
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    );
                  })}
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

          {/* Conflict alert */}
          {currentConflict && (
            <div className={cn(
              "rounded-lg border p-3 animate-fade-in flex items-start gap-3",
              isBlocked ? "border-destructive/50 bg-destructive/5" : "border-accent/50 bg-accent/5"
            )}>
              <AlertTriangle className={cn("h-5 w-5 mt-0.5 shrink-0", isBlocked ? "text-destructive" : "text-accent")} />
              <div className="space-y-1">
                <p className={cn("text-sm font-medium", isBlocked ? "text-destructive" : "text-accent-foreground")}>
                  {isBlocked ? "Conflito bloqueado" : "Aviso de conflito"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Esta pessoa já está escalada neste dia:
                </p>
                <ul className="space-y-1">
                  {currentConflict.existingSchedules.map((e, i) => (
                    <li key={i} className="text-xs flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                      <span className="font-medium text-foreground">{e.ministryName}</span>
                      <span className="text-muted-foreground">— {e.shift}</span>
                    </li>
                  ))}
                </ul>
                {isBlocked && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Desative a regra "{blockSameDay ? "Bloquear mesmo dia" : "Bloquear mesmo turno"}" para permitir.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={!!isBlocked}>
              {isBlocked ? "Bloqueado" : "Adicionar"}
            </Button>
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
              const hasConflict = scheduleConflicts.has(s.id);
              const conflictDetail = hasConflict ? getConflictTooltip(s.id) : null;
              return (
                <div key={s.id} className={cn("rounded-lg border bg-card p-4 space-y-2", hasConflict && "border-destructive/50 ring-1 ring-destructive/20")} style={{ borderLeftWidth: 4, borderLeftColor: ministry ? `hsl(${MINISTRY_COLORS[ministry.colorIndex % MINISTRY_COLORS.length]})` : undefined }}>
                  <div className="flex items-center justify-between">
                    <span className="ministry-badge border" style={ministry ? getMinistryStyle(ministry.colorIndex) : {}}>{ministry?.name || "?"}</span>
                    <button onClick={() => deleteSchedule(s.id)} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <p className="font-medium text-foreground">{member?.name || "?"}</p>
                  {hasConflict && (
                    <div className="flex items-center gap-1.5 text-[11px] text-destructive">
                      <AlertTriangle className="h-3 w-3" />
                      <span>Também em: {conflictDetail}</span>
                    </div>
                  )}
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
                  const hasConflict = scheduleConflicts.has(s.id);
                  const conflictDetail = hasConflict ? getConflictTooltip(s.id) : null;
                  return (
                    <tr key={s.id} className={cn("border-b last:border-0 transition-colors", hasConflict ? "bg-destructive/5 hover:bg-destructive/10" : "hover:bg-muted/30")}>
                      <td className="px-4 py-3">
                        <span className="ministry-badge border" style={ministry ? getMinistryStyle(ministry.colorIndex) : {}}>{ministry?.name || "?"}</span>
                      </td>
                      <td className="px-4 py-3 text-foreground">{formatDate(s.date)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{getDayOfWeek(s.date)}</td>
                      <td className="px-4 py-3 text-foreground">{s.shift}</td>
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-medium text-foreground">{member?.name || "?"}</span>
                          {hasConflict && (
                            <div className="flex items-center gap-1.5 text-[11px] text-destructive mt-0.5">
                              <AlertTriangle className="h-3 w-3" />
                              <span>Também em: {conflictDetail}</span>
                            </div>
                          )}
                        </div>
                      </td>
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

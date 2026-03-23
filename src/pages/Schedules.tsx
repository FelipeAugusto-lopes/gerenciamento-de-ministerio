import { useState, useMemo } from "react";
import { useStore } from "@/store/StoreContext";
import { useAuth } from "@/store/AuthContext";
import { getMinistryStyle, getDayOfWeek, formatDate } from "@/lib/helpers";
import { MINISTRY_COLORS, type Shift, type ScheduleStatus } from "@/types";
import { Plus, Trash2, Filter, X, Calendar, AlertTriangle, Shield, Wand2, History, Search, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const { isAdmin, canEditMinistry, currentUser } = useAuth();

  const [showAdd, setShowAdd] = useState(false);
  const [filterDate, setFilterDate] = useState("");
  const [filterMinistry, setFilterMinistry] = useState("all");
  const [filterShift, setFilterShift] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [blockSameDay, setBlockSameDay] = useState(true);
  const [blockSameShift, setBlockSameShift] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [genDate, setGenDate] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? 0 : 7 - day; // next sunday
    d.setDate(d.getDate() + diff);
    return d.toISOString().split("T")[0];
  });
  const [genMinistry, setGenMinistry] = useState("all");
  const [genShift, setGenShift] = useState<Shift>("Manhã");
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [historyMemberId, setHistoryMemberId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");

  const [newForm, setNewForm] = useState({
    ministryId: "",
    date: new Date().toISOString().split("T")[0],
    shift: "Manhã" as Shift,
    memberId: "",
    status: "Pendente" as ScheduleStatus,
  });

  // Show saved feedback
  const showSaved = () => {
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  // Conflict detection
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

  const memberConflictMap = useMemo(() => {
    if (!newForm.date) return new Map<string, ConflictInfo>();
    const map = new Map<string, ConflictInfo>();
    members.forEach(m => {
      const c = getConflictsForMember(m.id, newForm.date, newForm.shift);
      if (c) map.set(m.id, c);
    });
    return map;
  }, [newForm.date, newForm.shift, schedules, members]);

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
    showSaved();
  };

  // Smart suggestion: members sorted by least recent service for a ministry
  const getSuggestedMember = (ministryId: string, date: string, shift: Shift): string | null => {
    const ministryMembers = members.filter(m => m.ministryIds.includes(ministryId));
    if (ministryMembers.length === 0) return null;

    const lastServed = new Map<string, string>();
    schedules
      .filter(s => s.ministryId === ministryId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach(s => {
        if (!lastServed.has(s.memberId)) lastServed.set(s.memberId, s.date);
      });

    // Sort: never served first, then least recently served
    const sorted = [...ministryMembers].sort((a, b) => {
      const aDate = lastServed.get(a.id) || "0000-00-00";
      const bDate = lastServed.get(b.id) || "0000-00-00";
      return aDate.localeCompare(bDate);
    });

    // Find first member without conflict on that date
    for (const m of sorted) {
      const conflict = getConflictsForMember(m.id, date, shift);
      const blocked = conflict && (blockSameDay || (blockSameShift && conflict.sameShift));
      if (!blocked) return m.id;
    }
    return sorted[0]?.id || null;
  };

  // Generate week schedule
  const handleGenerate = () => {
    const targetMinistries = genMinistry === "all" ? ministries : ministries.filter(m => m.id === genMinistry);
    let count = 0;

    for (const ministry of targetMinistries) {
      // Check permission
      if (!canEditMinistry(ministry.id)) continue;

      // Check if already exists
      const exists = schedules.some(s => s.ministryId === ministry.id && s.date === genDate && s.shift === genShift);
      if (exists) continue;

      const suggestedMember = getSuggestedMember(ministry.id, genDate, genShift);
      if (!suggestedMember) continue;

      addSchedule({
        ministryId: ministry.id,
        date: genDate,
        shift: genShift,
        memberId: suggestedMember,
        status: "Pendente",
      });
      count++;
    }

    setShowGenerate(false);
    if (count > 0) showSaved();
  };

  // Member history
  const memberHistory = useMemo(() => {
    if (!historyMemberId) return [];
    return schedules
      .filter(s => s.memberId === historyMemberId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [historyMemberId, schedules]);

  const activeFilters = (filterDate ? 1 : 0) + (filterMinistry !== "all" ? 1 : 0) + (filterShift !== "all" ? 1 : 0);

  const availableMembers = useMemo(() => {
    let list = newForm.ministryId
      ? members.filter(m => m.ministryIds.includes(newForm.ministryId))
      : members;
    if (memberSearch) {
      const search = memberSearch.toLowerCase();
      list = list.filter(m => m.name.toLowerCase().includes(search));
    }
    return list;
  }, [newForm.ministryId, members, memberSearch]);

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

  // Visible ministries for leaders
  const visibleMinistries = isAdmin ? ministries : ministries;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Saved feedback */}
      {savedFeedback && (
        <div className="fixed top-20 right-4 z-50 flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-3 shadow-lg animate-fade-in">
          <CheckCircle2 className="h-5 w-5" /> Salvo com sucesso!
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Escalas</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} escala{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="gap-2 h-12 px-5 text-base relative">
            <Filter className="h-5 w-5" /> Filtros
            {activeFilters > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold">{activeFilters}</span>
            )}
          </Button>
          <Button variant="secondary" onClick={() => setShowGenerate(true)} className="gap-2 h-12 px-5 text-base">
            <Wand2 className="h-5 w-5" /> Gerar Escala
          </Button>
          <Button onClick={() => setShowAdd(true)} className="gap-2 h-12 px-5 text-base">
            <Plus className="h-5 w-5" /> Nova
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="rounded-lg border bg-card p-4 animate-fade-in space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Data</label>
              <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="h-12 text-base" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Ministério</label>
              <Select value={filterMinistry} onValueChange={setFilterMinistry}>
                <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {ministries.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Turno</label>
              <Select value={filterShift} onValueChange={setFilterShift}>
                <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Manhã">Manhã</SelectItem>
                  <SelectItem value="Noite">Noite</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" className="text-sm" onClick={() => { setFilterDate(""); setFilterMinistry("all"); setFilterShift("all"); }}>
              <X className="h-4 w-4 mr-1" /> Limpar filtros
            </Button>
          )}
        </div>
      )}

      {/* Conflict rules */}
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
        <div className={cn("rounded-lg border bg-card p-5 space-y-4 animate-fade-in", isBlocked && "border-destructive/50")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Ministério</label>
              <Select value={newForm.ministryId} onValueChange={v => setNewForm(f => ({ ...f, ministryId: v, memberId: "" }))}>
                <SelectTrigger className="h-12 text-base"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {visibleMinistries.filter(m => canEditMinistry(m.id)).map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Buscar pessoa</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Digite o nome..."
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  className="h-12 text-base pl-10"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Pessoa</label>
              <Select value={newForm.memberId} onValueChange={v => setNewForm(f => ({ ...f, memberId: v }))}>
                <SelectTrigger className={cn("h-12 text-base", currentConflict && "border-destructive")}><SelectValue placeholder="Selecione" /></SelectTrigger>
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
              <label className="text-sm font-medium text-foreground mb-1.5 block">Data</label>
              <Input type="date" value={newForm.date} onChange={e => setNewForm(f => ({ ...f, date: e.target.value }))} className="h-12 text-base" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Turno</label>
              <Select value={newForm.shift} onValueChange={v => setNewForm(f => ({ ...f, shift: v as Shift }))}>
                <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
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
                <p className="text-xs text-muted-foreground">Esta pessoa já está escalada neste dia:</p>
                <ul className="space-y-1">
                  {currentConflict.existingSchedules.map((e, i) => (
                    <li key={i} className="text-xs flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                      <span className="font-medium text-foreground">{e.ministryName}</span>
                      <span className="text-muted-foreground">— {e.shift}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button className="h-12 px-6 text-base" onClick={handleAdd} disabled={!!isBlocked}>
              {isBlocked ? "Bloqueado" : "Adicionar"}
            </Button>
            <Button className="h-12 px-6 text-base" variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Generate schedule dialog */}
      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <Wand2 className="h-5 w-5 text-primary" /> Gerar Escala Automática
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Sugere automaticamente as pessoas que serviram menos recentemente em cada ministério.
            </p>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Data</label>
              <Input type="date" value={genDate} onChange={e => setGenDate(e.target.value)} className="h-12 text-base" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Turno</label>
              <Select value={genShift} onValueChange={v => setGenShift(v as Shift)}>
                <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Manhã">Manhã</SelectItem>
                  <SelectItem value="Noite">Noite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Ministério</label>
              <Select value={genMinistry} onValueChange={setGenMinistry}>
                <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os ministérios</SelectItem>
                  {ministries.filter(m => canEditMinistry(m.id)).map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full h-12 text-base gap-2" onClick={handleGenerate}>
              <Wand2 className="h-5 w-5" /> Gerar Escala
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

      {/* Schedule list */}
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
              const editable = canEditMinistry(s.ministryId);
              return (
                <div key={s.id} className={cn("rounded-lg border bg-card p-4 space-y-2", hasConflict && "border-destructive/50 ring-1 ring-destructive/20")} style={{ borderLeftWidth: 4, borderLeftColor: ministry ? `hsl(${MINISTRY_COLORS[ministry.colorIndex % MINISTRY_COLORS.length]})` : undefined }}>
                  <div className="flex items-center justify-between">
                    <span className="ministry-badge border" style={ministry ? getMinistryStyle(ministry.colorIndex) : {}}>{ministry?.name || "?"}</span>
                    {editable && (
                      <button onClick={() => deleteSchedule(s.id)} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                    )}
                  </div>
                  <button onClick={() => setHistoryMemberId(s.memberId)} className="font-medium text-foreground hover:text-primary transition-colors text-left flex items-center gap-1.5">
                    {member?.name || "?"}
                    <History className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
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
                  {editable ? (
                    <Select value={s.status} onValueChange={v => { updateSchedule({ ...s, status: v as ScheduleStatus }); showSaved(); }}>
                      <SelectTrigger className={cn("w-fit h-8 text-xs border", statusColors[s.status])}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pendente">Pendente</SelectItem>
                        <SelectItem value="Confirmado">Confirmado</SelectItem>
                        <SelectItem value="Concluído">Concluído</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className={cn("inline-flex text-xs px-2 py-0.5 rounded-full border w-fit", statusColors[s.status])}>{s.status}</span>
                  )}
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
                  const editable = canEditMinistry(s.ministryId);
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
                          <button onClick={() => setHistoryMemberId(s.memberId)} className="font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1.5">
                            {member?.name || "?"}
                            <History className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                          {hasConflict && (
                            <div className="flex items-center gap-1.5 text-[11px] text-destructive mt-0.5">
                              <AlertTriangle className="h-3 w-3" />
                              <span>Também em: {conflictDetail}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {editable ? (
                          <Select value={s.status} onValueChange={v => { updateSchedule({ ...s, status: v as ScheduleStatus }); showSaved(); }}>
                            <SelectTrigger className={cn("w-fit h-7 text-xs border", statusColors[s.status])}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Pendente">Pendente</SelectItem>
                              <SelectItem value="Confirmado">Confirmado</SelectItem>
                              <SelectItem value="Concluído">Concluído</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={cn("inline-flex text-xs px-2 py-0.5 rounded-full border", statusColors[s.status])}>{s.status}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editable && (
                          <button onClick={() => deleteSchedule(s.id)} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                        )}
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

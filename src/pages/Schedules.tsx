import { useState, useMemo } from "react";
import { useStore } from "@/store/StoreContext";
import { useAudit } from "@/store/AuditContext";
import { getMinistryStyle, getDayOfWeek, formatDate } from "@/lib/helpers";
import { MINISTRY_COLORS, type Shift, type ScheduleStatus } from "@/types";
import { Plus, Trash2, Filter, X, Calendar, AlertTriangle, Shield, Wand2, History, Search, CheckCircle2, Bell, Clock, BarChart3, XCircle, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const statusColors: Record<ScheduleStatus, string> = {
  Pendente: "bg-accent/20 text-accent-foreground border-accent/30",
  Confirmado: "bg-primary/15 text-primary border-primary/30",
  Recusado: "bg-destructive/15 text-destructive border-destructive/30",
  Concluído: "bg-muted text-muted-foreground border-border",
};

const statusIcons: Record<ScheduleStatus, string> = {
  Pendente: "⏳",
  Confirmado: "✅",
  Recusado: "❌",
  Concluído: "✔️",
};

export default function SchedulesPage() {
  const { schedules, ministries, members, addSchedule, updateSchedule, deleteSchedule, addNotification, notifications, markAllNotificationsRead } = useStore();
  const { addEntry } = useAudit();

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
    const diff = day === 0 ? 0 : 7 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split("T")[0];
  });
  const [genMinistry, setGenMinistry] = useState("all");
  const [genShift, setGenShift] = useState<Shift>("Manhã");
  const [savedFeedback, setSavedFeedback] = useState("");
  const [historyMemberId, setHistoryMemberId] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);

  const [newForm, setNewForm] = useState({
    ministryId: "",
    date: new Date().toISOString().split("T")[0],
    shift: "Manhã" as Shift,
    selectedMemberIds: [] as string[],
    status: "Pendente" as ScheduleStatus,
  });

  const showSaved = (msg = "Salvo com sucesso!") => {
    setSavedFeedback(msg);
    setTimeout(() => setSavedFeedback(""), 2500);
  };

  const sendNotification = (memberIds: string[], ministryName: string, date: string, shift: string) => {
    memberIds.forEach(memberId => {
      const member = members.find(m => m.id === memberId);
      addNotification({
        memberId,
        scheduleId: "",
        message: `${member?.name || "Você"} foi escalado(a) para ${ministryName} na data ${formatDate(date)} — turno ${shift}`,
        createdAt: new Date().toISOString(),
        read: false,
      });
    });
  };


  const filtered = useMemo(() => {
    return schedules
      .filter(s => !filterDate || s.date === filterDate)
      .filter(s => filterMinistry === "all" || s.ministryId === filterMinistry)
      .filter(s => filterShift === "all" || s.shift === filterShift)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [schedules, filterDate, filterMinistry, filterShift]);

  const statusSummary = useMemo(() => {
    const counts = { Pendente: 0, Confirmado: 0, Recusado: 0, Concluído: 0 };
    filtered.forEach(s => { counts[s.status]++; });
    return counts;
  }, [filtered]);

  const availableMembers = useMemo(() => {
    return newForm.ministryId ? members.filter(m => m.ministryIds.includes(newForm.ministryId)) : members;
  }, [newForm.ministryId, members]);

  // Conflict detection: find members already scheduled on the selected date
  const getMemberConflict = (memberId: string): { ministryName: string; shift: string } | null => {
    if (!newForm.date) return null;
    for (const s of schedules) {
      if (s.date === newForm.date && s.memberIds.includes(memberId)) {
        const min = ministries.find(m => m.id === s.ministryId);
        return { ministryName: min?.name || "?", shift: s.shift };
      }
    }
    return null;
  };

  const toggleMember = (memberId: string) => {
    setNewForm(f => ({
      ...f,
      selectedMemberIds: f.selectedMemberIds.includes(memberId)
        ? f.selectedMemberIds.filter(id => id !== memberId)
        : [...f.selectedMemberIds, memberId],
    }));
  };

  const handleAdd = () => {
    if (!newForm.ministryId || newForm.selectedMemberIds.length === 0 || !newForm.date) return;
    addSchedule({
      ministryId: newForm.ministryId,
      date: newForm.date,
      shift: newForm.shift,
      memberIds: newForm.selectedMemberIds,
      status: newForm.status,
    });
    const ministry = ministries.find(m => m.id === newForm.ministryId);
    const memberNames = newForm.selectedMemberIds.map(id => members.find(m => m.id === id)?.name || "?").join(", ");
    sendNotification(newForm.selectedMemberIds, ministry?.name || "?", newForm.date, newForm.shift);
    addEntry("Adicionou escala", `${memberNames} em ${ministry?.name} — ${formatDate(newForm.date)} (${newForm.shift})`);
    setShowAdd(false);
    setNewForm({ ministryId: "", date: new Date().toISOString().split("T")[0], shift: "Manhã", selectedMemberIds: [], status: "Pendente" });
    showSaved();
  };

  const getSuggestedMember = (ministryId: string, date: string, shift: Shift): string | null => {
    const ministryMembers = members.filter(m => m.ministryIds.includes(ministryId));
    if (ministryMembers.length === 0) return null;
    const targetDate = new Date(date + "T12:00:00");
    const prevWeek = new Date(targetDate);
    prevWeek.setDate(prevWeek.getDate() - 7);
    const prevWeekStr = prevWeek.toISOString().split("T")[0];
    const servedLastWeek = new Set(
      schedules.filter(s => s.ministryId === ministryId && s.date === prevWeekStr).flatMap(s => s.memberIds)
    );
    const lastServed = new Map<string, string>();
    schedules
      .filter(s => s.ministryId === ministryId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach(s => {
        s.memberIds.forEach(mid => {
          if (!lastServed.has(mid)) lastServed.set(mid, s.date);
        });
      });
    const sorted = [...ministryMembers].sort((a, b) => {
      const aLastWeek = servedLastWeek.has(a.id) ? 1 : 0;
      const bLastWeek = servedLastWeek.has(b.id) ? 1 : 0;
      if (aLastWeek !== bLastWeek) return aLastWeek - bLastWeek;
      const aDate = lastServed.get(a.id) || "0000-00-00";
      const bDate = lastServed.get(b.id) || "0000-00-00";
      return aDate.localeCompare(bDate);
    });
    return sorted[0]?.id || null;
  };

  const handleGenerate = () => {
    const targetMinistries = genMinistry === "all" ? ministries : ministries.filter(m => m.id === genMinistry);
    let count = 0;
    for (const ministry of targetMinistries) {
      const exists = schedules.some(s => s.ministryId === ministry.id && s.date === genDate && s.shift === genShift);
      if (exists) continue;
      const suggestedMember = getSuggestedMember(ministry.id, genDate, genShift);
      if (!suggestedMember) continue;
      addSchedule({ ministryId: ministry.id, date: genDate, shift: genShift, memberIds: [suggestedMember], status: "Pendente" });
      sendNotification([suggestedMember], ministry.name, genDate, genShift);
      count++;
    }
    setShowGenerate(false);
    if (count > 0) {
      addEntry("Gerou escalas automáticas", `${count} escala(s) para ${formatDate(genDate)} (${genShift})`);
      showSaved(`${count} escala${count > 1 ? "s" : ""} gerada${count > 1 ? "s" : ""} com sucesso!`);
    }
  };

  const handleDelete = (id: string) => {
    const s = schedules.find(x => x.id === id);
    if (s) {
      const ministry = ministries.find(m => m.id === s.ministryId);
      const memberNames = s.memberIds.map(mid => members.find(m => m.id === mid)?.name || "?").join(", ");
      addEntry("Removeu escala", `${memberNames} de ${ministry?.name} — ${formatDate(s.date)}`);
    }
    deleteSchedule(id);
  };

  const handleStatusChange = (s: typeof schedules[0], newStatus: ScheduleStatus) => {
    updateSchedule({ ...s, status: newStatus });
    const ministry = ministries.find(m => m.id === s.ministryId);
    const memberNames = s.memberIds.map(mid => members.find(m => m.id === mid)?.name || "?").join(", ");
    addEntry("Alterou status", `${memberNames} (${ministry?.name}) → ${newStatus}`);
    showSaved();
  };

  const memberHistory = useMemo(() => {
    if (!historyMemberId) return [];
    return schedules.filter(s => s.memberIds.includes(historyMemberId)).sort((a, b) => b.date.localeCompare(a.date));
  }, [historyMemberId, schedules]);

  const memberStats = useMemo(() => {
    if (!historyMemberId) return null;
    const history = schedules.filter(s => s.memberIds.includes(historyMemberId));
    if (history.length === 0) return { total: 0, lastServed: null as string | null, frequency: "Nunca escalado" };
    const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date));
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recent = history.filter(s => new Date(s.date) >= thirtyDaysAgo).length;
    return {
      total: history.length,
      lastServed: sorted[0].date,
      frequency: recent === 0 ? "Nenhuma nos últimos 30 dias" : `${recent}x nos últimos 30 dias`,
    };
  }, [historyMemberId, schedules]);

  const activeFilters = (filterDate ? 1 : 0) + (filterMinistry !== "all" ? 1 : 0) + (filterShift !== "all" ? 1 : 0);

  const unreadNotifications = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-8 animate-fade-in">
      {savedFeedback && (
        <div className="fixed top-20 right-4 z-50 flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-3 shadow-lg animate-fade-in">
          <CheckCircle2 className="h-5 w-5" /> {savedFeedback}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Escalas</h1>
          <p className="page-subtitle">{filtered.length} escala{filtered.length !== 1 ? "s" : ""} encontrada{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowNotifications(true)} className="gap-2 h-12 px-4 text-base relative">
            <Bell className="h-5 w-5" />
            {unreadNotifications > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground font-bold">{unreadNotifications}</span>
            )}
          </Button>
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

      {filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="stat-card bg-accent/8">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Clock className="h-5 w-5 text-accent" />
            </div>
            <p className="text-3xl font-bold text-accent-foreground">{statusSummary.Pendente}</p>
            <p className="text-xs text-muted-foreground mt-1">Pendentes</p>
          </div>
          <div className="stat-card bg-primary/8">
            <div className="flex items-center justify-center gap-2 mb-1">
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </div>
            <p className="text-3xl font-bold text-primary">{statusSummary.Confirmado}</p>
            <p className="text-xs text-muted-foreground mt-1">Confirmados</p>
          </div>
          <div className="stat-card bg-destructive/8">
            <div className="flex items-center justify-center gap-2 mb-1">
              <XCircle className="h-5 w-5 text-destructive" />
            </div>
            <p className="text-3xl font-bold text-destructive">{statusSummary.Recusado}</p>
            <p className="text-xs text-muted-foreground mt-1">Recusados</p>
          </div>
          <div className="stat-card bg-muted/60">
            <div className="flex items-center justify-center gap-2 mb-1">
              <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-3xl font-bold text-muted-foreground">{statusSummary.Concluído}</p>
            <p className="text-xs text-muted-foreground mt-1">Concluídos</p>
          </div>
        </div>
      )}

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

      {/* Add schedule form with multi-member selection */}
      {showAdd && (
        <div className="rounded-lg border bg-card p-5 space-y-4 animate-fade-in">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Ministério</label>
              <Select value={newForm.ministryId} onValueChange={v => setNewForm(f => ({ ...f, ministryId: v, selectedMemberIds: [] }))}>
                <SelectTrigger className="h-12 text-base"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {ministries.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
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

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Pessoas ({newForm.selectedMemberIds.length} selecionada{newForm.selectedMemberIds.length !== 1 ? "s" : ""})
            </label>
            {newForm.selectedMemberIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {newForm.selectedMemberIds.map(id => {
                  const member = members.find(m => m.id === id);
                  return (
                    <span key={id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium">
                      {member?.name || "?"}
                      <button onClick={() => toggleMember(id)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                    </span>
                  );
                })}
              </div>
            )}
            <div className="max-h-48 overflow-y-auto rounded-lg border divide-y">
              {availableMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground p-3 text-center">
                  {newForm.ministryId ? "Nenhum membro neste ministério" : "Selecione um ministério"}
                </p>
              ) : (
                availableMembers.map(m => {
                  const isSelected = newForm.selectedMemberIds.includes(m.id);
                  const conflict = getMemberConflict(m.id);
                  const hasConflict = !!conflict && !isSelected;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        if (hasConflict) return;
                        toggleMember(m.id);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors",
                        isSelected && "bg-primary/5",
                        hasConflict ? "opacity-60 cursor-not-allowed bg-destructive/5" : "hover:bg-muted/50"
                      )}
                    >
                      <span className={cn(
                        "h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                        isSelected ? "bg-primary border-primary text-primary-foreground" : hasConflict ? "border-destructive/50" : "border-muted-foreground/30"
                      )}>
                        {isSelected && <span className="text-xs">✓</span>}
                        {hasConflict && <AlertTriangle className="h-3 w-3 text-destructive" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className={cn("font-medium", isSelected ? "text-primary" : hasConflict ? "text-destructive" : "text-foreground")}>{m.name}</span>
                        {hasConflict && (
                          <p className="text-[10px] text-destructive">Já escalado em {conflict.ministryName} ({conflict.shift})</p>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button className="h-12 px-6 text-base" onClick={handleAdd} disabled={newForm.selectedMemberIds.length === 0 || !newForm.ministryId}>
              <UserPlus className="h-5 w-5 mr-2" />
              Adicionar {newForm.selectedMemberIds.length > 0 ? `${newForm.selectedMemberIds.length} pessoa${newForm.selectedMemberIds.length > 1 ? "s" : ""}` : ""}
            </Button>
            <Button className="h-12 px-6 text-base" variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Generate dialog */}
      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <Wand2 className="h-5 w-5 text-primary" /> Gerar Escala Automática
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-lg bg-muted/50 border p-3 text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Critérios inteligentes:</p>
              <ul className="space-y-0.5 text-xs">
                <li>• Prioriza quem serviu menos recentemente</li>
                <li>• Evita repetir a mesma pessoa em semanas consecutivas</li>
                <li>• Respeita os ministérios de cada membro</li>
              </ul>
            </div>
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
                  {ministries.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full h-12 text-base gap-2" onClick={handleGenerate}>
              <Wand2 className="h-5 w-5" /> Gerar Escala
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Notifications dialog */}
      <Dialog open={showNotifications} onOpenChange={setShowNotifications}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <Bell className="h-5 w-5 text-primary" /> Notificações
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma notificação.</p>
            ) : (
              <>
                {unreadNotifications > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs mb-2" onClick={() => markAllNotificationsRead()}>
                    Marcar todas como lidas
                  </Button>
                )}
                {notifications.slice(0, 50).map(n => (
                  <div key={n.id} className={cn(
                    "rounded-lg border p-3 text-sm transition-colors",
                    n.read ? "bg-card" : "bg-primary/5 border-primary/20"
                  )}>
                    <p className="text-foreground">{n.message}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {new Date(n.createdAt).toLocaleDateString("pt-BR")} às {new Date(n.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                ))}
              </>
            )}
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
          {memberStats && (
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="rounded-lg border bg-muted/50 p-3 text-center">
                <p className="text-xl font-bold text-foreground">{memberStats.total}</p>
                <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1"><BarChart3 className="h-3 w-3" /> Total</p>
              </div>
              <div className="rounded-lg border bg-muted/50 p-3 text-center">
                <p className="text-sm font-bold text-foreground">{memberStats.lastServed ? formatDate(memberStats.lastServed) : "—"}</p>
                <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1"><Clock className="h-3 w-3" /> Última vez</p>
              </div>
              <div className="rounded-lg border bg-muted/50 p-3 text-center">
                <p className="text-sm font-bold text-foreground">{memberStats.frequency}</p>
                <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1"><Calendar className="h-3 w-3" /> Frequência</p>
              </div>
            </div>
          )}
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
                    <span className={cn("text-xs px-2 py-0.5 rounded-full border", statusColors[s.status])}>
                      {statusIcons[s.status]} {s.status}
                    </span>
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
              const memberNames = s.memberIds.map(mid => members.find(m => m.id === mid)?.name || "?");
              return (
                <div key={s.id} className={cn(
                  "rounded-lg border bg-card p-4 space-y-2",
                  s.status === "Recusado" && "opacity-70"
                )} style={{ borderLeftWidth: 4, borderLeftColor: ministry ? `hsl(${MINISTRY_COLORS[ministry.colorIndex % MINISTRY_COLORS.length]})` : undefined }}>
                  <div className="flex items-center justify-between">
                    <span className="ministry-badge border" style={ministry ? getMinistryStyle(ministry.colorIndex) : {}}>{ministry?.name || "?"}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-base">{statusIcons[s.status]}</span>
                      <button onClick={() => handleDelete(s.id)} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <p className="font-medium text-foreground text-sm">{memberNames.join(", ")}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatDate(s.date)}</span>
                    <span>{getDayOfWeek(s.date)}</span>
                    <span>{s.shift}</span>
                  </div>
                  <Select value={s.status} onValueChange={v => handleStatusChange(s, v as ScheduleStatus)}>
                    <SelectTrigger className={cn("w-fit h-8 text-xs border", statusColors[s.status])}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pendente">⏳ Pendente</SelectItem>
                      <SelectItem value="Confirmado">✅ Confirmado</SelectItem>
                      <SelectItem value="Recusado">❌ Recusado</SelectItem>
                      <SelectItem value="Concluído">✔️ Concluído</SelectItem>
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
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Pessoas</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const ministry = ministries.find(m => m.id === s.ministryId);
                  const memberNames = s.memberIds.map(mid => members.find(m => m.id === mid)?.name || "?");
                  return (
                    <tr key={s.id} className={cn(
                      "border-b last:border-0 transition-colors hover:bg-muted/30",
                      s.status === "Recusado" && "opacity-60"
                    )}>
                      <td className="px-4 py-3">
                        <span className="ministry-badge border" style={ministry ? getMinistryStyle(ministry.colorIndex) : {}}>{ministry?.name || "?"}</span>
                      </td>
                      <td className="px-4 py-3 text-foreground">{formatDate(s.date)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{getDayOfWeek(s.date)}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "text-xs font-medium px-2 py-1 rounded",
                          s.shift === "Manhã" ? "bg-amber-500/15 text-amber-700" : "bg-indigo-500/15 text-indigo-700"
                        )}>
                          {s.shift}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-foreground font-medium">{memberNames.join(", ")}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Select value={s.status} onValueChange={v => handleStatusChange(s, v as ScheduleStatus)}>
                          <SelectTrigger className={cn("w-fit h-7 text-xs border", statusColors[s.status])}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pendente">⏳ Pendente</SelectItem>
                            <SelectItem value="Confirmado">✅ Confirmado</SelectItem>
                            <SelectItem value="Recusado">❌ Recusado</SelectItem>
                            <SelectItem value="Concluído">✔️ Concluído</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleDelete(s.id)} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
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

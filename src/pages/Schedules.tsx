import { useState, useMemo } from "react";
import { useStore } from "@/store/StoreContext";
import { useAudit } from "@/store/AuditContext";
import { getMinistryStyle, getDayOfWeek, formatDate } from "@/lib/helpers";
import { MINISTRY_COLORS, type Shift, type ScheduleStatus } from "@/types";
import {
  Plus, Trash2, Filter, X, Calendar, AlertTriangle, Wand2, History, Search,
  CheckCircle2, Bell, Clock, BarChart3, XCircle, UserPlus, Copy, Pencil, Check, Sun, Moon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const STATUS_LIST: ScheduleStatus[] = ["Pendente", "Confirmado", "Recusado", "Concluído"];

const statusConfig: Record<ScheduleStatus, { icon: typeof Clock; color: string; bg: string; border: string; label: string }> = {
  Pendente: { icon: Clock, color: "text-amber-600", bg: "bg-amber-500/15", border: "border-amber-400/40", label: "Pendente" },
  Confirmado: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-500/15", border: "border-emerald-400/40", label: "Confirmado" },
  Recusado: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/12", border: "border-red-400/40", label: "Recusado" },
  Concluído: { icon: Check, color: "text-muted-foreground", bg: "bg-muted/60", border: "border-border", label: "Concluído" },
};

export default function SchedulesPage() {
  const { schedules, ministries, members, addSchedule, updateSchedule, deleteSchedule, addNotification, notifications, markAllNotificationsRead } = useStore();
  const { addEntry } = useAudit();

  const [showAdd, setShowAdd] = useState(false);
  const [filterDate, setFilterDate] = useState("");
  const [filterMinistry, setFilterMinistry] = useState("all");
  const [filterShift, setFilterShift] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
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
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [editMemberIds, setEditMemberIds] = useState<string[]>([]);
  const [duplicateSchedule, setDuplicateSchedule] = useState<typeof schedules[0] | null>(null);
  const [duplicateDate, setDuplicateDate] = useState("");

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
      .filter(s => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const ministry = ministries.find(m => m.id === s.ministryId);
        const memberNames = s.memberIds.map(mid => members.find(m => m.id === mid)?.name || "").join(" ");
        return (
          (ministry?.name || "").toLowerCase().includes(q) ||
          memberNames.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [schedules, filterDate, filterMinistry, filterShift, searchQuery, ministries, members]);

  // Fixed ministry display order
  const MINISTRY_ORDER = [
    "Voluntariado", "Louvor", "Áudio", "Mídia Story", "Mídia Fotos",
    "Projeção", "Transmissão", "Berçário", "INA Kids 3-6", "INA Kids 7-8", "INA Kids 9-12",
  ];

  const getMinistryOrder = (ministryId: string) => {
    const name = ministries.find(m => m.id === ministryId)?.name || "";
    const idx = MINISTRY_ORDER.findIndex(n => n.toLowerCase() === name.toLowerCase());
    return idx === -1 ? MINISTRY_ORDER.length : idx;
  };

  // Group by date then shift, sorted by ministry order
  const groupedByDate = useMemo(() => {
    const map = new Map<string, { manhã: typeof filtered; noite: typeof filtered }>();
    filtered.forEach(s => {
      if (!map.has(s.date)) map.set(s.date, { manhã: [], noite: [] });
      const group = map.get(s.date)!;
      if (s.shift === "Manhã") group.manhã.push(s);
      else group.noite.push(s);
    });
    // Sort each shift group by ministry order
    map.forEach(group => {
      group.manhã.sort((a, b) => getMinistryOrder(a.ministryId) - getMinistryOrder(b.ministryId));
      group.noite.sort((a, b) => getMinistryOrder(a.ministryId) - getMinistryOrder(b.ministryId));
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered, ministries]);

  const statusSummary = useMemo(() => {
    const counts = { Pendente: 0, Confirmado: 0, Recusado: 0, Concluído: 0 };
    filtered.forEach(s => { counts[s.status]++; });
    return counts;
  }, [filtered]);

  const availableMembers = useMemo(() => {
    return newForm.ministryId ? members.filter(m => m.ministryIds.includes(newForm.ministryId)) : members;
  }, [newForm.ministryId, members]);

  const getMemberConflict = (memberId: string, date: string, excludeScheduleId?: string): { ministryName: string; shift: string } | null => {
    if (!date) return null;
    for (const s of schedules) {
      if (s.date === date && s.memberIds.includes(memberId) && s.id !== excludeScheduleId) {
        const min = ministries.find(m => m.id === s.ministryId);
        return { ministryName: min?.name || "?", shift: s.shift };
      }
    }
    return null;
  };

  // Check if any member in a schedule has a conflict with another schedule on the same day
  const getScheduleConflicts = (s: typeof schedules[0]) => {
    const conflicts: { memberId: string; memberName: string; otherMinistry: string; otherShift: string }[] = [];
    s.memberIds.forEach(mid => {
      const conflict = getMemberConflict(mid, s.date, s.id);
      if (conflict) {
        const member = members.find(m => m.id === mid);
        conflicts.push({ memberId: mid, memberName: member?.name || "?", otherMinistry: conflict.ministryName, otherShift: conflict.shift });
      }
    });
    return conflicts;
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

  const handleConfirmAllForDate = (date: string) => {
    const toConfirm = schedules.filter(s => s.date === date && s.status !== "Confirmado");
    toConfirm.forEach(s => {
      updateSchedule({ ...s, status: "Confirmado" });
    });
    if (toConfirm.length > 0) {
      addEntry("Confirmou todas as escalas", `${toConfirm.length} escala(s) em ${formatDate(date)}`);
      showSaved(`${toConfirm.length} escala(s) confirmada(s)!`);
    }
  };

  const handleDuplicate = () => {
    if (!duplicateSchedule || !duplicateDate) return;
    addSchedule({
      ministryId: duplicateSchedule.ministryId,
      date: duplicateDate,
      shift: duplicateSchedule.shift,
      memberIds: [...duplicateSchedule.memberIds],
      status: "Pendente",
    });
    const ministry = ministries.find(m => m.id === duplicateSchedule.ministryId);
    addEntry("Duplicou escala", `${ministry?.name} para ${formatDate(duplicateDate)} (${duplicateSchedule.shift})`);
    setDuplicateSchedule(null);
    setDuplicateDate("");
    showSaved("Escala duplicada com sucesso!");
  };

  const startEditMembers = (s: typeof schedules[0]) => {
    setEditingScheduleId(s.id);
    setEditMemberIds([...s.memberIds]);
  };

  const saveEditMembers = (s: typeof schedules[0]) => {
    if (editMemberIds.length === 0) return;
    updateSchedule({ ...s, memberIds: editMemberIds });
    const ministry = ministries.find(m => m.id === s.ministryId);
    const names = editMemberIds.map(id => members.find(m => m.id === id)?.name || "?").join(", ");
    addEntry("Editou membros da escala", `${ministry?.name} — ${formatDate(s.date)}: ${names}`);
    setEditingScheduleId(null);
    setEditMemberIds([]);
    showSaved();
  };

  const toggleEditMember = (memberId: string) => {
    setEditMemberIds(prev =>
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    );
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

  const activeFilters = (filterDate ? 1 : 0) + (filterMinistry !== "all" ? 1 : 0) + (filterShift !== "all" ? 1 : 0) + (searchQuery.trim() ? 1 : 0);
  const unreadNotifications = notifications.filter(n => !n.read).length;

  // Status toggle button component
  const StatusToggle = ({ schedule }: { schedule: typeof schedules[0] }) => {
    const cfg = statusConfig[schedule.status];
    const Icon = cfg.icon;
    return (
      <div className="flex gap-1">
        {STATUS_LIST.map(st => {
          const c = statusConfig[st];
          const StIcon = c.icon;
          const isActive = schedule.status === st;
          return (
            <button
              key={st}
              onClick={() => !isActive && handleStatusChange(schedule, st)}
              title={c.label}
              className={cn(
                "rounded-lg p-1.5 transition-all border",
                isActive ? `${c.bg} ${c.border} ${c.color} shadow-sm` : "border-transparent text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50"
              )}
            >
              <StIcon className="h-4 w-4" />
            </button>
          );
        })}
      </div>
    );
  };

  // Render a single schedule card
  const ScheduleCard = ({ s }: { s: typeof schedules[0] }) => {
    const ministry = ministries.find(m => m.id === s.ministryId);
    const memberNames = s.memberIds.map(mid => members.find(m => m.id === mid)?.name || "?");
    const conflicts = getScheduleConflicts(s);
    const isEditing = editingScheduleId === s.id;
    const editableMembers = ministry ? members.filter(m => m.ministryIds.includes(s.ministryId)) : members;
    const cfg = statusConfig[s.status];

    return (
      <div
        className={cn(
          "item-card space-y-3 relative group",
          s.status === "Recusado" && "opacity-70",
          conflicts.length > 0 && "ring-2 ring-red-400/50"
        )}
        style={{
          borderLeftWidth: 4,
          borderLeftColor: ministry ? `hsl(${MINISTRY_COLORS[ministry.colorIndex % MINISTRY_COLORS.length]})` : undefined,
        }}
      >
        {/* Conflict banner */}
        {conflicts.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-400/30 p-2 text-xs text-red-600">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Conflito de escala!</p>
              {conflicts.map(c => (
                <p key={c.memberId}>{c.memberName} já está em {c.otherMinistry} ({c.otherShift})</p>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <span className="ministry-badge border" style={ministry ? getMinistryStyle(ministry.colorIndex) : {}}>
            {ministry?.name || "?"}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setDuplicateSchedule(s); setDuplicateDate(""); }}
              title="Duplicar escala"
              className="rounded p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handleDelete(s.id)}
              title="Excluir"
              className="rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Members - inline edit mode */}
        {isEditing ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Selecione os membros:</p>
            <div className="flex flex-wrap gap-1.5">
              {editableMembers.map(m => {
                const selected = editMemberIds.includes(m.id);
                const conflict = getMemberConflict(m.id, s.date, s.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => !conflict && toggleEditMember(m.id)}
                    disabled={!!conflict}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium border transition-all",
                      selected ? "bg-primary/15 text-primary border-primary/30" : "bg-muted/50 text-muted-foreground border-border hover:bg-muted",
                      conflict && "opacity-40 cursor-not-allowed line-through"
                    )}
                    title={conflict ? `Já em ${conflict.ministryName} (${conflict.shift})` : m.name}
                  >
                    {m.name}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="h-8 text-xs" onClick={() => saveEditMembers(s)} disabled={editMemberIds.length === 0}>
                <Check className="h-3.5 w-3.5 mr-1" /> Salvar
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditingScheduleId(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {memberNames.map((name, i) => (
              <button
                key={s.memberIds[i]}
                onClick={() => setHistoryMemberId(s.memberIds[i])}
                className="rounded-full bg-muted/60 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                {name}
              </button>
            ))}
          </div>
        )}

        {/* Status toggle + edit inline */}
        <div className="flex items-center justify-between gap-2">
          <StatusToggle schedule={s} />
          {!isEditing && (
            <button
              onClick={() => startEditMembers(s)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-all",
                "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
              )}
            >
              <Pencil className="h-3.5 w-3.5" /> Editar
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="page-stack animate-fade-in">
      {savedFeedback && (
        <div className="fixed top-20 right-4 z-50 flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-3 shadow-lg animate-fade-in">
          <CheckCircle2 className="h-5 w-5" /> {savedFeedback}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Escalas</h1>
          <p className="page-subtitle">{filtered.length} escala{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowNotifications(true)} className="gap-2 h-10 sm:h-11 px-3 relative">
            <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
            {unreadNotifications > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground font-bold">{unreadNotifications}</span>
            )}
          </Button>
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="gap-2 h-10 sm:h-11 px-3 sm:px-4 relative">
            <Filter className="h-4 w-4" /> <span className="hidden sm:inline">Filtros</span>
            {activeFilters > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold">{activeFilters}</span>
            )}
          </Button>
          <Button variant="secondary" onClick={() => setShowGenerate(true)} className="gap-2 h-10 sm:h-11 px-3 sm:px-4">
            <Wand2 className="h-4 w-4" /> <span className="hidden sm:inline">Gerar</span>
          </Button>
          <Button onClick={() => setShowAdd(true)} className="gap-2 h-10 sm:h-11 px-4 sm:px-5 shadow-md hover:shadow-lg transition-shadow">
            <Plus className="h-4 w-4 sm:h-5 sm:w-5" /> Nova
          </Button>
        </div>
      </div>


      {/* Search bar - always visible */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por membro ou ministério..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-10 h-11"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Stat cards */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {(["Pendente", "Confirmado", "Recusado", "Concluído"] as ScheduleStatus[]).map(st => {
            const c = statusConfig[st];
            const Icon = c.icon;
            return (
              <button
                key={st}
                onClick={() => { setFilterShift("all"); setFilterMinistry("all"); setFilterDate(""); setSearchQuery(""); }}
                className={cn("stat-card", c.bg, "cursor-default")}
              >
                <Icon className={cn("h-5 w-5 mx-auto mb-1", c.color)} />
                <p className={cn("text-2xl font-bold", c.color)}>{statusSummary[st]}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{c.label}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="content-card p-4 animate-fade-in space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Data</label>
              <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="h-11" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Ministério</label>
              <Select value={filterMinistry} onValueChange={setFilterMinistry}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {ministries.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Turno</label>
              <Select value={filterShift} onValueChange={setFilterShift}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Manhã">Manhã</SelectItem>
                  <SelectItem value="Noite">Noite</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setFilterDate(""); setFilterMinistry("all"); setFilterShift("all"); setSearchQuery(""); }}>
              <X className="h-3 w-3 mr-1" /> Limpar filtros
            </Button>
          )}
        </div>
      )}

      {/* Add schedule form */}
      {showAdd && (
        <div className="content-card p-5 space-y-4 animate-fade-in">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Ministério</label>
              <Select value={newForm.ministryId} onValueChange={v => setNewForm(f => ({ ...f, ministryId: v, selectedMemberIds: [] }))}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {ministries.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Data</label>
              <Input type="date" value={newForm.date} onChange={e => setNewForm(f => ({ ...f, date: e.target.value }))} className="h-11" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Turno</label>
              <Select value={newForm.shift} onValueChange={v => setNewForm(f => ({ ...f, shift: v as Shift }))}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
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
                  const conflict = getMemberConflict(m.id, newForm.date);
                  const hasConflict = !!conflict && !isSelected;
                  return (
                    <button
                      key={m.id}
                      onClick={() => { if (!hasConflict) toggleMember(m.id); }}
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
            <Button className="h-11 px-6" onClick={handleAdd} disabled={newForm.selectedMemberIds.length === 0 || !newForm.ministryId}>
              <UserPlus className="h-4 w-4 mr-2" />
              Adicionar {newForm.selectedMemberIds.length > 0 ? `${newForm.selectedMemberIds.length} pessoa${newForm.selectedMemberIds.length > 1 ? "s" : ""}` : ""}
            </Button>
            <Button variant="outline" className="h-11" onClick={() => setShowAdd(false)}>Cancelar</Button>
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
              <Input type="date" value={genDate} onChange={e => setGenDate(e.target.value)} className="h-11" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Turno</label>
              <Select value={genShift} onValueChange={v => setGenShift(v as Shift)}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Manhã">Manhã</SelectItem>
                  <SelectItem value="Noite">Noite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Ministério</label>
              <Select value={genMinistry} onValueChange={setGenMinistry}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os ministérios</SelectItem>
                  {ministries.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full h-11 gap-2" onClick={handleGenerate}>
              <Wand2 className="h-4 w-4" /> Gerar Escala
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Duplicate dialog */}
      <Dialog open={!!duplicateSchedule} onOpenChange={() => setDuplicateSchedule(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5 text-primary" /> Duplicar Escala
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Escolha a nova data para duplicar esta escala com os mesmos membros.
            </p>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Nova data</label>
              <Input type="date" value={duplicateDate} onChange={e => setDuplicateDate(e.target.value)} className="h-11" />
            </div>
            <Button className="w-full h-11 gap-2" onClick={handleDuplicate} disabled={!duplicateDate}>
              <Copy className="h-4 w-4" /> Duplicar
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
                const cfg = statusConfig[s.status];
                const Icon = cfg.icon;
                return (
                  <div key={s.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                    <span className="ministry-badge border" style={ministry ? getMinistryStyle(ministry.colorIndex) : {}}>{ministry?.name || "?"}</span>
                    <div className="flex-1 text-sm">
                      <span className="text-foreground">{formatDate(s.date)}</span>
                      <span className="text-muted-foreground ml-2">{getDayOfWeek(s.date)} • {s.shift}</span>
                    </div>
                    <span className={cn("flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border", cfg.bg, cfg.border, cfg.color)}>
                      <Icon className="h-3 w-3" /> {s.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Schedule list grouped by date & shift */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Calendar className="h-12 w-12 mb-3 opacity-40" />
          <p className="text-sm">Nenhuma escala encontrada</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByDate.map(([date, groups]) => (
            <div key={date} className="space-y-3">
              {/* Date header */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-primary text-sm">{formatDate(date)}</span>
                </div>
                <span className="text-xs text-muted-foreground">{getDayOfWeek(date)}</span>
                <div className="flex-1 h-px bg-border" />
                {[...groups.manhã, ...groups.noite].some(s => s.status !== "Confirmado") && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5 border-emerald-300 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                    onClick={() => handleConfirmAllForDate(date)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Confirmar Todos
                  </Button>
                )}
              </div>

              {/* Manhã section */}
              {groups.manhã.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 ml-1">
                    <Sun className="h-4 w-4 text-amber-500" />
                    <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Manhã</span>
                    <span className="text-[10px] text-muted-foreground">({groups.manhã.length})</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {groups.manhã.map(s => <ScheduleCard key={s.id} s={s} />)}
                  </div>
                </div>
              )}

              {/* Noite section */}
              {groups.noite.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 ml-1">
                    <Moon className="h-4 w-4 text-indigo-500" />
                    <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Noite</span>
                    <span className="text-[10px] text-muted-foreground">({groups.noite.length})</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {groups.noite.map(s => <ScheduleCard key={s.id} s={s} />)}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

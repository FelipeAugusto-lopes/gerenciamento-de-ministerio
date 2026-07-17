import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useStore } from "@/store/StoreContext";
import { useAudit } from "@/store/AuditContext";
import { getMinistryStyle, formatDate, getDayOfWeek, getMinistryOrder } from "@/lib/helpers";
import { MINISTRY_COLORS, type Shift, type ScheduleStatus } from "@/types";
import { Plus, ChevronLeft, ChevronRight, Calendar, Trash2, AlertTriangle, X, UserPlus, FileText, Share2, CheckCircle2, Clock, XCircle, Check, Pencil } from "lucide-react";
import { exportToPDF, shareViaWhatsApp } from "@/lib/exportSchedule";
import { getMinistryIcon } from "@/lib/ministryIcons";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { HomeDashboard } from "@/components/HomeDashboard";

const STATUS_LIST: ScheduleStatus[] = ["Pendente", "Confirmado", "Recusado", "Concluído"];

const statusConfig: Record<ScheduleStatus, { icon: typeof Clock; color: string; bg: string; border: string; label: string }> = {
  Pendente: { icon: Clock, color: "text-amber-600", bg: "bg-amber-500/15", border: "border-amber-400/40", label: "Pendente" },
  Confirmado: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-500/15", border: "border-emerald-400/40", label: "Confirmado" },
  Recusado: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/12", border: "border-red-400/40", label: "Recusado" },
  Concluído: { icon: Check, color: "text-muted-foreground", bg: "bg-muted/60", border: "border-border", label: "Concluído" },
};

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  return days;
}


export default function IndexPage() {
  const { schedules, ministries, members, addSchedule, deleteSchedule, updateSchedule } = useStore();
  const { addEntry } = useAudit();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showPdfDialog, setShowPdfDialog] = useState(false);
  const [pdfOpts, setPdfOpts] = useState({
    showMinistry: true,
    showMembers: true,
    showShift: true,
    showDate: true,
  });

  const [newForm, setNewForm] = useState({
    ministryId: "",
    shift: "Manhã" as Shift,
    selectedMemberIds: [] as string[],
  });

  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [editMemberIds, setEditMemberIds] = useState<string[]>([]);

  // Deep-link: /?new=1&date=YYYY-MM-DD → open the add dialog on that date
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const wantNew = searchParams.get("new");
    const qDate = searchParams.get("date");
    if (wantNew === "1") {
      const target = qDate || today.toISOString().split("T")[0];
      const d = new Date(target + "T12:00:00");
      setYear(d.getFullYear());
      setMonth(d.getMonth());
      setSelectedDate(target);
      setShowAddDialog(true);
      // clear params so it doesn't re-trigger
      const next = new URLSearchParams(searchParams);
      next.delete("new");
      next.delete("date");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const calendarDays = useMemo(() => getCalendarDays(year, month), [year, month]);

  const schedulesByDate = useMemo(() => {
    const map = new Map<string, typeof schedules>();
    schedules.forEach(s => {
      const d = new Date(s.date + "T12:00:00");
      if (d.getFullYear() === year && d.getMonth() === month) {
        const list = map.get(s.date) || [];
        list.push(s);
        map.set(s.date, list);
      }
    });
    return map;
  }, [schedules, year, month]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const dateStr = (day: number) => {
    const m = String(month + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${year}-${m}-${d}`;
  };

  const selectedSchedules = useMemo(() => {
    if (!selectedDate) return [];
    return schedules.filter(s => s.date === selectedDate).sort((a, b) => {
      const shiftOrder = a.shift.localeCompare(b.shift);
      if (shiftOrder !== 0) return shiftOrder;
      const minA = ministries.find(m => m.id === a.ministryId);
      const minB = ministries.find(m => m.id === b.ministryId);
      return getMinistryOrder(minA?.name || "") - getMinistryOrder(minB?.name || "");
    });
  }, [selectedDate, schedules, ministries]);

  const availableMembers = useMemo(() => {
    if (!newForm.ministryId) return members;
    return members.filter(m => m.ministryIds.includes(newForm.ministryId));
  }, [newForm.ministryId, members]);

  // Conflict detection: find members already scheduled on the selected date
  const getMemberConflict = (memberId: string): { ministryName: string; shift: string } | null => {
    if (!selectedDate) return null;
    for (const s of schedules) {
      if (s.date === selectedDate && s.memberIds.includes(memberId)) {
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
    if (!newForm.ministryId || newForm.selectedMemberIds.length === 0 || !selectedDate) return;
    addSchedule({
      ministryId: newForm.ministryId,
      date: selectedDate,
      shift: newForm.shift,
      memberIds: newForm.selectedMemberIds,
      status: "Pendente",
    });
    const ministry = ministries.find(m => m.id === newForm.ministryId);
    const memberNames = newForm.selectedMemberIds.map(id => members.find(m => m.id === id)?.name || "?").join(", ");
    addEntry("Adicionou escala", `${memberNames} em ${ministry?.name} — ${formatDate(selectedDate)} (${newForm.shift})`);
    setNewForm({ ministryId: "", shift: "Manhã", selectedMemberIds: [] });
    setShowAddDialog(false);
  };

  const handleDelete = (id: string) => {
    const s = schedules.find(x => x.id === id);
    if (!s) return;
    const ministry = ministries.find(m => m.id === s.ministryId);
    const memberNames = s.memberIds.map(mid => members.find(m => m.id === mid)?.name || "?").join(", ");
    // Snapshot for undo
    const snapshot = { ministryId: s.ministryId, date: s.date, shift: s.shift, memberIds: [...s.memberIds], status: s.status };
    addEntry("Removeu escala", `${memberNames} de ${ministry?.name} — ${formatDate(s.date)}`);
    deleteSchedule(id);
    toast(`Escala removida — ${ministry?.name || ""}`, {
      description: `${memberNames} · ${formatDate(s.date)} (${s.shift})`,
      duration: 5000,
      action: {
        label: "Desfazer",
        onClick: () => {
          addSchedule(snapshot);
          addEntry("Desfez remoção de escala", `${memberNames} em ${ministry?.name} — ${formatDate(s.date)}`);
          toast.success("Escala restaurada");
        },
      },
    });
  };

  const handleStatusChange = (s: typeof schedules[0], newStatus: ScheduleStatus) => {
    updateSchedule({ ...s, status: newStatus });
    const ministry = ministries.find(m => m.id === s.ministryId);
    const memberNames = s.memberIds.map(mid => members.find(m => m.id === mid)?.name || "?").join(", ");
    addEntry("Alterou status", `${memberNames} (${ministry?.name}) → ${newStatus}`);
  };

  const handleConfirmAllForDate = () => {
    if (!selectedDate) return;
    const toConfirm = schedules.filter(s => s.date === selectedDate && s.status !== "Confirmado");
    toConfirm.forEach(s => {
      updateSchedule({ ...s, status: "Confirmado" });
    });
    if (toConfirm.length > 0) {
      addEntry("Confirmou todas as escalas", `${toConfirm.length} escala(s) em ${formatDate(selectedDate)}`);
      toast.success(`${toConfirm.length} escala${toConfirm.length !== 1 ? "s" : ""} confirmada${toConfirm.length !== 1 ? "s" : ""}`);
    } else {
      toast("Todas já estavam confirmadas");
    }
  };

  const pendingCountForSelectedDate = useMemo(() => {
    if (!selectedDate) return 0;
    return schedules.filter(s => s.date === selectedDate && s.status !== "Confirmado").length;
  }, [selectedDate, schedules]);

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
  };

  const toggleEditMember = (memberId: string) => {
    setEditMemberIds(prev =>
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    );
  };

  const todayStr = today.toISOString().split("T")[0];

  const getSelectedMinistryOrder = (ministryId: string) => {
    const min = ministries.find(m => m.id === ministryId);
    return getMinistryOrder(min?.name || "");
  };

  // Group selected schedules by shift for the table view
  const groupedByShift = useMemo(() => {
    const shifts = ["Manhã", "Noite"] as Shift[];
    return shifts.map(shift => ({
      shift,
      schedules: selectedSchedules
        .filter(s => s.shift === shift)
        .sort((a, b) => getSelectedMinistryOrder(a.ministryId) - getSelectedMinistryOrder(b.ministryId)),
    })).filter(g => g.schedules.length > 0);
  }, [selectedSchedules, ministries]);

  return (
    <div className="page-stack animate-fade-in">
      {/* Hero cover */}
      {(() => {
        const monthCount = Array.from(schedulesByDate.values()).reduce((a, l) => a + l.length, 0);
        const todaySchedules = schedules.filter(s => s.date === todayStr);
        const confirmedToday = todaySchedules.filter(s => s.status === "Confirmado").length;
        return (
          <div className="content-card overflow-hidden p-0 shadow-elegant animate-fade-in">
            <div className="relative w-full aspect-[16/9] sm:aspect-[21/9] md:aspect-[3/1] max-h-[340px]">
              <img
                src="/escala-ina-cover.png"
                alt="Escala INA — Servir juntos, transformar vidas"
                className="w-full h-full object-cover object-[center_70%]"
              />
              <div className="absolute inset-0 hero-overlay" />
              <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6 md:p-8">
                <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-white/80 mb-1 sm:mb-2">
                  {MONTH_NAMES[month]} {year}
                </p>
                <h1 className="font-display text-2xl sm:text-4xl md:text-5xl font-bold text-white drop-shadow-md leading-tight">
                  Servir juntos,<br className="sm:hidden" /> transformar vidas
                </h1>
                <div className="mt-3 sm:mt-4 flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-md px-3 py-1.5 text-xs sm:text-sm font-medium text-white ring-1 ring-white/25">
                    <Calendar className="h-3.5 w-3.5" />
                    {monthCount} escala{monthCount !== 1 ? "s" : ""} no mês
                  </span>
                  {todaySchedules.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/90 px-3 py-1.5 text-xs sm:text-sm font-semibold text-accent-foreground ring-1 ring-white/30">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Hoje · {confirmedToday}/{todaySchedules.length} confirmadas
                    </span>
                  )}
                  <button
                    onClick={() => {
                      const t = new Date();
                      setYear(t.getFullYear());
                      setMonth(t.getMonth());
                      setSelectedDate(todayStr);
                    }}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white text-primary hover:bg-white/90 transition-colors px-4 py-1.5 text-xs sm:text-sm font-semibold shadow-sm"
                  >
                    Ver hoje
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Quick stats */}
      {(() => {
        const monthSchedules = Array.from(schedulesByDate.values()).flat();
        const confirmed = monthSchedules.filter(s => s.status === "Confirmado").length;
        const pending = monthSchedules.filter(s => s.status === "Pendente").length;
        const activeMembers = new Set(monthSchedules.flatMap(s => s.memberIds)).size;
        const items = [
          { label: "Escalas", value: monthSchedules.length, tone: "primary" as const, Icon: Calendar },
          { label: "Confirmadas", value: confirmed, tone: "emerald" as const, Icon: CheckCircle2 },
          { label: "Pendentes", value: pending, tone: "amber" as const, Icon: Clock },
          { label: "Membros ativos", value: activeMembers, tone: "accent" as const, Icon: UserPlus },
        ];
        const toneMap = {
          primary: "from-primary/15 to-primary/5 text-primary",
          emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400",
          amber: "from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400",
          accent: "from-accent/20 to-accent/5 text-accent-foreground",
        };
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
            {items.map(({ label, value, tone, Icon }, idx) => (
              <div
                key={label}
                className={cn(
                  "stat-card bg-gradient-to-br border-border/60 text-left stagger-item",
                  toneMap[tone]
                )}
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <div className="flex items-center justify-between">
                  <span className="eyebrow">{label}</span>
                  <Icon className="h-4 w-4 opacity-70" />
                </div>
                <div className="mt-1.5 font-display text-2xl sm:text-3xl font-bold tabular-nums text-foreground">
                  {value}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      <HomeDashboard year={year} month={month} onSelectDate={setSelectedDate} />


      {/* Calendar */}
      <div className="content-card">
        <div className="card-header-pad flex items-center justify-between border-b bg-muted/30">
          <Button variant="ghost" size="icon" className="icon-btn" onClick={prevMonth} aria-label="Mês anterior">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="section-title">
            {MONTH_NAMES[month]} {year}
          </h2>
          <Button variant="ghost" size="icon" className="icon-btn" onClick={nextMonth} aria-label="Próximo mês">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <div className="grid grid-cols-7">
          {DAYS.map(d => (
            <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground border-b">
              {d}
            </div>
          ))}
          {calendarDays.map((day, i) => {
            if (day === null) return <div key={`empty-${i}`} className="border-b border-r last:border-r-0" />;
            const ds = dateStr(day);
            const daySchedules = schedulesByDate.get(ds) || [];
            const isToday = ds === todayStr;
            const isSelected = ds === selectedDate;
            const hasManha = daySchedules.some(s => s.shift === "Manhã");
            const hasNoite = daySchedules.some(s => s.shift === "Noite");
            const uniqueMinistries = [...new Set(daySchedules.map(s => s.ministryId))].sort((a, b) => {
              const minA = ministries.find(m => m.id === a);
              const minB = ministries.find(m => m.id === b);
              return getMinistryOrder(minA?.name || "") - getMinistryOrder(minB?.name || "");
            });
            const previewText = daySchedules.length > 0
              ? uniqueMinistries
                  .map(mid => ministries.find(m => m.id === mid)?.name)
                  .filter(Boolean)
                  .join(" · ")
              : "";

            return (
              <button
                key={ds}
                onClick={() => setSelectedDate(ds)}
                title={previewText || undefined}
                aria-label={`Dia ${day}${daySchedules.length ? ` — ${daySchedules.length} escala(s)` : ""}`}
                className={cn(
                  "group relative min-h-[72px] sm:min-h-[96px] border-b border-r last:border-r-0 p-1.5 sm:p-2 text-left transition-all duration-200 hover:bg-muted/50 hover:z-10 hover:shadow-md",
                  isSelected && "bg-primary/10 ring-2 ring-primary ring-inset",
                  isToday && !isSelected && "bg-accent/10"
                )}
              >
                <div className="flex items-start justify-between">
                  <span className={cn(
                    "text-xs sm:text-sm font-medium relative",
                    isToday && "today-pulse bg-primary text-primary-foreground rounded-full w-6 h-6 sm:w-7 sm:h-7 inline-flex items-center justify-center shadow-sm",
                    !isToday && "text-foreground"
                  )}>
                    {day}
                  </span>
                  {(hasManha || hasNoite) && (
                    <span className="flex items-center gap-0.5 text-[10px] leading-none">
                      {hasManha && <span title="Turno da manhã" aria-label="Manhã">☀️</span>}
                      {hasNoite && <span title="Turno da noite" aria-label="Noite">🌙</span>}
                    </span>
                  )}
                </div>
                {daySchedules.length > 0 && (
                  <div className="mt-1">
                    <div className="flex flex-wrap gap-1">
                      {uniqueMinistries.slice(0, 5).map(mid => {
                        const min = ministries.find(m => m.id === mid);
                        if (!min) return null;
                        const color = MINISTRY_COLORS[min.colorIndex % MINISTRY_COLORS.length];
                        const Icon = getMinistryIcon(min.name);
                        return (
                          <span
                            key={mid}
                            title={min.name}
                            className="h-5 w-5 sm:h-6 sm:w-6 rounded-full flex items-center justify-center shadow-sm ring-1 ring-white/50"
                            style={{ backgroundColor: `hsl(${color} / 0.2)`, color: `hsl(${color})` }}
                          >
                            <Icon className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                          </span>
                        );
                      })}
                    </div>
                    {uniqueMinistries.length > 5 && (
                      <span className="text-[9px] text-muted-foreground mt-0.5 block">+{uniqueMinistries.length - 5}</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        {(() => {
          const usedMinistryIds = new Set(
            Array.from(schedulesByDate.values()).flat().map(s => s.ministryId)
          );
          const legend = ministries
            .filter(m => usedMinistryIds.has(m.id))
            .sort((a, b) => getMinistryOrder(a.name) - getMinistryOrder(b.name));
          if (legend.length === 0) return null;
          return (
            <div className="border-t bg-muted/20 px-3 py-2.5 sm:px-4 sm:py-3">
              <p className="eyebrow mb-1.5">Legenda · {MONTH_NAMES[month]}</p>
              <div className="flex flex-wrap gap-1.5">
                {legend.map(min => {
                  const color = MINISTRY_COLORS[min.colorIndex % MINISTRY_COLORS.length];
                  const Icon = getMinistryIcon(min.name);
                  return (
                    <span
                      key={min.id}
                      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium"
                      style={{
                        backgroundColor: `hsl(${color} / 0.12)`,
                        color: `hsl(${color})`,
                        borderColor: `hsl(${color} / 0.3)`,
                      }}
                    >
                      <Icon className="h-3 w-3" />
                      {min.name}
                    </span>
                  );
                })}
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                  ☀️ Manhã
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                  🌙 Noite
                </span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Selected date detail — modern shift cards */}
      {selectedDate && (
        <div className="animate-fade-in section-stack">
          {/* Date header */}
          <div className="content-card">
            <div className="card-header-pad flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="card-title">
                  {formatDate(selectedDate)}
                </h3>
                <p className="meta-text mt-0.5">{getDayOfWeek(selectedDate)} · {selectedSchedules.length} escala{selectedSchedules.length !== 1 ? "s" : ""}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {selectedSchedules.length > 0 && pendingCountForSelectedDate > 0 && (
                  <Button
                    variant="outline"
                    onClick={handleConfirmAllForDate}
                    className="gap-2 h-10 sm:h-11 border-emerald-400/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
                    title="Confirmar todas as escalas do dia"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Confirmar todas ({pendingCountForSelectedDate})
                  </Button>
                )}
                <Button variant="outline" size="icon" className="icon-btn" title="Exportar PDF" onClick={() => setShowPdfDialog(true)}>
                  <FileText className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="icon-btn" title="Compartilhar WhatsApp" onClick={() => shareViaWhatsApp({ schedules, members, ministries }, selectedDate)}>
                  <Share2 className="h-4 w-4" />
                </Button>
                <Button onClick={() => setShowAddDialog(true)} className="gap-2 h-10 sm:h-11 px-4 sm:px-5 text-sm sm:text-base">
                  <Plus className="h-4 w-4 sm:h-5 sm:w-5" /> Nova Escala
                </Button>
              </div>
            </div>
          </div>


          {selectedSchedules.length === 0 ? (
            <div className="content-card flex flex-col items-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">Nenhuma escala nesta data.</p>
              <p className="text-xs mt-1 opacity-60">Clique em "Nova Escala" para começar</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              {groupedByShift.map(group => {
                const isManha = group.shift === "Manhã";
                return (
                  <div
                    key={group.shift}
                    className={cn(
                      "rounded-xl border overflow-hidden shadow-md hover:shadow-lg transition-shadow",
                      isManha
                        ? "border-amber-200/60 bg-gradient-to-br from-amber-50/90 via-white to-orange-50/40 dark:from-amber-950/30 dark:via-card dark:to-orange-950/10 dark:border-amber-900/40"
                        : "border-indigo-200/60 bg-gradient-to-br from-indigo-50/90 via-white to-violet-50/40 dark:from-indigo-950/30 dark:via-card dark:to-violet-950/10 dark:border-indigo-900/40"
                    )}
                  >
                    {/* Shift header */}
                    <div className={cn(
                      "card-header-pad flex items-center gap-3",
                      isManha
                        ? "bg-amber-100/60 dark:bg-amber-900/20"
                        : "bg-indigo-100/60 dark:bg-indigo-900/20"
                    )}>
                      <div className={cn(
                        "h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center text-base sm:text-lg shrink-0",
                        isManha
                          ? "bg-amber-200 dark:bg-amber-800/40"
                          : "bg-indigo-200 dark:bg-indigo-800/40"
                      )}>
                        {isManha ? "☀️" : "🌙"}
                      </div>
                      <div className="min-w-0">
                        <h4 className={cn(
                          "section-title",
                          isManha ? "text-amber-800 dark:text-amber-300" : "text-indigo-800 dark:text-indigo-300"
                        )}>
                          Turno da {group.shift}
                        </h4>
                        <p className={cn(
                          "text-xs",
                          isManha ? "text-amber-600/70 dark:text-amber-400/60" : "text-indigo-600/70 dark:text-indigo-400/60"
                        )}>
                          {group.schedules.length} ministério{group.schedules.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>

                    {/* Schedule items */}
                    <div className="p-2 sm:p-3 space-y-2">
                      {group.schedules.map(s => {
                        const ministry = ministries.find(m => m.id === s.ministryId);
                        const memberNames = s.memberIds.map(mid => members.find(m => m.id === mid)?.name || "?");

                        const color = ministry ? MINISTRY_COLORS[ministry.colorIndex % MINISTRY_COLORS.length] : "";
                        const isEditing = editingScheduleId === s.id;
                        const editableMembers = ministry ? members.filter(m => m.ministryIds.includes(s.ministryId)) : members;

                        const MinIcon = ministry ? getMinistryIcon(ministry.name) : null;

                        return (
                          <div
                            key={s.id}
                            className={cn(
                              "rounded-lg p-3 sm:p-3.5 transition-all hover:shadow-md",
                              "bg-gradient-to-r from-white to-muted/20 dark:from-card dark:to-muted/10",
                              s.status === "Recusado" && "opacity-50"
                            )}
                            style={{ borderLeft: `4px solid hsl(${color})` }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  {MinIcon && (
                                    <span
                                      className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                                      style={{ backgroundColor: `hsl(${color} / 0.15)`, color: `hsl(${color})` }}
                                    >
                                      <MinIcon className="h-4 w-4" />
                                    </span>
                                  )}
                                  <span
                                    className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold"
                                    style={ministry ? {
                                      backgroundColor: `hsl(${color} / 0.1)`,
                                      color: `hsl(${color})`,
                                    } : {}}
                                  >
                                    {ministry?.name || "?"}
                                  </span>
                                </div>

                                {/* Members or edit mode */}
                                {isEditing ? (
                                  <div className="space-y-2">
                                    <div className="flex flex-wrap gap-1.5">
                                      {editableMembers.map(m => {
                                        const selected = editMemberIds.includes(m.id);
                                        return (
                                          <button
                                            key={m.id}
                                            onClick={() => toggleEditMember(m.id)}
                                            className={cn(
                                              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors",
                                              selected
                                                ? "bg-primary/10 text-primary border-primary/30"
                                                : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted"
                                            )}
                                          >
                                            {selected && <Check className="h-3 w-3" />}
                                            {m.name}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <div className="flex gap-1.5">
                                      <Button size="sm" className="h-7 text-xs" onClick={() => saveEditMembers(s)} disabled={editMemberIds.length === 0}>
                                        <Check className="h-3 w-3 mr-1" /> Salvar
                                      </Button>
                                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingScheduleId(null)}>
                                        Cancelar
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-wrap gap-1.5">
                                    {memberNames.map((name, idx) => (
                                      <span key={idx} className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1 text-xs font-medium text-foreground">
                                        <span className="h-1.5 w-1.5 rounded-full bg-foreground/40" />
                                        {name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {/* Edit button */}
                                <button
                                  onClick={() => startEditMembers(s)}
                                  title="Editar membros"
                                  className="rounded-md p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => handleDelete(s.id)} className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add schedule dialog — multi-member selection */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Nova Escala — {selectedDate ? formatDate(selectedDate) : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
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
              <label className="text-sm font-medium text-foreground mb-1.5 block">Turno</label>
              <Select value={newForm.shift} onValueChange={v => setNewForm(f => ({ ...f, shift: v as Shift }))}>
                <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Manhã">Manhã</SelectItem>
                  <SelectItem value="Noite">Noite</SelectItem>
                </SelectContent>
              </Select>
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
                        <button onClick={() => toggleMember(id)} className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
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
            <Button className="w-full h-12 text-base" onClick={handleAdd} disabled={newForm.selectedMemberIds.length === 0 || !newForm.ministryId}>
              <UserPlus className="h-5 w-5 mr-2" />
              Adicionar {newForm.selectedMemberIds.length > 0 ? `${newForm.selectedMemberIds.length} pessoa${newForm.selectedMemberIds.length > 1 ? "s" : ""}` : "Escala"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PDF Export Options */}
      <Dialog open={showPdfDialog} onOpenChange={setShowPdfDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar PDF</DialogTitle>
            <DialogDescription>Escolha quais campos incluir no PDF.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {[
              { key: "showDate", label: "Data" },
              { key: "showShift", label: "Turno (Manhã / Noite)" },
              { key: "showMinistry", label: "Ministério" },
              { key: "showMembers", label: "Membros" },
            ].map(opt => (
              <label
                key={opt.key}
                htmlFor={`pdf-${opt.key}`}
                className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  id={`pdf-${opt.key}`}
                  checked={pdfOpts[opt.key as keyof typeof pdfOpts]}
                  onCheckedChange={(c) =>
                    setPdfOpts(p => ({ ...p, [opt.key]: c === true }))
                  }
                />
                <span className="text-sm font-medium">{opt.label}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPdfDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (selectedDate) {
                  exportToPDF({ schedules, members, ministries }, selectedDate, pdfOpts);
                  setShowPdfDialog(false);
                }
              }}
              disabled={!Object.values(pdfOpts).some(Boolean)}
            >
              <FileText className="h-4 w-4 mr-2" />
              Gerar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

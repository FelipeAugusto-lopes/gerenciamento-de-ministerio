import { useCallback, useMemo, useState } from "react";
import { useStore } from "@/store/StoreContext";
import { formatDate, getDayOfWeek, getMinistryStyle, getMinistryOrder, sortMinistries } from "@/lib/helpers";
import { MINISTRY_COLORS, type Schedule, type Shift } from "@/types";
import { getMinistryIcon } from "@/lib/ministryIcons";
import { exportMonthToPDF, shareMonthViaWhatsApp, SHIFT_TIMES } from "@/lib/exportSchedule";
import { getWeekDates, shiftWeek } from "@/lib/scheduleWeek";
import { groupByShift, groupSchedulesByDate, sameDayConflicts } from "@/lib/scheduleInsights";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  ChevronLeft, ChevronRight, Search, X, FileDown, Share2, Sun, Moon,
  LayoutGrid, List, CalendarRange, Users, CalendarCheck, CalendarClock, Filter, Church, AlertTriangle,
} from "lucide-react";

type ViewMode = "mes" | "semana" | "lista";
type Scope = "geral" | "ministerio";

const WEEKDAY_SHORT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

function eventLabel(date: string, shift: Shift): string {
  const d = new Date(date + "T12:00:00");
  if (d.getDay() === 0) return shift === "Manhã" ? "Culto da Manhã" : "Culto da Noite";
  return shift === "Manhã" ? "Reunião — Manhã" : "Reunião — Noite";
}

function monthLabelOf(d: Date): string {
  const s = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function matchesScheduleFilters(
  schedule: Schedule,
  filters: {
    ministryId: string;
    memberId: string;
    shift: string;
    date: string;
    search: string;
  },
  ministryName: string,
  memberNames: string,
): boolean {
  if (filters.ministryId !== "all" && schedule.ministryId !== filters.ministryId) return false;
  if (filters.memberId !== "all" && !schedule.memberIds.includes(filters.memberId)) return false;
  if (filters.shift !== "all" && schedule.shift !== filters.shift) return false;
  if (filters.date && schedule.date !== filters.date) return false;
  const q = filters.search.trim().toLowerCase();
  if (q && !ministryName.includes(q) && !memberNames.includes(q)) return false;
  return true;
}

export default function ScheduleView() {
  const { schedules, ministries, members, loading } = useStore();
  const isMobile = useIsMobile();

  const [scope, setScope] = useState<Scope>("geral");
  const [viewMode, setViewMode] = useState<ViewMode>(isMobile ? "lista" : "mes");
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  });

  // Filters
  const [filterMinistry, setFilterMinistry] = useState("all");
  const [filterMember, setFilterMember] = useState("all");
  const [filterShift, setFilterShift] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Dialogs
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);

  const orderedMinistries = useMemo(() => sortMinistries(ministries), [ministries]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthLabel = monthLabelOf(cursor);
  const todayStr = new Date().toISOString().split("T")[0];

  const conflictsByDate = useMemo(() => sameDayConflicts(schedules), [schedules]);
  const ministryById = useMemo(() => new Map(ministries.map(m => [m.id, m])), [ministries]);
  const memberById = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);

  const filters = useMemo(() => ({
    ministryId: filterMinistry,
    memberId: filterMember,
    shift: filterShift,
    date: filterDate,
    search,
  }), [filterMinistry, filterMember, filterShift, filterDate, search]);

  const scheduleMatches = useCallback((s: Schedule) => {
    const ministryName = (ministryById.get(s.ministryId)?.name || "").toLowerCase();
    const memberNames = s.memberIds.map(id => memberById.get(id)?.name || "").join(" ").toLowerCase();
    return matchesScheduleFilters(s, filters, ministryName, memberNames);
  }, [filters, ministryById, memberById]);

  // ----- Filtering -----
  const monthSchedules = useMemo(() => {
    return schedules.filter(s => {
      const d = new Date(s.date + "T12:00:00");
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }, [schedules, year, month]);

  const filtered = useMemo(
    () => monthSchedules.filter(scheduleMatches),
    [monthSchedules, scheduleMatches],
  );

  const activeFilters =
    (filterMinistry !== "all" ? 1 : 0) +
    (filterMember !== "all" ? 1 : 0) +
    (filterShift !== "all" ? 1 : 0) +
    (filterDate ? 1 : 0) +
    (search.trim() ? 1 : 0);

  const clearFilters = () => {
    setFilterMinistry("all");
    setFilterMember("all");
    setFilterShift("all");
    setFilterDate("");
    setSearch("");
  };

  // ----- Navigation -----
  const moveMonth = (delta: number) => setCursor(new Date(year, month + delta, 1));
  const goToday = () => {
    const d = new Date();
    setCursor(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
  };

  // ----- Month grid -----
  const monthCells = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  const ministryOrder = useCallback(
    (ministryId: string) => getMinistryOrder(ministryById.get(ministryId)?.name || ""),
    [ministryById],
  );

  const schedulesByDate = useMemo(() => {
    const map = groupSchedulesByDate(filtered);
    map.forEach(list =>
      list.sort((a, b) => {
        if (a.shift !== b.shift) return a.shift === "Manhã" ? -1 : 1;
        return ministryOrder(a.ministryId) - ministryOrder(b.ministryId);
      })
    );
    return map;
  }, [filtered, ministryOrder]);

  // ----- Week view -----
  // A semana segue a data âncora, não o mês selecionado, e inclui dias do mês vizinho.
  const weekDates = useMemo(() => getWeekDates(cursor), [cursor]);
  const weekDateSet = useMemo(() => new Set(weekDates), [weekDates]);
  const weekFiltered = useMemo(
    () => schedules.filter(s => weekDateSet.has(s.date) && scheduleMatches(s)),
    [schedules, weekDateSet, scheduleMatches],
  );
  const weekSchedulesByDate = useMemo(() => {
    const map = groupSchedulesByDate(weekFiltered);
    map.forEach(list =>
      list.sort((a, b) => {
        if (a.shift !== b.shift) return a.shift === "Manhã" ? -1 : 1;
        return ministryOrder(a.ministryId) - ministryOrder(b.ministryId);
      })
    );
    return map;
  }, [weekFiltered, ministryOrder]);

  const moveWeek = (delta: number) => setCursor(current => shiftWeek(current, delta));
  const weekLabel = weekDates.length === 7
    ? `${formatDate(weekDates[0]).slice(0, 5)} – ${formatDate(weekDates[6]).slice(0, 5)}`
    : monthLabel;

  // ----- List view grouping -----
  const listGroups = useMemo(() => {
    const dates = Array.from(schedulesByDate.keys()).sort();
    return dates.map(date => ({
      date,
      manha: (schedulesByDate.get(date) || []).filter(s => s.shift === "Manhã"),
      noite: (schedulesByDate.get(date) || []).filter(s => s.shift === "Noite"),
    }));
  }, [schedulesByDate]);

  // ----- Ministry summary (Por Ministério) -----
  const selectedMinistry = filterMinistry !== "all" ? ministryById.get(filterMinistry) : undefined;

  const ministrySummary = useMemo(() => {
    if (!selectedMinistry) return null;
    const list = monthSchedules.filter(s => s.ministryId === selectedMinistry.id);
    const people = new Set(list.flatMap(s => s.memberIds));
    const events = new Set(list.map(s => s.date));
    const next = list.filter(s => s.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date))[0];
    return {
      total: list.length,
      people: people.size,
      events: events.size,
      next: next ? `${formatDate(next.date)} — ${SHIFT_TIMES[next.shift]}` : "—",
    };
  }, [selectedMinistry, monthSchedules, todayStr]);

  // ----- Export -----
  const exportData = { schedules, members, ministries };
  const viewingWeek = viewMode === "semana";
  const exportSchedules = viewingWeek ? weekFiltered : filtered;
  const exportLabel = viewingWeek ? weekLabel : monthLabel;
  const exportTitle = scope === "ministerio" && selectedMinistry ? selectedMinistry.name : undefined;

  const dayDetailSchedules = selectedDate ? schedulesByDate.get(selectedDate) || [] : [];

  const ShiftBadge = ({ shift }: { shift: Shift }) => (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
      shift === "Manhã" ? "bg-amber-500/15 text-amber-600" : "bg-indigo-500/15 text-indigo-500"
    )}>
      {shift === "Manhã" ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
      {shift} · {SHIFT_TIMES[shift]}
    </span>
  );

  const ScheduleRow = ({ s, showMinistry = true }: { s: Schedule; showMinistry?: boolean }) => {
    const ministry = ministryById.get(s.ministryId);
    const conflictIds = conflictsByDate.get(s.date);
    const color = ministry ? MINISTRY_COLORS[ministry.colorIndex % MINISTRY_COLORS.length] : "0 0% 50%";
    return (
      <button
        onClick={() => setSelectedSchedule(s)}
        className="w-full text-left rounded-lg border border-border/60 bg-card p-2.5 hover:shadow-sm transition-shadow"
        style={{ borderLeftWidth: 3, borderLeftColor: `hsl(${color})` }}
      >
        {showMinistry && ministry && (
          <span className="ministry-badge border mb-1.5 inline-flex" style={getMinistryStyle(ministry.colorIndex)}>
            {ministry.name}
          </span>
        )}
        <div className="flex flex-wrap gap-1">
          {s.memberIds.length === 0 ? (
            <span className="text-xs text-muted-foreground italic">Nenhum membro vinculado</span>
          ) : (
            s.memberIds.map(id => {
              const conflicted = conflictIds?.has(id);
              return (
                <span
                  key={id}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    conflicted ? "bg-destructive/15 text-destructive" : "bg-muted/60 text-foreground",
                  )}
                  title={conflicted ? "Escalado mais de uma vez neste dia" : undefined}
                >
                  {memberById.get(id)?.name || "?"}
                </span>
              );
            })
          )}
        </div>
      </button>
    );
  };

  if (loading) {
    return <div className="py-16 text-center text-muted-foreground">Carregando escalas…</div>;
  }

  return (
    <div className="page-stack animate-fade-in">
      {/* Scope toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="inline-flex rounded-full border border-border/60 bg-muted/40 p-1">
          {(["geral", "ministerio"] as Scope[]).map(sc => (
            <button
              key={sc}
              onClick={() => {
                setScope(sc);
                if (sc === "ministerio" && filterMinistry === "all" && orderedMinistries.length > 0) {
                  setFilterMinistry(orderedMinistries[0].id);
                }
                if (sc === "geral") setFilterMinistry("all");
              }}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-all",
                scope === sc ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {sc === "geral" ? "Todos os Ministérios" : "Por Ministério"}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportMonthToPDF(exportData, exportLabel, exportSchedules, exportTitle)}>
            <FileDown className="h-4 w-4" /> <span className="hidden sm:inline">Exportar PDF</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => shareMonthViaWhatsApp(exportData, exportLabel, exportSchedules, exportTitle)}>
            <Share2 className="h-4 w-4" /> <span className="hidden sm:inline">Compartilhar</span>
          </Button>
        </div>
      </div>

      {/* Ministry header (Por Ministério) */}
      {scope === "ministerio" && selectedMinistry && (
        <div className="content-card card-pad space-y-4">
          <div className="flex items-center gap-3">
            <span
              className="flex h-11 w-11 items-center justify-center rounded-xl"
              style={{ backgroundColor: `hsl(${MINISTRY_COLORS[selectedMinistry.colorIndex % MINISTRY_COLORS.length]} / 0.15)`, color: `hsl(${MINISTRY_COLORS[selectedMinistry.colorIndex % MINISTRY_COLORS.length]})` }}
            >
              {(() => { const Icon = getMinistryIcon(selectedMinistry.name); return <Icon className="h-5 w-5" />; })()}
            </span>
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight">{selectedMinistry.name}</h2>
              <p className="text-sm text-muted-foreground capitalize">{monthLabel}</p>
            </div>
          </div>
          {ministrySummary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <div className="stat-card bg-muted/40">
                <CalendarCheck className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-xl sm:text-2xl font-bold">{ministrySummary.total}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Escalas no mês</p>
              </div>
              <div className="stat-card bg-muted/40">
                <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-xl sm:text-2xl font-bold">{ministrySummary.people}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Pessoas escaladas</p>
              </div>
              <div className="stat-card bg-muted/40">
                <Church className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-xl sm:text-2xl font-bold">{ministrySummary.events}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Eventos</p>
              </div>
              <div className="stat-card bg-muted/40">
                <CalendarClock className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-sm sm:text-base font-bold leading-tight">{ministrySummary.next}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Próxima escala</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Month navigation + view mode */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => (viewMode === "semana" ? moveWeek(-1) : moveMonth(-1))} aria-label="Anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToday}>Hoje</Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => (viewMode === "semana" ? moveWeek(1) : moveMonth(1))} aria-label="Próximo">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Select
            value={`${year}-${month}`}
            onValueChange={v => {
              const [y, m] = v.split("-").map(Number);
              setCursor(new Date(y, m, 1));
            }}
          >
            <SelectTrigger className="h-9 w-auto min-w-[140px] font-semibold capitalize">
              <SelectValue>{viewMode === "semana" ? weekLabel : monthLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 25 }, (_, i) => {
                const d = new Date(year, month - 12 + i, 1);
                return (
                  <SelectItem key={i} value={`${d.getFullYear()}-${d.getMonth()}`} className="capitalize">
                    {monthLabelOf(d)}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="inline-flex rounded-full border border-border/60 bg-muted/40 p-1">
          {([
            { id: "mes", label: "Mês", icon: LayoutGrid },
            { id: "semana", label: "Semana", icon: CalendarRange },
            { id: "lista", label: "Lista", icon: List },
          ] as { id: ViewMode; label: string; icon: typeof List }[]).map(v => (
            <button
              key={v.id}
              onClick={() => setViewMode(v.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all",
                viewMode === v.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <v.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{v.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar pessoa ou ministério..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 h-11"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="gap-2 h-11 px-3 sm:px-4 relative">
          <Filter className="h-4 w-4" /> <span className="hidden sm:inline">Filtros</span>
          {activeFilters > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold">{activeFilters}</span>
          )}
        </Button>
      </div>

      {showFilters && (
        <div className="content-card p-4 animate-fade-in space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            {scope === "geral" && (
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Ministério</label>
                <Select value={filterMinistry} onValueChange={setFilterMinistry}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Ministérios</SelectItem>
                    {orderedMinistries.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Pessoa</label>
              <Select value={filterMember} onValueChange={setFilterMember}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {members.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Horário</label>
              <Select value={filterShift} onValueChange={setFilterShift}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Manhã">Manhã · 10:00</SelectItem>
                  <SelectItem value="Noite">Noite · 18:00</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Data</label>
              <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="h-11" />
            </div>
          </div>
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={clearFilters}>
              <X className="h-3 w-3 mr-1" /> Limpar filtros
            </Button>
          )}
        </div>
      )}

      {/* Ministry selector (Por Ministério) */}
      {scope === "ministerio" && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {orderedMinistries.map(m => {
            const active = filterMinistry === m.id;
            const Icon = getMinistryIcon(m.name);
            return (
              <button
                key={m.id}
                onClick={() => setFilterMinistry(m.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-all",
                  active ? "shadow-sm" : "border-border/60 bg-muted/40 text-muted-foreground hover:text-foreground"
                )}
                style={active ? getMinistryStyle(m.colorIndex) : undefined}
              >
                <Icon className="h-4 w-4" />
                {m.name}
              </button>
            );
          })}
        </div>
      )}

      {/* ============ MONTH VIEW ============ */}
      {viewMode === "mes" && (
        <div className="content-card p-2 sm:p-4">
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {WEEKDAY_SHORT.map(d => (
              <div key={d} className="py-1.5 text-center text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {d}
              </div>
            ))}
            {monthCells.map((dateStr, i) => {
              if (!dateStr) return <div key={i} className="min-h-[52px] sm:min-h-[128px] rounded-lg bg-muted/20" />;
              const daySchedules = schedulesByDate.get(dateStr) || [];
              const dayNum = Number(dateStr.split("-")[2]);
              const isToday = dateStr === todayStr;
              const dayConflicts = conflictsByDate.get(dateStr);
              const hasConflict = !!dayConflicts && daySchedules.some(s => s.memberIds.some(id => dayConflicts.has(id)));
              const groups = groupByShift(daySchedules, id => getMinistryOrder(ministryById.get(id)?.name || ""));
              return (
                <button
                  key={i}
                  onClick={() => daySchedules.length > 0 && setSelectedDate(dateStr)}
                  className={cn(
                    "min-h-[52px] sm:min-h-[128px] rounded-lg border p-1 sm:p-1.5 text-left transition-all flex flex-col",
                    daySchedules.length > 0 ? "border-border/60 bg-card hover:shadow-md hover:border-primary/40 cursor-pointer" : "border-transparent",
                    isToday && "ring-2 ring-primary/60",
                    hasConflict && "border-destructive/50"
                  )}
                >
                  <span className="mb-1 flex items-center justify-between gap-1">
                    <span className={cn(
                      "text-xs sm:text-sm font-bold inline-flex h-6 w-6 items-center justify-center rounded-full",
                      isToday ? "bg-primary text-primary-foreground" : "text-foreground"
                    )}>
                      {dayNum}
                    </span>
                    {hasConflict && <AlertTriangle className="h-3.5 w-3.5 text-destructive" aria-label="Conflito neste dia" />}
                  </span>
                  <div className="hidden sm:block space-y-1 flex-1">
                    {groups.map(group => {
                      const preview = scope === "geral"
                        ? group.items.slice(0, 2).map(item => ministryById.get(item.ministryId)?.name || "Ministério")
                        : group.items.flatMap(item => item.memberIds.map(id => memberById.get(id)?.name || "?")).slice(0, 2);
                      const total = scope === "geral"
                        ? group.items.length
                        : group.items.reduce((sum, item) => sum + item.memberIds.length, 0);
                      const extra = total - preview.length;
                      return (
                        <div key={group.shift}>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {group.shift}
                          </p>
                          <p className="text-xs leading-snug text-foreground line-clamp-2">
                            {preview.join(scope === "geral" ? " · " : ", ")}
                            {extra > 0 ? ` +${extra}` : ""}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  {daySchedules.length > 0 && (
                    <span className="sm:hidden text-[10px] font-medium text-muted-foreground">
                      {daySchedules.length} escala{daySchedules.length > 1 ? "s" : ""}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ============ WEEK VIEW ============ */}
      {viewMode === "semana" && (
        <div className="section-stack">
          {weekDates.map(dateStr => {
            const daySchedules = weekSchedulesByDate.get(dateStr) || [];
            const d = new Date(dateStr + "T12:00:00");
            const isToday = dateStr === todayStr;
            return (
              <div key={dateStr} className="content-card card-pad">
                <div className="flex items-center gap-3 mb-3">
                  <span className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold",
                    isToday ? "bg-primary text-primary-foreground" : "bg-muted/60 text-foreground"
                  )}>
                    {String(d.getDate()).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{getDayOfWeek(dateStr)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(dateStr)}</p>
                  </div>
                </div>
                {daySchedules.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Sem escalas</p>
                ) : (
                  <div className="space-y-3">
                    {(["Manhã", "Noite"] as Shift[]).map(shift => {
                      const list = daySchedules.filter(s => s.shift === shift);
                      if (list.length === 0) return null;
                      return (
                        <div key={shift}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <ShiftBadge shift={shift} />
                            <span className="text-xs text-muted-foreground">{eventLabel(dateStr, shift)}</span>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {list.map(s => <ScheduleRow key={s.id} s={s} showMinistry={scope === "geral"} />)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ============ LIST VIEW ============ */}
      {viewMode === "lista" && (
        <div className="section-stack">
          {listGroups.length === 0 && (
            <div className="content-card card-pad text-center text-muted-foreground">
              Nenhuma escala encontrada neste período.
            </div>
          )}
          {listGroups.map(g => {
            const d = new Date(g.date + "T12:00:00");
            const isToday = g.date === todayStr;
            return (
              <div key={g.date} className="content-card card-pad">
                <div className="flex items-center gap-3 mb-3">
                  <span className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold",
                    isToday ? "bg-primary text-primary-foreground" : "bg-muted/60 text-foreground"
                  )}>
                    {String(d.getDate()).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{getDayOfWeek(g.date)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(g.date)}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {([
                    { shift: "Manhã" as Shift, list: g.manha },
                    { shift: "Noite" as Shift, list: g.noite },
                  ]).map(({ shift, list }) => {
                    if (list.length === 0) return null;
                    return (
                      <div key={shift}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <ShiftBadge shift={shift} />
                          <span className="text-xs text-muted-foreground">{eventLabel(g.date, shift)}</span>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {list.map(s => <ScheduleRow key={s.id} s={s} showMinistry={scope === "geral"} />)}
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

      {/* ============ DAY DETAIL DIALOG ============ */}
      <Dialog open={!!selectedDate} onOpenChange={open => !open && setSelectedDate(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Escalas de {selectedDate ? `${new Date(selectedDate + "T12:00:00").getDate()} de ${new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", { month: "long" })}` : ""}
            </DialogTitle>
          </DialogHeader>
          {selectedDate && (
            <div className="space-y-4">
              {conflictsByDate.get(selectedDate) && dayDetailSchedules.some(schedule => schedule.memberIds.some(id => conflictsByDate.get(selectedDate)?.has(id))) && (
                <p className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Há pessoas escaladas mais de uma vez neste dia.
                </p>
              )}
              {groupByShift(dayDetailSchedules, id => getMinistryOrder(ministryById.get(id)?.name || "")).map(group => (
                <div key={group.shift}>
                  <div className="flex items-center gap-2 mb-2">
                    <ShiftBadge shift={group.shift} />
                    <span className="text-sm font-medium text-muted-foreground">{eventLabel(selectedDate, group.shift)}</span>
                  </div>
                  <div className="space-y-2">
                    {group.items.map(s => <ScheduleRow key={s.id} s={s} showMinistry={scope === "geral"} />)}
                  </div>
                </div>
              ))}
              {dayDetailSchedules.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma escala neste dia.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ============ SCHEDULE DETAIL DIALOG ============ */}
      <Dialog open={!!selectedSchedule} onOpenChange={open => !open && setSelectedSchedule(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhe da escala</DialogTitle>
          </DialogHeader>
          {selectedSchedule && (() => {
            const ministry = ministryById.get(selectedSchedule.ministryId);
            const names = selectedSchedule.memberIds.map(id => memberById.get(id)?.name || "?");
            return (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Evento</p>
                  <p className="font-medium">{eventLabel(selectedSchedule.date, selectedSchedule.shift)}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Data</p>
                    <p className="font-medium">{formatDate(selectedSchedule.date)}</p>
                    <p className="text-xs text-muted-foreground">{getDayOfWeek(selectedSchedule.date)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Horário</p>
                    <p className="font-medium">{SHIFT_TIMES[selectedSchedule.shift]}</p>
                    <p className="text-xs text-muted-foreground">{selectedSchedule.shift}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Ministério</p>
                  {ministry && (
                    <span className="ministry-badge border" style={getMinistryStyle(ministry.colorIndex)}>{ministry.name}</span>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Escalados</p>
                  {names.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Nenhum membro vinculado</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {names.map((n, i) => (
                        <span key={i} className="rounded-full bg-muted/60 px-3 py-1 text-sm font-medium">{n}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

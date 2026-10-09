import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "@/store/StoreContext";
import { formatDate, getDayOfWeek, getMinistryStyle, getMinistryOrder, sortMinistries } from "@/lib/helpers";
import { MINISTRY_COLORS, type Schedule, type Shift } from "@/types";
import { getMinistryIcon } from "@/lib/ministryIcons";
import { exportMonthToPDF, shareMonthViaWhatsApp, SHIFT_TIMES } from "@/lib/exportSchedule";
import { getWeekDates, shiftWeek } from "@/lib/scheduleWeek";
import { buildDayBoards, groupSchedulesByDate, type DayBoardMinistry } from "@/lib/scheduleInsights";
import { getVisualMinistry, listVisualMinistries, scheduleBelongsToMinistryFilter } from "@/lib/ministryGrouping";
import { DayPanel, formatDayHeading } from "@/components/schedule/DayPanel";
import { MobileScheduleAgenda } from "@/components/schedule/MobileScheduleAgenda";
import { MonthDayCell } from "@/components/schedule/MonthDayCell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { buildMobileAgenda } from "@/lib/mobileAgenda";
import { cn } from "@/lib/utils";
import {
  ChevronLeft, ChevronRight, Search, X, FileDown, Share2, Sun, Moon,
  LayoutGrid, List, CalendarRange, Users, CalendarCheck, CalendarClock, Filter, Church,
} from "lucide-react";

type ViewMode = "mes" | "semana" | "lista";
type Scope = "geral" | "ministerio";

const WEEKDAY_SHORT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

function useWideDesktop() {
  return useMediaQuery("(min-width: 1280px)");
}

/** Abaixo do breakpoint `md` do Tailwind, o mesmo corte de useIsMobile. */
function useCompactLayout() {
  return useMediaQuery("(max-width: 767px)");
}

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
  ministry: { id: string; name: string } | undefined,
  ministryName: string,
  memberNames: string,
): boolean {
  if (!scheduleBelongsToMinistryFilter(ministry, filters.ministryId)) return false;
  if (filters.memberId !== "all" && !schedule.memberIds.includes(filters.memberId)) return false;
  if (filters.shift !== "all" && schedule.shift !== filters.shift) return false;
  if (filters.date && schedule.date !== filters.date) return false;
  const q = filters.search.trim().toLowerCase();
  if (q && !ministryName.includes(q) && !memberNames.includes(q)) return false;
  return true;
}

function MinistryGroup({ ministry, onOpen }: { ministry: DayBoardMinistry; onOpen: (scheduleId: string) => void }) {
  const Icon = getMinistryIcon(ministry.name);
  return (
    <div
      className="rounded-lg border border-border/60 bg-card p-2.5"
      style={{ borderLeftWidth: 3, borderLeftColor: `hsl(${ministry.color})` }}
    >
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: `hsl(${ministry.color})` }}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {ministry.name}
      </p>
      <div className="space-y-2">
        {ministry.roles.map(role => (
          <button
            key={role.scheduleId}
            type="button"
            onClick={() => onOpen(role.scheduleId)}
            className="block w-full rounded-md text-left hover:bg-cream/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petroleum"
          >
            {role.functionName && <p className="text-[11px] font-semibold text-foreground">{role.functionName}</p>}
            <div className="flex flex-wrap gap-1">
              {role.people.length === 0 ? (
                <span className="text-xs italic text-muted-foreground">Nenhum membro vinculado</span>
              ) : role.people.map(person => (
                <span
                  key={person.id}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    person.conflicted ? "bg-destructive/15 text-destructive" : "bg-muted/60 text-foreground",
                  )}
                >
                  {person.name}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ScheduleView() {
  const { schedules, ministries, members, loading } = useStore();
  const wideDesktop = useWideDesktop();
  const compactLayout = useCompactLayout();

  const [scope, setScope] = useState<Scope>("geral");
  const [viewMode, setViewMode] = useState<ViewMode>("mes");
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
  const visualMinistries = useMemo(
    () => listVisualMinistries(orderedMinistries, getMinistryOrder),
    [orderedMinistries],
  );

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthLabel = monthLabelOf(cursor);
  const todayStr = new Date().toISOString().split("T")[0];

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
    const ministry = ministryById.get(s.ministryId);
    const visual = ministry ? getVisualMinistry(ministry) : null;
    const ministryName = [ministry?.name, visual?.visualName, visual?.functionName].filter(Boolean).join(" ").toLowerCase();
    const memberNames = s.memberIds.map(id => memberById.get(id)?.name || "").join(" ").toLowerCase();
    return matchesScheduleFilters(s, filters, ministry, ministryName, memberNames);
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
  const moveWeek = (delta: number) => setCursor(current => shiftWeek(current, delta));
  const weekLabel = weekDates.length === 7
    ? `${formatDate(weekDates[0]).slice(0, 5)} – ${formatDate(weekDates[6]).slice(0, 5)}`
    : monthLabel;

  const weekBoards = useMemo(() => {
    const dates = new Set(weekDates);
    const boards = buildDayBoards({
      schedules: weekFiltered,
      conflictSchedules: schedules.filter(schedule => dates.has(schedule.date)),
      ministries,
      members,
    });
    return new Map(boards.map(board => [board.date, board]));
  }, [weekDates, weekFiltered, schedules, ministries, members]);

  // ----- Ministry summary (Por Ministério) -----
  const selectedVisual = filterMinistry !== "all" ? visualMinistries.find(item => item.id === filterMinistry) : undefined;

  const ministrySummary = useMemo(() => {
    if (!selectedVisual) return null;
    const list = monthSchedules.filter(s => scheduleBelongsToMinistryFilter(ministryById.get(s.ministryId), selectedVisual.id));
    const people = new Set(list.flatMap(s => s.memberIds));
    const events = new Set(list.map(s => s.date));
    const next = list.filter(s => s.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date))[0];
    return {
      total: list.length,
      people: people.size,
      events: events.size,
      next: next ? `${formatDate(next.date)} — ${SHIFT_TIMES[next.shift]}` : "—",
    };
  }, [selectedVisual, monthSchedules, ministryById, todayStr]);

  // ----- Export -----
  const exportData = { schedules, members, ministries };
  const viewingWeek = viewMode === "semana";
  const exportSchedules = viewingWeek ? weekFiltered : filtered;
  const exportLabel = viewingWeek ? weekLabel : monthLabel;
  const exportTitle = scope === "ministerio" && selectedVisual ? selectedVisual.name : undefined;

  const monthCellBoards = useMemo(() => {
    const dates = new Set(monthSchedules.map(schedule => schedule.date));
    const boards = buildDayBoards({
      schedules: filtered,
      conflictSchedules: schedules.filter(schedule => dates.has(schedule.date)),
      ministries,
      members,
    });
    return new Map(boards.map(board => [board.date, board]));
  }, [monthSchedules, filtered, schedules, ministries, members]);

  const selectedDayBoard = selectedDate ? monthCellBoards.get(selectedDate) ?? null : null;

  const agendaDays = useMemo(() => {
    const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
    const todayInMonth = todayStr.startsWith(monthKey) ? todayStr : null;
    return buildMobileAgenda([...monthCellBoards.values()], { today: todayInMonth });
  }, [monthCellBoards, todayStr, year, month]);

  const listDays = useMemo(() => Array.from(monthCellBoards.keys()).sort(), [monthCellBoards]);
  const selectedDayHeading = selectedDate ? formatDayHeading(selectedDate) : null;

  const ShiftBadge = ({ shift }: { shift: Shift }) => (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
      shift === "Manhã" ? "bg-amber-500/15 text-amber-600" : "bg-indigo-500/15 text-indigo-500"
    )}>
      {shift === "Manhã" ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
      {shift} · {SHIFT_TIMES[shift]}
    </span>
  );

  const openSchedule = (scheduleId: string) => {
    const found = schedules.find(item => item.id === scheduleId);
    if (found) setSelectedSchedule(found);
  };

  if (loading) {
    return <div className="py-16 text-center text-muted-foreground">Carregando escalas…</div>;
  }

  return (
    <div className="page-stack animate-fade-in">
      <header className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:justify-between">
        <div>
          <p className="eyebrow text-petroleum">Igreja Nova Aliança</p>
          <h1 className="page-title">Visualização de Escalas</h1>
          <p className="page-subtitle">
            {viewMode === "semana" ? weekLabel : monthLabel}
            {" · "}
            {scope === "geral" ? "Todos os Ministérios" : selectedVisual?.name || "Por Ministério"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-11 gap-1.5 px-3 md:h-9" aria-label="Exportar PDF" onClick={() => exportMonthToPDF(exportData, exportLabel, exportSchedules, exportTitle)}>
            <FileDown className="h-4 w-4" /> <span className="hidden md:inline">Exportar PDF</span>
          </Button>
          <Button variant="outline" size="sm" className="h-11 gap-1.5 px-3 md:h-9" aria-label="Compartilhar" onClick={() => shareMonthViaWhatsApp(exportData, exportLabel, exportSchedules, exportTitle)}>
            <Share2 className="h-4 w-4" /> <span className="hidden md:inline">Compartilhar</span>
          </Button>
        </div>
      </header>

      {/* Ministry header (Por Ministério) */}
      {scope === "ministerio" && selectedVisual && (
        <div className="content-card card-pad space-y-4">
          <div className="flex items-center gap-3">
            <span
              className="flex h-11 w-11 items-center justify-center rounded-xl"
              style={{ backgroundColor: `hsl(${MINISTRY_COLORS[selectedVisual.colorIndex % MINISTRY_COLORS.length]} / 0.15)`, color: `hsl(${MINISTRY_COLORS[selectedVisual.colorIndex % MINISTRY_COLORS.length]})` }}
            >
              {(() => { const Icon = getMinistryIcon(selectedVisual.iconName); return <Icon className="h-5 w-5" />; })()}
            </span>
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight">{selectedVisual.name}</h2>
              <p className="text-sm text-muted-foreground">{monthLabel}</p>
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

      <div className="content-card flex flex-col gap-3 p-3 sm:p-4 md:flex-row md:flex-wrap md:items-center">
        <div className="flex w-full items-center gap-2 md:w-auto">
          <Button variant="outline" size="icon" className="h-11 w-11 shrink-0 md:h-9 md:w-9" onClick={() => (viewMode === "semana" ? moveWeek(-1) : moveMonth(-1))} aria-label="Anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-11 shrink-0 px-3 md:h-9" onClick={goToday}>Hoje</Button>
          <Button variant="outline" size="icon" className="h-11 w-11 shrink-0 md:h-9 md:w-9" onClick={() => (viewMode === "semana" ? moveWeek(1) : moveMonth(1))} aria-label="Próximo">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Select
            value={`${year}-${month}`}
            onValueChange={v => {
              const [y, m] = v.split("-").map(Number);
              setCursor(new Date(y, m, 1));
            }}
          >
            <SelectTrigger className="h-11 w-auto min-w-0 flex-1 font-semibold md:h-9 md:min-w-[140px] md:flex-none">
              <SelectValue>{viewMode === "semana" ? weekLabel : monthLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 25 }, (_, i) => {
                const d = new Date(year, month - 12 + i, 1);
                return (
                  <SelectItem key={i} value={`${d.getFullYear()}-${d.getMonth()}`}>
                    {monthLabelOf(d)}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="grid w-full grid-cols-2 rounded-full border border-border/70 bg-cream/60 p-1 md:inline-flex md:w-auto">
          {(["geral", "ministerio"] as Scope[]).map(sc => (
            <button
              key={sc}
              onClick={() => {
                setScope(sc);
                if (sc === "ministerio" && filterMinistry === "all" && visualMinistries.length > 0) {
                  setFilterMinistry(visualMinistries[0].id);
                }
                if (sc === "geral") setFilterMinistry("all");
              }}
              className={cn(
                "min-h-11 rounded-full px-3 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petroleum md:min-h-0 md:px-4",
                scope === sc ? "bg-terracotta text-cream shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {sc === "geral" ? "Todos os Ministérios" : "Por Ministério"}
            </button>
          ))}
        </div>

        <div className="grid w-full grid-cols-3 rounded-full border border-border/70 bg-muted/50 p-1 md:ml-auto md:flex md:w-auto">
          {([
            { id: "mes", label: "Mês", icon: LayoutGrid },
            { id: "semana", label: "Semana", icon: CalendarRange },
            { id: "lista", label: "Lista", icon: List },
          ] as { id: ViewMode; label: string; icon: typeof List }[]).map(v => (
            <button
              key={v.id}
              onClick={() => setViewMode(v.id)}
              className={cn(
                "flex min-h-11 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petroleum md:min-h-0 md:py-1.5",
                viewMode === v.id ? "bg-ink text-cream shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <v.icon className="h-3.5 w-3.5" />
              {v.label}
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
            <button type="button" onClick={() => setSearch("")} aria-label="Limpar busca" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petroleum">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="relative h-11 gap-2 px-3 sm:px-4" aria-label="Filtros">
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
                    {visualMinistries.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
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
          {visualMinistries.map(m => {
            const active = filterMinistry === m.id;
            const Icon = getMinistryIcon(m.name);
            return (
              <button
                key={m.id}
                onClick={() => setFilterMinistry(m.id)}
                className={cn(
                  "flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petroleum",
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
        <>
        <div className="md:hidden">
          <MobileScheduleAgenda
            days={agendaDays}
            showPeople={scope === "ministerio"}
            selectedDate={selectedDate}
            onSelectDay={setSelectedDate}
          />
        </div>
        <div className={cn("hidden md:block", wideDesktop && "xl:grid xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start xl:gap-5")}>
        <div className="content-card p-2 sm:p-4">
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {WEEKDAY_SHORT.map(d => (
              <div key={d} className="py-1.5 text-center text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {d}
              </div>
            ))}
            {monthCells.map((dateStr, i) => {
              if (!dateStr) return <div key={i} className="h-[52px] rounded-lg bg-muted/20 sm:h-[188px]" />;
              const daySchedules = schedulesByDate.get(dateStr) || [];
              return (
                <MonthDayCell
                  key={dateStr}
                  dayNumber={Number(dateStr.split("-")[2])}
                  isToday={dateStr === todayStr}
                  selected={selectedDate === dateStr}
                  board={monthCellBoards.get(dateStr) ?? null}
                  showPeople={scope === "ministerio"}
                  scheduleCount={daySchedules.length}
                  onSelect={() => setSelectedDate(dateStr)}
                />
              );
            })}
          </div>
        </div>
        {wideDesktop && (
          <aside className="sticky top-24 hidden max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-xl border border-border/70 bg-card p-5 shadow-elegant xl:block">
            {selectedDate && selectedDayHeading ? (
              <DayPanel
                date={selectedDate}
                board={selectedDayBoard}
                reserveCloseSpace={false}
                onSelectSchedule={scheduleId => {
                  const found = schedules.find(item => item.id === scheduleId);
                  if (found) setSelectedSchedule(found);
                }}
              />
            ) : (
              <div className="space-y-2 py-6">
                <p className="eyebrow text-petroleum">Dia</p>
                <p className="font-display text-2xl font-bold tracking-tight">Selecione um dia</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  A escala do dia aparece aqui, com turnos, ministérios e pessoas.
                </p>
              </div>
            )}
          </aside>
        )}
        </div>
        </>
      )}

      {/* ============ WEEK VIEW ============ */}
      {viewMode === "semana" && (
        <div className="section-stack">
          {weekDates.map(dateStr => {
            const board = weekBoards.get(dateStr);
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
                {!board || board.shifts.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Sem escalas</p>
                ) : (
                  <div className="space-y-3">
                    {board.shifts.map(shift => (
                      <div key={shift.shift}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <ShiftBadge shift={shift.shift} />
                          <span className="text-xs text-muted-foreground">{eventLabel(dateStr, shift.shift)}</span>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {shift.ministries.map(ministry => (
                            <MinistryGroup key={ministry.key} ministry={ministry} onOpen={openSchedule} />
                          ))}
                        </div>
                      </div>
                    ))}
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
          {listDays.length === 0 && (
            <div className="content-card card-pad text-center text-muted-foreground">
              Nenhuma escala encontrada neste período.
            </div>
          )}
          {listDays.map(date => {
            const board = monthCellBoards.get(date);
            if (!board) return null;
            const d = new Date(date + "T12:00:00");
            const isToday = date === todayStr;
            return (
              <div key={date} className="content-card card-pad">
                <div className="flex items-center gap-3 mb-3">
                  <span className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold",
                    isToday ? "bg-primary text-primary-foreground" : "bg-muted/60 text-foreground"
                  )}>
                    {String(d.getDate()).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{getDayOfWeek(date)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(date)}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {board.shifts.map(shift => (
                    <div key={shift.shift}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <ShiftBadge shift={shift.shift} />
                        <span className="text-xs text-muted-foreground">{eventLabel(date, shift.shift)}</span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {shift.ministries.map(ministry => (
                          <MinistryGroup key={ministry.key} ministry={ministry} onOpen={openSchedule} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============ DAY DETAIL DIALOG ============ */}
      <Sheet open={!!selectedDate && compactLayout} onOpenChange={open => !open && setSelectedDate(null)}>
        <SheetContent side="bottom" className="flex h-[92dvh] w-full max-w-none flex-col gap-0 overflow-y-auto rounded-t-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {selectedDate && selectedDayHeading && (
            <>
              <SheetTitle className="sr-only">
                {selectedDayHeading.weekday}, {selectedDayHeading.label}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Turnos, ministérios e pessoas escaladas neste dia.
              </SheetDescription>
              <DayPanel
                date={selectedDate}
                board={selectedDayBoard}
                onSelectSchedule={scheduleId => {
                  const found = schedules.find(item => item.id === scheduleId);
                  if (found) setSelectedSchedule(found);
                }}
              />
              <Button variant="outline" className="mt-6 h-11 w-full" onClick={() => setSelectedDate(null)}>
                Fechar
              </Button>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={!!selectedDate && !wideDesktop && !compactLayout} onOpenChange={open => !open && setSelectedDate(null)}>
        <DialogContent className="max-h-[85vh] w-[calc(100%-1.5rem)] overflow-y-auto sm:max-w-xl">
          {selectedDate && selectedDayHeading && (
            <>
              <DialogTitle className="sr-only">
                {selectedDayHeading.weekday}, {selectedDayHeading.label}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Turnos, ministérios e pessoas escaladas neste dia.
              </DialogDescription>
              <DayPanel
                date={selectedDate}
                board={selectedDayBoard}
                onSelectSchedule={scheduleId => {
                  const found = schedules.find(item => item.id === scheduleId);
                  if (found) setSelectedSchedule(found);
                }}
              />
            </>
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
                  {ministry && (() => {
                    const visual = getVisualMinistry(ministry);
                    const colorIndex = visual.grouped
                      ? (visualMinistries.find(item => item.id === visual.visualId)?.colorIndex ?? ministry.colorIndex)
                      : ministry.colorIndex;
                    const label = visual.functionName ? `${visual.visualName} · ${visual.functionName}` : visual.visualName;
                    return <span className="ministry-badge border" style={getMinistryStyle(colorIndex)}>{label}</span>;
                  })()}
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

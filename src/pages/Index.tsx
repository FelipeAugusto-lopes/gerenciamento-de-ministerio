import { useState, useMemo } from "react";
import { useStore } from "@/store/StoreContext";
import { useAudit } from "@/store/AuditContext";
import { getMinistryStyle, formatDate, getDayOfWeek } from "@/lib/helpers";
import { MINISTRY_COLORS, type Shift, type ScheduleStatus } from "@/types";
import { Plus, ChevronLeft, ChevronRight, Wand2, Calendar, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

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

const statusIcons: Record<ScheduleStatus, string> = {
  Pendente: "⏳",
  Confirmado: "✅",
  Recusado: "❌",
  Concluído: "✔️",
};

export default function IndexPage() {
  const { schedules, ministries, members, addSchedule, deleteSchedule, updateSchedule } = useStore();
  const { addEntry } = useAudit();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const [newForm, setNewForm] = useState({
    ministryId: "",
    shift: "Manhã" as Shift,
    memberId: "",
  });

  const calendarDays = useMemo(() => getCalendarDays(year, month), [year, month]);

  // Schedules grouped by date for the current month
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
    return schedules.filter(s => s.date === selectedDate).sort((a, b) => a.shift.localeCompare(b.shift));
  }, [selectedDate, schedules]);

  const availableMembers = useMemo(() => {
    if (!newForm.ministryId) return members;
    return members.filter(m => m.ministryIds.includes(newForm.ministryId));
  }, [newForm.ministryId, members]);

  // Check conflicts
  const getMemberConflict = (memberId: string, date: string) => {
    if (!memberId || !date) return null;
    const existing = schedules.filter(s => s.memberId === memberId && s.date === date);
    if (existing.length === 0) return null;
    return existing.map(s => {
      const min = ministries.find(m => m.id === s.ministryId);
      return min?.name || "?";
    }).join(", ");
  };

  const currentConflict = newForm.memberId && selectedDate ? getMemberConflict(newForm.memberId, selectedDate) : null;

  const handleAdd = () => {
    if (!newForm.ministryId || !newForm.memberId || !selectedDate) return;
    addSchedule({ ministryId: newForm.ministryId, date: selectedDate, shift: newForm.shift, memberId: newForm.memberId, status: "Pendente" });
    const ministry = ministries.find(m => m.id === newForm.ministryId);
    const member = members.find(m => m.id === newForm.memberId);
    addEntry("Adicionou escala", `${member?.name} em ${ministry?.name} — ${formatDate(selectedDate)} (${newForm.shift})`);
    setNewForm({ ministryId: "", shift: "Manhã", memberId: "" });
    setShowAddDialog(false);
  };

  const handleDelete = (id: string) => {
    const s = schedules.find(x => x.id === id);
    if (s) {
      const ministry = ministries.find(m => m.id === s.ministryId);
      const member = members.find(m => m.id === s.memberId);
      addEntry("Removeu escala", `${member?.name} de ${ministry?.name} — ${formatDate(s.date)}`);
    }
    deleteSchedule(id);
  };

  const handleStatusChange = (s: typeof schedules[0], newStatus: ScheduleStatus) => {
    updateSchedule({ ...s, status: newStatus });
    const ministry = ministries.find(m => m.id === s.ministryId);
    const member = members.find(m => m.id === s.memberId);
    addEntry("Alterou status", `${member?.name} (${ministry?.name}) → ${newStatus}`);
  };

  const todayStr = today.toISOString().split("T")[0];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Calendário de Escalas</h1>
        <p className="text-sm text-muted-foreground">Selecione uma data para ver ou criar escalas</p>
      </div>

      {/* Calendar */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <Button variant="ghost" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="font-display text-lg font-bold text-foreground">
            {MONTH_NAMES[month]} {year}
          </h2>
          <Button variant="ghost" size="icon" onClick={nextMonth}>
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
            const uniqueMinistries = [...new Set(daySchedules.map(s => s.ministryId))];

            return (
              <button
                key={ds}
                onClick={() => setSelectedDate(ds)}
                className={cn(
                  "relative min-h-[70px] sm:min-h-[90px] border-b border-r last:border-r-0 p-1 sm:p-2 text-left transition-colors hover:bg-muted/50",
                  isSelected && "bg-primary/10 ring-2 ring-primary ring-inset",
                  isToday && !isSelected && "bg-accent/10"
                )}
              >
                <span className={cn(
                  "text-xs sm:text-sm font-medium",
                  isToday && "bg-primary text-primary-foreground rounded-full w-6 h-6 sm:w-7 sm:h-7 inline-flex items-center justify-center",
                  !isToday && "text-foreground"
                )}>
                  {day}
                </span>
                {daySchedules.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {uniqueMinistries.slice(0, 3).map(mid => {
                      const min = ministries.find(m => m.id === mid);
                      if (!min) return null;
                      const color = MINISTRY_COLORS[min.colorIndex % MINISTRY_COLORS.length];
                      return (
                        <div key={mid} className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: `hsl(${color})` }} />
                          <span className="text-[9px] sm:text-[10px] text-muted-foreground truncate">{min.name}</span>
                        </div>
                      );
                    })}
                    {uniqueMinistries.length > 3 && (
                      <span className="text-[9px] text-muted-foreground">+{uniqueMinistries.length - 3}</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected date detail */}
      {selectedDate && (
        <div className="rounded-lg border bg-card p-5 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-bold text-foreground">
                {formatDate(selectedDate)} — {getDayOfWeek(selectedDate)}
              </h3>
              <p className="text-sm text-muted-foreground">{selectedSchedules.length} escala{selectedSchedules.length !== 1 ? "s" : ""}</p>
            </div>
            <Button onClick={() => setShowAddDialog(true)} className="gap-2 h-12 px-5 text-base">
              <Plus className="h-5 w-5" /> Nova Escala
            </Button>
          </div>

          {selectedSchedules.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-muted-foreground">
              <Calendar className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">Nenhuma escala nesta data.</p>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {selectedSchedules.map(s => {
                const ministry = ministries.find(m => m.id === s.ministryId);
                const member = members.find(m => m.id === s.memberId);
                return (
                  <div
                    key={s.id}
                    className="rounded-lg border bg-card p-3 space-y-2"
                    style={{ borderLeftWidth: 4, borderLeftColor: ministry ? `hsl(${MINISTRY_COLORS[ministry.colorIndex % MINISTRY_COLORS.length]})` : undefined }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="ministry-badge border text-xs" style={ministry ? getMinistryStyle(ministry.colorIndex) : {}}>{ministry?.name || "?"}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">{s.shift}</span>
                        <button onClick={() => handleDelete(s.id)} className="rounded p-1 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-foreground">{member?.name || "?"}</p>
                    <Select value={s.status} onValueChange={v => handleStatusChange(s, v as ScheduleStatus)}>
                      <SelectTrigger className="w-fit h-7 text-xs">
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
          )}
        </div>
      )}

      {/* Add schedule dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Nova Escala — {selectedDate ? formatDate(selectedDate) : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Ministério</label>
              <Select value={newForm.ministryId} onValueChange={v => setNewForm(f => ({ ...f, ministryId: v, memberId: "" }))}>
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
              <label className="text-sm font-medium text-foreground mb-1.5 block">Pessoa</label>
              <Select value={newForm.memberId} onValueChange={v => setNewForm(f => ({ ...f, memberId: v }))}>
                <SelectTrigger className={cn("h-12 text-base", currentConflict && "border-destructive")}><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {availableMembers.map(m => {
                    const conflict = selectedDate ? getMemberConflict(m.id, selectedDate) : null;
                    return (
                      <SelectItem key={m.id} value={m.id}>
                        <span className="flex items-center gap-2">
                          {m.name}
                          {conflict && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-destructive">
                              <AlertTriangle className="h-3 w-3" /> {conflict}
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            {currentConflict && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Já escalado(a) em: {currentConflict}</span>
              </div>
            )}
            <Button className="w-full h-12 text-base" onClick={handleAdd}>Adicionar Escala</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

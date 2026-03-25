import { useState, useMemo } from "react";
import { useStore } from "@/store/StoreContext";
import { useAudit } from "@/store/AuditContext";
import { getMinistryStyle, formatDate, getDayOfWeek } from "@/lib/helpers";
import { MINISTRY_COLORS, type Shift, type ScheduleStatus } from "@/types";
import { Plus, ChevronLeft, ChevronRight, Calendar, Trash2, AlertTriangle, X, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    selectedMemberIds: [] as string[],
  });

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
      return a.ministryId.localeCompare(b.ministryId);
    });
  }, [selectedDate, schedules]);

  const availableMembers = useMemo(() => {
    if (!newForm.ministryId) return members;
    return members.filter(m => m.ministryIds.includes(newForm.ministryId));
  }, [newForm.ministryId, members]);

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
  };

  const todayStr = today.toISOString().split("T")[0];

  // Group selected schedules by shift for the table view
  const groupedByShift = useMemo(() => {
    const shifts = ["Manhã", "Noite"] as Shift[];
    return shifts.map(shift => ({
      shift,
      schedules: selectedSchedules.filter(s => s.shift === shift),
    })).filter(g => g.schedules.length > 0);
  }, [selectedSchedules]);

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

      {/* Selected date detail — table view matching reference */}
      {selectedDate && (
        <div className="rounded-lg border bg-card overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/30">
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
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Ministério</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Turno</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Pessoas</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-2.5 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedByShift.map(group => (
                      group.schedules.map((s, idx) => {
                        const ministry = ministries.find(m => m.id === s.ministryId);
                        const memberNames = s.memberIds.map(mid => members.find(m => m.id === mid)?.name || "?");
                        return (
                          <tr key={s.id} className={cn(
                            "border-b last:border-0 transition-colors hover:bg-muted/30",
                            s.status === "Recusado" && "opacity-60",
                            idx === 0 && group.schedules.length > 1 && "border-t-2 border-t-muted"
                          )}>
                            <td className="px-4 py-2.5">
                              <span className="ministry-badge border text-xs" style={ministry ? getMinistryStyle(ministry.colorIndex) : {}}>{ministry?.name || "?"}</span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={cn(
                                "text-xs font-medium px-2 py-1 rounded",
                                s.shift === "Manhã" ? "bg-amber-500/15 text-amber-700" : "bg-indigo-500/15 text-indigo-700"
                              )}>
                                {s.shift}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex flex-wrap gap-1.5">
                                {memberNames.map((name, i) => (
                                  <span key={i} className="text-sm font-medium text-foreground">{name}{i < memberNames.length - 1 ? "," : ""}</span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
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
                            </td>
                            <td className="px-4 py-2.5">
                              <button onClick={() => handleDelete(s.id)} className="rounded p-1 text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="grid gap-2 p-4 md:hidden">
                {selectedSchedules.map(s => {
                  const ministry = ministries.find(m => m.id === s.ministryId);
                  const memberNames = s.memberIds.map(mid => members.find(m => m.id === mid)?.name || "?");
                  return (
                    <div
                      key={s.id}
                      className="rounded-lg border bg-card p-3 space-y-2"
                      style={{ borderLeftWidth: 4, borderLeftColor: ministry ? `hsl(${MINISTRY_COLORS[ministry.colorIndex % MINISTRY_COLORS.length]})` : undefined }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="ministry-badge border text-xs" style={ministry ? getMinistryStyle(ministry.colorIndex) : {}}>{ministry?.name || "?"}</span>
                        <div className="flex items-center gap-1">
                          <span className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded",
                            s.shift === "Manhã" ? "bg-amber-500/15 text-amber-700" : "bg-indigo-500/15 text-indigo-700"
                          )}>
                            {s.shift}
                          </span>
                          <button onClick={() => handleDelete(s.id)} className="rounded p-1 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm font-medium text-foreground">{memberNames.join(", ")}</p>
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
            </>
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
                    return (
                      <button
                        key={m.id}
                        onClick={() => toggleMember(m.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50",
                          isSelected && "bg-primary/5"
                        )}
                      >
                        <span className={cn(
                          "h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                          isSelected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30"
                        )}>
                          {isSelected && <span className="text-xs">✓</span>}
                        </span>
                        <span className={cn("font-medium", isSelected ? "text-primary" : "text-foreground")}>{m.name}</span>
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
    </div>
  );
}

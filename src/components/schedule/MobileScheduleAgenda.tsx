import { AlertTriangle, Moon, Sun } from "lucide-react";
import { getMinistryIcon } from "@/lib/ministryIcons";
import {
  agendaMinistryPreview,
  agendaPeoplePreview,
  formatAgendaDate,
  type AgendaDay,
} from "@/lib/mobileAgenda";
import type { CalendarCellShift } from "@/lib/calendarCell";
import { cn } from "@/lib/utils";

interface MobileScheduleAgendaProps {
  days: AgendaDay[];
  showPeople: boolean;
  selectedDate?: string | null;
  onSelectDay: (date: string) => void;
}

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Agenda vertical do período. Só apresenta os dias já resumidos;
 * o toque abre o painel, que continua dono do detalhe.
 */
export function MobileScheduleAgenda({ days, showPeople, selectedDate, onSelectDay }: MobileScheduleAgendaProps) {
  const scheduled = days.filter(day => day.shifts.length > 0);
  const todayWithoutSchedule = days.find(day => day.isToday && day.shifts.length === 0);

  return (
    <div className="space-y-3">
      {todayWithoutSchedule && (
        <DayCard day={todayWithoutSchedule} showPeople={showPeople} selected={false} />
      )}
      {scheduled.length === 0 ? (
        <div className="content-card card-pad space-y-1 text-center">
          <p className="font-display text-lg font-bold tracking-tight text-foreground">Nenhuma escala neste período.</p>
          <p className="text-sm leading-6 text-muted-foreground">Troque o mês ou o ministério para consultar outro recorte.</p>
        </div>
      ) : (
        scheduled.map(day => (
          <DayCard
            key={day.date}
            day={day}
            showPeople={showPeople}
            selected={selectedDate === day.date}
            onSelect={() => onSelectDay(day.date)}
          />
        ))
      )}
    </div>
  );
}

function DayCard({
  day,
  showPeople,
  selected,
  onSelect,
}: {
  day: AgendaDay;
  showPeople: boolean;
  selected: boolean;
  onSelect?: () => void;
}) {
  const heading = formatAgendaDate(day.date);
  const className = cn(
    "w-full rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petroleum focus-visible:ring-offset-2",
    day.isToday ? "border-terracotta bg-beige/40" : "border-border/70 bg-card",
    selected && "ring-2 ring-terracotta",
    onSelect && "cursor-pointer hover:bg-cream/50",
  );
  const body = (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-petroleum">
          {heading.weekday}
          <span className="mx-1.5 text-muted-foreground">·</span>
          {heading.day} {heading.month}
        </p>
        {day.isToday && (
          <span className="rounded-full bg-terracotta px-2.5 py-1 text-xs font-semibold text-cream">Hoje</span>
        )}
      </div>
      {day.shifts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma escala hoje.</p>
      ) : (
        day.shifts.map(shift => <ShiftSummary key={shift.shift} shift={shift} showPeople={showPeople} />)
      )}
      {day.conflictCount > 0 && (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          {countLabel(day.conflictCount, "conflito", "conflitos")}
        </p>
      )}
    </div>
  );

  if (!onSelect) return <div className={className}>{body}</div>;

  return (
    <button type="button" className={className} aria-pressed={selected} onClick={onSelect}>
      {body}
    </button>
  );
}

function ShiftSummary({ shift, showPeople }: { shift: CalendarCellShift; showPeople: boolean }) {
  const Icon = shift.shift === "Manhã" ? Sun : Moon;
  const ministries = agendaMinistryPreview(shift.ministries);
  const people = agendaPeoplePreview(shift.people);
  const showPeopleCount = !showPeople && shift.ministryCount <= 3 && shift.peopleCount > 0;

  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className={cn("h-4 w-4", shift.shift === "Manhã" ? "text-amber-600" : "text-indigo-500")} aria-hidden />
        {shift.shift} · {shift.time}
      </p>
      {showPeople ? (
        <ul className="space-y-1 pl-6">
          {people.visible.map(person => (
            <li key={person.key} className={cn("break-words text-base leading-6", person.conflicted ? "font-semibold text-destructive" : "text-foreground")}>
              {person.name}
              {person.conflicted && <span className="sr-only"> em conflito</span>}
            </li>
          ))}
          {people.hidden > 0 && (
            <li className="text-sm font-medium text-muted-foreground">e mais {people.hidden}</li>
          )}
        </ul>
      ) : (
        <>
          <p className="pl-6 text-sm text-muted-foreground">
            {countLabel(shift.ministryCount, "ministério", "ministérios")}
            {showPeopleCount && <span> · {countLabel(shift.peopleCount, "pessoa", "pessoas")}</span>}
          </p>
          {ministries.visible.length > 0 && (
            <ul className="space-y-1 pl-6">
              {ministries.visible.map(ministry => {
                const MinistryIcon = getMinistryIcon(ministry.name);
                return (
                  <li key={ministry.key} className="flex items-center gap-2 text-sm font-medium" style={{ color: `hsl(${ministry.color})` }}>
                    <MinistryIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="break-words">{ministry.name}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

import { AlertTriangle, Moon, Sun } from "lucide-react";
import { FittedRows } from "@/components/schedule/FittedRows";
import { calendarCellFromBoard, type CalendarCellMinistry, type CalendarCellPerson, type CalendarCellShift } from "@/lib/calendarCell";
import type { DayBoard } from "@/lib/scheduleInsights";
import { getMinistryIcon } from "@/lib/ministryIcons";
import { cn } from "@/lib/utils";

interface MonthDayCellProps {
  dayNumber: number;
  isToday: boolean;
  selected: boolean;
  board: DayBoard | null;
  showPeople: boolean;
  scheduleCount: number;
  onSelect: () => void;
}

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function MonthDayCell({ dayNumber, isToday, selected, board, showPeople, scheduleCount, onSelect }: MonthDayCellProps) {
  const cell = calendarCellFromBoard(board);
  const hasSchedules = cell.shifts.length > 0;
  const hasConflict = cell.conflictCount > 0;

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => hasSchedules && onSelect()}
      className={cn(
        "flex h-[52px] flex-col rounded-lg border p-0.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petroleum focus-visible:ring-offset-2 sm:h-[188px] sm:p-1.5",
        hasSchedules ? "cursor-pointer border-border/70 bg-card hover:border-beige hover:bg-cream/50" : "border-transparent",
        isToday && "ring-2 ring-petroleum/80",
        hasConflict && "border-destructive/70",
        selected && "border-terracotta bg-beige/40 shadow-sm",
      )}
    >
      <span className="mb-0.5 flex shrink-0 items-center justify-between gap-1 sm:mb-1">
        <span
          className={cn(
            "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold sm:text-sm",
            selected && "bg-terracotta text-cream",
            isToday && !selected && "bg-petroleum text-cream",
            !selected && !isToday && "text-foreground",
          )}
        >
          {dayNumber}
        </span>
        {hasConflict && (
          <span className="inline-flex items-center gap-0.5 text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="text-[10px] font-bold leading-none">{cell.conflictCount}</span>
            <span className="sr-only">{cell.conflictCount === 1 ? "conflito" : "conflitos"}</span>
          </span>
        )}
      </span>

      {hasSchedules && (
        <div className="hidden min-h-0 flex-1 flex-col gap-1 sm:flex">
          {cell.shifts.map(shift => (
            <ShiftBlock key={shift.shift} shift={shift} showPeople={showPeople} />
          ))}
        </div>
      )}

      {hasSchedules && (
        <span className="text-[10px] font-medium leading-3 text-muted-foreground sm:hidden">
          <span className="block">{scheduleCount}</span>
          <span className="block">{scheduleCount === 1 ? "escala" : "escalas"}</span>
        </span>
      )}
    </button>
  );
}

function ShiftBlock({ shift, showPeople }: { shift: CalendarCellShift; showPeople: boolean }) {
  const Icon = shift.shift === "Manhã" ? Sun : Moon;
  const summary = countLabel(shift.ministryCount, "ministério", "ministérios");
  const peopleSummary = shift.ministryCount <= 3 && shift.peopleCount > 0
    ? ` · ${countLabel(shift.peopleCount, "pessoa", "pessoas")}`
    : "";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="flex shrink-0 items-center gap-1 text-xs font-semibold leading-4 text-foreground">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", shift.shift === "Manhã" ? "text-amber-600" : "text-indigo-500")} aria-hidden />
        {showPeople ? (
          <>
            <span className="sr-only">{shift.shift}</span>
            {shift.time}
          </>
        ) : (
          <span>
            {shift.shift}
            <span className="font-medium text-muted-foreground"> · {summary}{peopleSummary}</span>
          </span>
        )}
      </p>
      {showPeople ? (
        <FittedRows
          items={shift.people}
          getKey={person => person.key}
          remainder={hidden => `e mais ${hidden}`}
          renderItem={(person: CalendarCellPerson) => (
            <span className={cn(person.conflicted && "font-semibold text-destructive")}>{person.name}</span>
          )}
        />
      ) : (
        <FittedRows
          items={shift.ministries}
          getKey={ministry => ministry.key}
          remainder={hidden => `+${countLabel(hidden, "ministério", "ministérios")}`}
          renderItem={(ministry: CalendarCellMinistry) => {
            const MinistryIcon = getMinistryIcon(ministry.name);
            return (
              <span className="flex items-start gap-1">
                <MinistryIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: `hsl(${ministry.color})` }} aria-hidden />
                <span style={{ color: `hsl(${ministry.color})` }}>{ministry.name}</span>
              </span>
            );
          }}
        />
      )}
    </div>
  );
}

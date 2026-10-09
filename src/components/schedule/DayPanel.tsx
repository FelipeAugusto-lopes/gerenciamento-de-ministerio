import { AlertTriangle, Moon, Sun } from "lucide-react";
import { getMinistryIcon } from "@/lib/ministryIcons";
import type { DayBoard, DayBoardShift } from "@/lib/scheduleInsights";
import { cn } from "@/lib/utils";

/** Cabeçalho legível do dia. A data vem da escala; o texto é só apresentação. */
export function formatDayHeading(date: string): { weekday: string; label: string } {
  const parsed = new Date(`${date}T12:00:00`);
  const weekday = parsed.toLocaleDateString("pt-BR", { weekday: "long" });
  return {
    weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
    label: parsed.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }),
  };
}

interface DayPanelProps {
  date: string;
  board: DayBoard | null;
  onSelectSchedule?: (scheduleId: string) => void;
  /** Espaço para o botão de fechar quando o painel está dentro de um diálogo. */
  reserveCloseSpace?: boolean;
}

/**
 * Leitura de um dia já montado por buildDayBoards.
 * Não agrupa escalas e não decide conflito.
 */
export function DayPanel({ date, board, onSelectSchedule, reserveCloseSpace = true }: DayPanelProps) {
  const heading = formatDayHeading(date);
  const shifts = board?.shifts ?? [];

  return (
    <div className="space-y-6">
      <header className={reserveCloseSpace ? "pr-8" : undefined}>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-terracotta">{heading.weekday}</p>
        <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">{heading.label}</h2>
      </header>

      {shifts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma escala neste dia.</p>
      ) : (
        shifts.map(shift => (
          <ShiftSection key={shift.shift} shift={shift} onSelectSchedule={onSelectSchedule} />
        ))
      )}

      {board && board.conflicts.length > 0 && (
        <section className="space-y-3 rounded-xl border border-destructive/35 bg-destructive/5 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            {board.conflicts.length === 1 ? "Conflito" : "Conflitos"}
          </h3>
          <div className="space-y-4">
            {board.conflicts.map(conflict => (
              <div key={conflict.memberId} className="space-y-1 border-t border-destructive/15 pt-3 first:border-t-0 first:pt-0">
                <p className="text-base font-semibold text-foreground">{conflict.name}</p>
                <ul className="space-y-0.5">
                  {conflict.assignments.map(place => (
                    <li key={place.scheduleId} className="break-words text-sm leading-6 text-foreground">
                      {place.functionName ? `${place.ministryName} · ${place.functionName}` : place.ministryName}
                      {" · "}
                      {place.shift}
                      {" · "}
                      {place.time}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ShiftSection({
  shift,
  onSelectSchedule,
}: {
  shift: DayBoardShift;
  onSelectSchedule?: (scheduleId: string) => void;
}) {
  const Icon = shift.shift === "Manhã" ? Sun : Moon;

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 border-b border-beige pb-2 text-sm font-semibold uppercase tracking-wide text-foreground">
        <Icon className={cn("h-4 w-4", shift.shift === "Manhã" ? "text-amber-600" : "text-indigo-500")} aria-hidden />
        {shift.shift} · {shift.time}
      </h3>
      <div className="space-y-3">
        {shift.ministries.map(ministry => {
          const MinistryIcon = getMinistryIcon(ministry.name);
          return (
            <div
              key={ministry.key}
              className="space-y-3 rounded-xl border border-border/70 bg-card p-3.5"
              style={{ borderLeftWidth: 3, borderLeftColor: `hsl(${ministry.color})` }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `hsl(${ministry.color} / 0.15)`, color: `hsl(${ministry.color})` }}
                >
                  <MinistryIcon className="h-4 w-4" aria-hidden />
                </span>
                <span className="break-words text-base font-semibold uppercase leading-snug tracking-wide" style={{ color: `hsl(${ministry.color})` }}>
                  {ministry.name}
                </span>
              </div>
              <div className="space-y-3">
                {ministry.roles.map(role => {
                  const RoleIcon = getMinistryIcon(role.originalName);
                  const body = (
                    <>
                      {role.functionName && (
                        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <RoleIcon className="h-3.5 w-3.5 shrink-0" style={{ color: `hsl(${role.color})` }} aria-hidden />
                          {role.functionName}
                        </p>
                      )}
                      {role.people.length === 0 ? (
                        <p className="text-sm italic text-muted-foreground">Nenhum membro vinculado</p>
                      ) : (
                        <ul className="space-y-1">
                          {role.people.map(person => (
                            <li
                              key={person.id}
                              className={cn(
                                "break-words text-base leading-6",
                                person.conflicted ? "font-semibold text-destructive" : "text-foreground",
                              )}
                            >
                              {person.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  );
                  if (!onSelectSchedule) {
                    return <div key={role.scheduleId} className="space-y-1">{body}</div>;
                  }
                  return (
                    <button
                      key={role.scheduleId}
                      type="button"
                      onClick={() => onSelectSchedule(role.scheduleId)}
                      className="w-full space-y-1 rounded-lg text-left transition-colors hover:bg-cream/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petroleum"
                    >
                      {body}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

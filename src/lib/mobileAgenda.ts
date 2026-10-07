import { calendarCellFromBoard, limitWithRemainder, type CalendarCellShift } from "@/lib/calendarCell";
import type { DayBoard } from "@/lib/scheduleInsights";

/** Até este número, a agenda geral lista os ministérios. Acima disso, mostra só a quantidade. */
export const AGENDA_MINISTRY_NAME_LIMIT = 6;

/** Até este número, Por Ministério lista todo mundo. Acima disso, o restante aparece como "e mais N". */
export const AGENDA_PEOPLE_NAME_LIMIT = 12;

const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

export interface AgendaDay {
  date: string;
  isToday: boolean;
  conflictCount: number;
  shifts: CalendarCellShift[];
  /** O mesmo quadro do dia. O painel lê este objeto, sem um segundo cálculo. */
  board: DayBoard | null;
}

export function formatAgendaDate(date: string): { weekday: string; day: string; month: string } {
  const parsed = new Date(`${date}T12:00:00`);
  return {
    weekday: WEEKDAYS[parsed.getDay()] ?? "",
    day: String(parsed.getDate()).padStart(2, "0"),
    month: MONTHS[parsed.getMonth()] ?? "",
  };
}

/**
 * Dias da agenda mobile a partir dos quadros já montados.
 * Não reagrupa escalas e não recalcula conflito.
 * Dias sem escala ficam de fora, exceto o hoje quando o período o inclui.
 */
export function buildMobileAgenda(
  boards: readonly DayBoard[],
  options: { today?: string | null } = {},
): AgendaDay[] {
  const today = options.today ?? null;
  const byDate = new Map<string, AgendaDay>();

  for (const board of boards) {
    const cell = calendarCellFromBoard(board);
    if (cell.shifts.length === 0) continue;
    byDate.set(board.date, {
      date: board.date,
      isToday: board.date === today,
      conflictCount: cell.conflictCount,
      shifts: cell.shifts,
      board,
    });
  }

  if (today && !byDate.has(today)) {
    byDate.set(today, {
      date: today,
      isToday: true,
      conflictCount: 0,
      shifts: [],
      board: null,
    });
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Resumo geral: lista os nomes enquanto couberem; senão entrega só a contagem, sem corte silencioso. */
export function agendaMinistryPreview<T>(items: readonly T[], limit = AGENDA_MINISTRY_NAME_LIMIT): { visible: T[]; hidden: number } {
  if (items.length <= limit) return { visible: [...items], hidden: 0 };
  return { visible: [], hidden: items.length };
}

/** Por Ministério: mostra todos os nomes, ou um aviso explícito quando a lista passa do limite. */
export function agendaPeoplePreview<T>(items: readonly T[], limit = AGENDA_PEOPLE_NAME_LIMIT): { visible: T[]; hidden: number } {
  if (items.length <= limit) return { visible: [...items], hidden: 0 };
  return limitWithRemainder(items, limit);
}

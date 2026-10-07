import type { DayBoard } from "@/lib/scheduleInsights";

export interface CalendarCellPerson {
  key: string;
  id: string;
  name: string;
  conflicted: boolean;
}

export interface CalendarCellMinistry {
  key: string;
  id: string;
  name: string;
  color: string;
  iconKey: string;
}

export interface CalendarCellShift {
  shift: DayBoard["shifts"][number]["shift"];
  time: string;
  ministryCount: number;
  peopleCount: number;
  ministries: CalendarCellMinistry[];
  people: CalendarCellPerson[];
}

export interface CalendarCellView {
  shifts: CalendarCellShift[];
  conflictCount: number;
}

/**
 * Lê um dia já montado. Não agrupa de novo e não recalcula conflito.
 * A lista de pessoas permanece completa para o painel; o corte visual fica fora daqui.
 */
export function calendarCellFromBoard(board: DayBoard | null | undefined): CalendarCellView {
  if (!board) return { shifts: [], conflictCount: 0 };

  return {
    conflictCount: board.conflicts.length,
    shifts: board.shifts.map(shift => {
      const people = shift.ministries.flatMap(ministry =>
        ministry.people.map(person => ({
          key: `${ministry.scheduleId}:${person.id}`,
          id: person.id,
          name: person.name,
          conflicted: person.conflicted,
        })),
      );
      return {
        shift: shift.shift,
        time: shift.time,
        ministryCount: shift.ministries.length,
        peopleCount: new Set(people.map(person => person.id)).size,
        ministries: shift.ministries.map(ministry => ({
          key: ministry.scheduleId,
          id: ministry.id,
          name: ministry.name,
          color: ministry.color,
          iconKey: ministry.iconKey,
        })),
        people,
      };
    }),
  };
}

/**
 * Quantos itens cabem na altura disponível.
 * Quando nem todos cabem, reserva uma linha para o aviso "e mais N".
 * Altura zero significa que a área está oculta: devolve o total, sem corte.
 */
export function visibleCountForSpace(total: number, availablePx: number, linePx: number, remainderPx: number): number {
  if (total <= 0) return 0;
  if (availablePx <= 0 || linePx <= 0) return total;
  const maxLines = Math.floor(availablePx / linePx);
  if (total <= maxLines) return total;
  const reserve = Math.max(remainderPx, linePx);
  return Math.max(0, Math.floor((availablePx - reserve) / linePx));
}

/** Corta só a exibição. Não altera a lista original. */
export function limitWithRemainder<T>(items: readonly T[], visibleCount: number): { visible: T[]; hidden: number } {
  if (visibleCount >= items.length) return { visible: [...items], hidden: 0 };
  const count = Math.max(0, visibleCount);
  return { visible: items.slice(0, count), hidden: items.length - count };
}

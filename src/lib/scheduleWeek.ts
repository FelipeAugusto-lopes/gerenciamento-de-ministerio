/** Data local no formato YYYY-MM-DD, sem converter para UTC. */
export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Semana de domingo a sábado que contém a data âncora.
 * O cálculo é feito no calendário local, então a semana pode começar num mês e terminar no seguinte.
 */
export function getWeekDates(anchor: Date): string[] {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return toISODate(day);
  });
}

/** Desloca a âncora em semanas inteiras, preservando o dia real. */
export function shiftWeek(anchor: Date, deltaWeeks: number): Date {
  return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + deltaWeeks * 7);
}

import { describe, expect, it } from "vitest";
import { getWeekDates, shiftWeek } from "./scheduleWeek";

describe("navegação semanal", () => {
  it("mostra os sete dias quando a semana cruza setembro e outubro", () => {
    const anchor = new Date(2024, 8, 29);
    expect(getWeekDates(anchor)).toEqual([
      "2024-09-29",
      "2024-09-30",
      "2024-10-01",
      "2024-10-02",
      "2024-10-03",
      "2024-10-04",
      "2024-10-05",
    ]);
  });

  it("mantém a mesma semana para qualquer dia dentro dela", () => {
    const fromSunday = getWeekDates(new Date(2024, 8, 29));
    const fromWednesday = getWeekDates(new Date(2024, 9, 2));
    expect(fromWednesday).toEqual(fromSunday);
  });

  it("avança e volta uma semana sem permanecer preso em hoje", () => {
    const today = new Date(2026, 9, 6);
    const current = getWeekDates(today);
    const previous = getWeekDates(shiftWeek(today, -1));
    const next = getWeekDates(shiftWeek(today, 1));

    expect(previous).not.toEqual(current);
    expect(next).not.toEqual(current);
    expect(getWeekDates(shiftWeek(shiftWeek(today, 1), -1))).toEqual(current);
  });

  it("não limita o dia em 28 ao cruzar o fim do mês", () => {
    const next = shiftWeek(new Date(2024, 8, 29), 1);
    expect(getWeekDates(next)[0]).toBe("2024-10-06");
    expect(next.getDate()).toBe(6);
    expect(next.getMonth()).toBe(9);
  });
});

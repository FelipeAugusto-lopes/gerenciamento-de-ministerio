import { describe, expect, it } from "vitest";
import { formatDayHeading } from "./DayPanel";

describe("cabeçalho do painel do dia", () => {
  it("escreve o dia da semana e a data por extenso", () => {
    expect(formatDayHeading("2026-10-07")).toEqual({
      weekday: "Quarta-feira",
      label: "7 de outubro de 2026",
    });
  });
});
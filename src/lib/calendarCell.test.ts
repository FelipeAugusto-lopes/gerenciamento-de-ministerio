import { describe, expect, it } from "vitest";
import type { Schedule } from "@/types";
import { buildDayBoards } from "./scheduleInsights";
import { calendarCellFromBoard, limitWithRemainder, visibleCountForSpace } from "./calendarCell";

function schedule(partial: Pick<Schedule, "id" | "date" | "ministryId" | "shift" | "memberIds"> & Partial<Schedule>): Schedule {
  return { status: "Pendente", ...partial };
}

const ministries = [
  { id: "audio", name: "Áudio", colorIndex: 2 },
  { id: "fotos", name: "Mídia Fotos", colorIndex: 3 },
  { id: "projecao", name: "Projeção", colorIndex: 4 },
  { id: "transmissao", name: "Transmissão", colorIndex: 5 },
  { id: "kids", name: "Ina Kids 3-6", colorIndex: 6 },
];

const members = [
  { id: "miguel", name: "Miguel" },
  { id: "felipe", name: "Felipe" },
  { id: "elaine", name: "Elaine" },
  { id: "joao", name: "João" },
  { id: "ana", name: "Ana" },
  { id: "bia", name: "Beatriz" },
];

function cellOf(schedules: Schedule[], conflictSchedules = schedules) {
  const board = buildDayBoards({ schedules, conflictSchedules, ministries, members })[0] ?? null;
  return { board, cell: calendarCellFromBoard(board) };
}

describe("resumo da célula do calendário", () => {
  it("representa um dia sem escala como célula vazia", () => {
    expect(calendarCellFromBoard(null)).toEqual({ shifts: [], conflictCount: 0 });
    expect(cellOf([]).board).toBeNull();
  });

  it("mostra somente a manhã quando a noite não tem escala", () => {
    const { cell } = cellOf([
      schedule({ id: "1", date: "2026-10-31", ministryId: "projecao", shift: "Manhã", memberIds: ["miguel"] }),
    ]);
    expect(cell.shifts.map(shift => [shift.shift, shift.time])).toEqual([["Manhã", "10:00"]]);
  });

  it("mostra somente a noite quando a manhã não tem escala", () => {
    const { cell } = cellOf([
      schedule({ id: "1", date: "2026-10-23", ministryId: "fotos", shift: "Noite", memberIds: ["elaine"] }),
    ]);
    expect(cell.shifts.map(shift => [shift.shift, shift.time])).toEqual([["Noite", "18:00"]]);
  });

  it("mantém manhã e noite na ordem do sistema", () => {
    const { cell } = cellOf([
      schedule({ id: "1", date: "2026-10-31", ministryId: "fotos", shift: "Noite", memberIds: ["elaine"] }),
      schedule({ id: "2", date: "2026-10-31", ministryId: "projecao", shift: "Manhã", memberIds: ["miguel"] }),
    ]);
    expect(cell.shifts.map(shift => shift.shift)).toEqual(["Manhã", "Noite"]);
    expect(cell.shifts.map(shift => shift.time)).toEqual(["10:00", "18:00"]);
  });

  it("lista os ministérios do dia sem inventar outro agrupamento", () => {
    const { cell } = cellOf([
      schedule({ id: "1", date: "2026-10-11", ministryId: "projecao", shift: "Manhã", memberIds: ["miguel"] }),
      schedule({ id: "2", date: "2026-10-11", ministryId: "audio", shift: "Manhã", memberIds: ["felipe"] }),
      schedule({ id: "3", date: "2026-10-11", ministryId: "kids", shift: "Manhã", memberIds: ["ana"] }),
    ]);
    expect(cell.shifts[0].ministryCount).toBe(3);
    expect(cell.shifts[0].ministries.map(ministry => ministry.name)).toEqual(["Áudio", "Mídia", "Ina Kids 3-6"]);
  });

  it("guarda todos os membros de um ministério", () => {
    const { cell } = cellOf([
      schedule({ id: "1", date: "2026-10-11", ministryId: "kids", shift: "Manhã", memberIds: ["ana", "bia", "joao", "elaine"] }),
    ]);
    expect(cell.shifts[0].people.map(person => person.name)).toEqual(["Ana", "Beatriz", "João", "Elaine"]);
    expect(cell.shifts[0].peopleCount).toBe(4);
  });

  it("não encurta os nomes que estão no modelo", () => {
    const { board, cell } = cellOf([
      schedule({ id: "1", date: "2026-10-11", ministryId: "audio", shift: "Manhã", memberIds: ["felipe"] }),
    ]);
    expect(cell.shifts[0].people[0].name).toBe(board?.shifts[0].ministries[0].people[0].name);
    expect(cell.shifts[0].people[0].name).toBe("Felipe");
  });

  it("reserva o aviso quando nem todos os nomes cabem", () => {
    const names = ["Ana", "Beatriz", "João", "Elaine", "Miguel", "Felipe"];
    expect(visibleCountForSpace(names.length, 200, 16, 16)).toBe(names.length);
    const crowded = visibleCountForSpace(names.length, 48, 16, 16);
    const fitted = limitWithRemainder(names, crowded);
    expect(fitted.hidden).toBeGreaterThan(0);
    expect(fitted.visible.length + fitted.hidden).toBe(names.length);
    expect(names).toHaveLength(6);
  });

  it("no calendário mostra só a contagem e guarda os lugares para o painel", () => {
    const all = [
      schedule({ id: "1", date: "2026-10-11", ministryId: "projecao", shift: "Manhã", memberIds: ["miguel"] }),
      schedule({ id: "2", date: "2026-10-11", ministryId: "audio", shift: "Noite", memberIds: ["miguel"] }),
      schedule({ id: "3", date: "2026-10-11", ministryId: "transmissao", shift: "Noite", memberIds: ["miguel"] }),
    ];
    const visible = all.filter(item => item.ministryId === "projecao");
    const board = buildDayBoards({ schedules: visible, conflictSchedules: all, ministries, members })[0];
    const cell = calendarCellFromBoard(board);
    expect(cell.conflictCount).toBe(1);
    expect(cell.shifts.flatMap(shift => shift.ministries.map(ministry => ministry.name))).toEqual(["Mídia"]);
    expect(board.conflicts[0].assignments.map(place => place.functionName
      ? `${place.ministryName} · ${place.functionName} · ${place.shift} · ${place.time}`
      : `${place.ministryName} · ${place.shift} · ${place.time}`)).toEqual([
      "Mídia · Projeção · Manhã · 10:00",
      "Áudio · Noite · 18:00",
      "Mídia · Transmissão · Noite · 18:00",
    ]);
  });

  it("indica conflito pela contagem do modelo", () => {
    const schedules = [
      schedule({ id: "1", date: "2026-10-11", ministryId: "projecao", shift: "Manhã", memberIds: ["miguel"] }),
      schedule({ id: "2", date: "2026-10-11", ministryId: "audio", shift: "Noite", memberIds: ["miguel"] }),
      schedule({ id: "3", date: "2026-10-11", ministryId: "fotos", shift: "Noite", memberIds: ["elaine"] }),
    ];
    const { cell } = cellOf(schedules);
    expect(cell.conflictCount).toBe(1);
    expect(cell.shifts.flatMap(shift => shift.people).find(person => person.id === "miguel")?.conflicted).toBe(true);
    expect(cell.shifts.flatMap(shift => shift.people).find(person => person.id === "elaine")?.conflicted).toBe(false);
  });

  it("mantém o dia completo para o painel quando a célula esconde nomes", () => {
    const { board } = cellOf([
      schedule({ id: "1", date: "2026-10-11", ministryId: "kids", shift: "Manhã", memberIds: ["ana", "bia", "joao", "elaine"] }),
    ]);
    const everyone = board?.shifts[0].ministries[0].people.map(person => person.name) ?? [];
    const fitted = limitWithRemainder(everyone, 1);
    expect(fitted).toEqual({ visible: ["Ana"], hidden: 3 });
    expect(everyone).toEqual(["Ana", "Beatriz", "João", "Elaine"]);
  });
});

import { describe, expect, it } from "vitest";
import type { Schedule } from "@/types";
import { buildDayBoards } from "./scheduleInsights";
import {
  AGENDA_MINISTRY_NAME_LIMIT,
  AGENDA_PEOPLE_NAME_LIMIT,
  agendaMinistryPreview,
  agendaPeoplePreview,
  buildMobileAgenda,
  formatAgendaDate,
} from "./mobileAgenda";

function schedule(partial: Pick<Schedule, "id" | "date" | "ministryId" | "shift" | "memberIds"> & Partial<Schedule>): Schedule {
  return { status: "Pendente", ...partial };
}

const ministries = [
  { id: "audio", name: "Áudio", colorIndex: 2 },
  { id: "fotos", name: "Mídia Fotos", colorIndex: 3 },
  { id: "story", name: "Mídia Story", colorIndex: 1 },
  { id: "projecao", name: "Projeção", colorIndex: 4 },
  { id: "transmissao", name: "Transmissão", colorIndex: 5 },
  { id: "kids", name: "Ina Kids 7-11", colorIndex: 8 },
  { id: "bercario", name: "Berçário", colorIndex: 6 },
  { id: "voluntariado", name: "Voluntariado", colorIndex: 0 },
  { id: "louvor", name: "Louvor", colorIndex: 7 },
];

const members = [
  { id: "miguel", name: "Miguel" },
  { id: "felipe", name: "Felipe" },
  { id: "elaine", name: "Elaine" },
  { id: "joao", name: "João" },
  { id: "ana", name: "Ana" },
  { id: "bia", name: "Beatriz" },
  { id: "luiz", name: "Luiz" },
  { id: "sidneia", name: "Sidnéia" },
  { id: "malu", name: "Malu" },
  { id: "cristiane", name: "Cristiane" },
  { id: "juliana", name: "Juliana" },
];

function boardsOf(schedules: Schedule[], conflictSchedules = schedules) {
  return buildDayBoards({ schedules, conflictSchedules, ministries, members });
}

describe("agenda mobile", () => {
  it("não perde dias que têm escala", () => {
    const boards = boardsOf([
      schedule({ id: "1", date: "2026-10-31", ministryId: "projecao", shift: "Manhã", memberIds: ["miguel"] }),
      schedule({ id: "2", date: "2026-10-04", ministryId: "audio", shift: "Noite", memberIds: ["felipe"] }),
      schedule({ id: "3", date: "2026-10-11", ministryId: "kids", shift: "Manhã", memberIds: ["ana"] }),
    ]);
    const days = buildMobileAgenda(boards, { today: "2026-10-07" });
    expect(days.map(day => day.date)).toEqual(["2026-10-04", "2026-10-07", "2026-10-11", "2026-10-31"]);
  });

  it("não inclui dias vazios além do hoje", () => {
    const boards = boardsOf([
      schedule({ id: "1", date: "2026-10-11", ministryId: "audio", shift: "Noite", memberIds: ["felipe"] }),
    ]);
    const days = buildMobileAgenda(boards, { today: "2026-10-07" });
    expect(days.map(day => day.date)).toEqual(["2026-10-07", "2026-10-11"]);
    expect(days[0].shifts).toEqual([]);
  });

  it("mostra somente a manhã", () => {
    const [day] = buildMobileAgenda(boardsOf([
      schedule({ id: "1", date: "2026-10-31", ministryId: "projecao", shift: "Manhã", memberIds: ["miguel"] }),
    ]), { today: null });
    expect(day.shifts.map(shift => [shift.shift, shift.time])).toEqual([["Manhã", "10:00"]]);
  });

  it("mostra somente a noite", () => {
    const [day] = buildMobileAgenda(boardsOf([
      schedule({ id: "1", date: "2026-10-23", ministryId: "fotos", shift: "Noite", memberIds: ["elaine"] }),
    ]), { today: null });
    expect(day.shifts.map(shift => [shift.shift, shift.time])).toEqual([["Noite", "18:00"]]);
  });

  it("mantém manhã e noite na ordem do quadro", () => {
    const [day] = buildMobileAgenda(boardsOf([
      schedule({ id: "1", date: "2026-10-31", ministryId: "fotos", shift: "Noite", memberIds: ["elaine"] }),
      schedule({ id: "2", date: "2026-10-31", ministryId: "projecao", shift: "Manhã", memberIds: ["miguel"] }),
    ]), { today: null });
    expect(day.shifts.map(shift => shift.shift)).toEqual(["Manhã", "Noite"]);
    expect(day.shifts.map(shift => shift.time)).toEqual(["10:00", "18:00"]);
  });

  it("guarda todos os ministérios do dia no resumo", () => {
    const [day] = buildMobileAgenda(boardsOf([
      schedule({ id: "1", date: "2026-10-11", ministryId: "projecao", shift: "Manhã", memberIds: ["miguel"] }),
      schedule({ id: "2", date: "2026-10-11", ministryId: "audio", shift: "Manhã", memberIds: ["felipe"] }),
      schedule({ id: "3", date: "2026-10-11", ministryId: "kids", shift: "Manhã", memberIds: ["ana"] }),
      schedule({ id: "4", date: "2026-10-11", ministryId: "fotos", shift: "Manhã", memberIds: ["elaine"] }),
      schedule({ id: "5", date: "2026-10-11", ministryId: "story", shift: "Manhã", memberIds: ["bia"] }),
      schedule({ id: "6", date: "2026-10-11", ministryId: "transmissao", shift: "Manhã", memberIds: ["joao"] }),
      schedule({ id: "7", date: "2026-10-11", ministryId: "bercario", shift: "Manhã", memberIds: ["malu"] }),
    ]), { today: null });
    const names = day.shifts[0].ministries.map(ministry => ministry.name);
    expect(names).toEqual(["Áudio", "Mídia", "Berçário", "Ina Kids 7-11"]);
    expect(day.board?.shifts[0].ministries.find(ministry => ministry.name === "Mídia")?.roles.map(role => role.functionName)).toEqual([
      "Fotos", "Story", "Projeção", "Transmissão",
    ]);
    const crowded = ["Áudio", "Mídia", "Berçário", "Louvor", "Voluntariado", "INA Kids", "Recepção"];
    const preview = agendaMinistryPreview(crowded);
    expect(preview.visible).toEqual([]);
    expect(preview.hidden).toBe(7);
    expect(crowded.length).toBeGreaterThan(AGENDA_MINISTRY_NAME_LIMIT);
  });

  it("leva todos os membros quando o recorte é de um ministério", () => {
    const people = ["luiz", "sidneia", "malu", "cristiane", "juliana"];
    const [day] = buildMobileAgenda(boardsOf([
      schedule({ id: "1", date: "2026-10-25", ministryId: "kids", shift: "Noite", memberIds: people }),
    ]), { today: null });
    expect(day.shifts[0].people.map(person => person.name)).toEqual(["Luiz", "Sidnéia", "Malu", "Cristiane", "Juliana"]);
    expect(agendaPeoplePreview(day.shifts[0].people).hidden).toBe(0);
  });

  it("no cartão mostra a contagem e o painel conserva o ministério de fora do filtro", () => {
    const all = [
      schedule({ id: "1", date: "2026-10-11", ministryId: "projecao", shift: "Manhã", memberIds: ["miguel"] }),
      schedule({ id: "2", date: "2026-10-11", ministryId: "audio", shift: "Noite", memberIds: ["miguel"] }),
      schedule({ id: "3", date: "2026-10-25", ministryId: "kids", shift: "Noite", memberIds: ["luiz"] }),
      schedule({ id: "4", date: "2026-10-25", ministryId: "transmissao", shift: "Manhã", memberIds: ["luiz"] }),
    ];
    const visible = all.filter(item => item.ministryId === "projecao" || item.ministryId === "kids");
    const days = buildMobileAgenda(
      buildDayBoards({ schedules: visible, conflictSchedules: all, ministries, members }),
      { today: null },
    );
    const day11 = days.find(day => day.date === "2026-10-11");
    const day25 = days.find(day => day.date === "2026-10-25");
    expect(day11?.conflictCount).toBe(1);
    expect(day11?.shifts.flatMap(shift => shift.ministries.map(ministry => ministry.name))).toEqual(["Mídia"]);
    expect(day11?.board?.conflicts[0].assignments.map(place => place.functionName
      ? `${place.ministryName} · ${place.functionName} · ${place.shift} · ${place.time}`
      : `${place.ministryName} · ${place.shift} · ${place.time}`)).toEqual([
      "Mídia · Projeção · Manhã · 10:00",
      "Áudio · Noite · 18:00",
    ]);
    expect(day25?.board?.conflicts[0].assignments.map(place => place.functionName
      ? `${place.ministryName} · ${place.functionName} · ${place.shift} · ${place.time}`
      : `${place.ministryName} · ${place.shift} · ${place.time}`)).toEqual([
      "Mídia · Transmissão · Manhã · 10:00",
      "Ina Kids 7-11 · Noite · 18:00",
    ]);
  });

  it("indica conflito pela contagem do quadro, sem recalcular", () => {
    const source = [
      schedule({ id: "1", date: "2026-10-11", ministryId: "projecao", shift: "Manhã", memberIds: ["miguel"] }),
      schedule({ id: "2", date: "2026-10-11", ministryId: "audio", shift: "Noite", memberIds: ["miguel"] }),
      schedule({ id: "3", date: "2026-10-11", ministryId: "fotos", shift: "Noite", memberIds: ["elaine"] }),
    ];
    const boards = boardsOf(source);
    const [day] = buildMobileAgenda(boards, { today: null });
    expect(day.conflictCount).toBe(boards[0].conflicts.length);
    expect(day.shifts.flatMap(shift => shift.people).find(person => person.id === "miguel")?.conflicted).toBe(true);
    expect(day.shifts.flatMap(shift => shift.people).find(person => person.id === "elaine")?.conflicted).toBe(false);
  });

  it("trata um mês sem escala como agenda vazia", () => {
    expect(buildMobileAgenda([], { today: null })).toEqual([]);
    const [today] = buildMobileAgenda([], { today: "2026-11-02" });
    expect(today).toMatchObject({ date: "2026-11-02", isToday: true, shifts: [], board: null });
  });

  it("entrega o quadro completo para o painel do dia", () => {
    const boards = boardsOf([
      schedule({ id: "1", date: "2026-10-25", ministryId: "kids", shift: "Manhã", memberIds: ["ana", "bia", "joao"] }),
      schedule({ id: "2", date: "2026-10-25", ministryId: "kids", shift: "Noite", memberIds: ["luiz", "sidneia", "malu", "cristiane", "juliana"] }),
    ]);
    const [day] = buildMobileAgenda(boards, { today: null });
    expect(day.board).toBe(boards[0]);
    expect(day.board?.shifts[1].ministries[0].people.map(person => person.name)).toEqual([
      "Luiz", "Sidnéia", "Malu", "Cristiane", "Juliana",
    ]);
  });

  it("avisa o restante quando há gente demais para listar", () => {
    const names = Array.from({ length: AGENDA_PEOPLE_NAME_LIMIT + 3 }, (_, index) => `Pessoa ${index + 1}`);
    const preview = agendaPeoplePreview(names);
    expect(preview.hidden).toBe(3);
    expect(preview.visible.length + preview.hidden).toBe(names.length);
  });

  it("formata o cabeçalho curto do dia", () => {
    expect(formatAgendaDate("2026-10-07")).toEqual({ weekday: "QUA", day: "07", month: "OUT" });
  });
});

import { describe, expect, it } from "vitest";
import { getMinistryColor } from "@/lib/helpers";
import {
  buildDayBoards,
  groupByShift,
  groupSchedulesByDate,
  membersLongestWithoutServing,
  rankScheduleAssignments,
  sameDayConflicts,
} from "./scheduleInsights";
import type { Schedule } from "@/types";

function schedule(partial: Pick<Schedule, "id" | "date" | "ministryId" | "shift" | "memberIds"> & Partial<Schedule>): Schedule {
  return { status: "Pendente", ...partial };
}

const names = new Map([
  ["a", "Ana"],
  ["b", "Bruno"],
  ["c", "Carla"],
]);

describe("ranking de escalas", () => {
  const october = [
    schedule({ id: "1", date: "2026-10-04", ministryId: "audio", shift: "Manhã", memberIds: ["a", "b"] }),
    schedule({ id: "2", date: "2026-10-04", ministryId: "midia", shift: "Noite", memberIds: ["a"], status: "Confirmado" }),
    schedule({ id: "3", date: "2026-10-11", ministryId: "audio", shift: "Manhã", memberIds: ["b"] }),
  ];
  const september = [
    schedule({ id: "4", date: "2026-09-06", ministryId: "audio", shift: "Manhã", memberIds: ["c"] }),
    schedule({ id: "5", date: "2026-09-13", ministryId: "midia", shift: "Noite", memberIds: ["c"] }),
    schedule({ id: "6", date: "2026-09-20", ministryId: "audio", shift: "Manhã", memberIds: ["b"] }),
  ];

  it("ranqueia o mês atual contando qualquer status", () => {
    const rank = rankScheduleAssignments(october, names, 5);
    expect(rank.map(item => [item.memberId, item.count])).toEqual([
      ["a", 2],
      ["b", 2],
    ]);
    expect(rank[0].byMinistry[0]).toEqual({ ministryId: "audio", count: 1 });
  });

  it("ranqueia o mês anterior sem misturar o mês atual", () => {
    const rank = rankScheduleAssignments(september, names, 5);
    expect(rank.map(item => item.memberId)).toEqual(["c", "b"]);
    expect(rank[0].count).toBe(2);
    expect(rank[0].dates).toEqual(["2026-09-06", "2026-09-13"]);
  });

  it("limita o top 5 e separa a contagem por ministério", () => {
    const many = [
      ...october,
      schedule({ id: "7", date: "2026-10-18", ministryId: "projecao", shift: "Noite", memberIds: ["a"] }),
      schedule({ id: "8", date: "2026-10-18", ministryId: "audio", shift: "Manhã", memberIds: ["d"] }),
      schedule({ id: "9", date: "2026-10-25", ministryId: "audio", shift: "Manhã", memberIds: ["e"] }),
      schedule({ id: "10", date: "2026-10-25", ministryId: "audio", shift: "Noite", memberIds: ["f"] }),
      schedule({ id: "11", date: "2026-10-25", ministryId: "audio", shift: "Noite", memberIds: ["g"] }),
    ];
    const extended = new Map(names);
    extended.set("d", "Diana");
    extended.set("e", "Eva");
    extended.set("f", "Fábio");
    extended.set("g", "Gabi");
    const rank = rankScheduleAssignments(many, extended, 5);
    expect(rank).toHaveLength(5);
    expect(rank[0].memberId).toBe("a");
    expect(rank[0].count).toBe(3);
    expect(rank[0].byMinistry.map(item => item.ministryId)).toEqual(["audio", "midia", "projecao"]);
  });

  it("desempata pelo nome", () => {
    const rank = rankScheduleAssignments(october, names, 5);
    expect(rank[0].memberId).toBe("a");
    expect(rank[1].memberId).toBe("b");
  });
});

describe("pessoas há mais tempo sem servir", () => {
  const schedules = [
    schedule({ id: "1", date: "2026-08-01", ministryId: "audio", shift: "Manhã", memberIds: ["a"] }),
    schedule({ id: "2", date: "2026-10-01", ministryId: "midia", shift: "Noite", memberIds: ["b"] }),
    schedule({ id: "3", date: "2026-11-01", ministryId: "audio", shift: "Manhã", memberIds: ["a"] }),
  ];
  const members = [
    { id: "a", name: "Ana" },
    { id: "b", name: "Bruno" },
    { id: "c", name: "Carla" },
  ];

  it("coloca quem nunca serviu primeiro e ignora escala futura", () => {
    const idle = membersLongestWithoutServing(schedules, members, "2026-10-06", 5);
    expect(idle.map(item => item.memberId)).toEqual(["c", "a", "b"]);
    expect(idle[0].days).toBeNull();
    expect(idle[1].lastDate).toBe("2026-08-01");
    expect(idle[1].days).toBe(66);
    expect(idle[1].lastMinistryIds).toEqual(["audio"]);
  });
});

describe("conflito no mesmo dia", () => {
  it("marca a pessoa escalada em dois ministérios no mesmo dia", () => {
    const conflicts = sameDayConflicts([
      schedule({ id: "1", date: "2026-10-04", ministryId: "midia", shift: "Noite", memberIds: ["felipe"] }),
      schedule({ id: "2", date: "2026-10-04", ministryId: "audio", shift: "Noite", memberIds: ["felipe", "ana"] }),
      schedule({ id: "3", date: "2026-10-11", ministryId: "audio", shift: "Manhã", memberIds: ["felipe"] }),
    ]);
    expect(conflicts.get("2026-10-04")?.get("felipe")?.map(item => item.ministryId)).toEqual(["midia", "audio"]);
    expect(conflicts.get("2026-10-04")?.has("ana")).toBe(false);
    expect(conflicts.has("2026-10-11")).toBe(false);
  });
});

describe("agrupamento por dia", () => {
  it("junta as escalas da mesma data e separa dias diferentes", () => {
    const grouped = groupSchedulesByDate([
      schedule({ id: "1", date: "2026-10-04", ministryId: "audio", shift: "Manhã", memberIds: ["a"] }),
      schedule({ id: "2", date: "2026-10-04", ministryId: "midia", shift: "Noite", memberIds: ["b"] }),
      schedule({ id: "3", date: "2026-10-11", ministryId: "projecao", shift: "Manhã", memberIds: ["c"] }),
    ]);
    expect(grouped.get("2026-10-04")?.map(item => item.id)).toEqual(["1", "2"]);
    expect(grouped.get("2026-10-11")?.map(item => item.ministryId)).toEqual(["projecao"]);
  });
});

describe("agrupamento por turno", () => {
  it("separa manhã e noite e ordena pelo ministério", () => {
    const groups = groupByShift(
      [
        schedule({ id: "1", date: "2026-10-04", ministryId: "projecao", shift: "Noite", memberIds: ["a"] }),
        schedule({ id: "2", date: "2026-10-04", ministryId: "audio", shift: "Manhã", memberIds: ["b"] }),
        schedule({ id: "3", date: "2026-10-04", ministryId: "midia", shift: "Manhã", memberIds: ["c"] }),
      ],
      id => ({ audio: 1, midia: 2, projecao: 3 }[id] || 99),
    );
    expect(groups.map(group => group.shift)).toEqual(["Manhã", "Noite"]);
    expect(groups[0].items.map(item => item.ministryId)).toEqual(["audio", "midia"]);
    expect(groups[1].items.map(item => item.ministryId)).toEqual(["projecao"]);
  });
});

describe("modelo do dia", () => {
  const ministries = [
    { id: "audio", name: "Áudio", colorIndex: 2 },
    { id: "fotos", name: "Mídia Fotos", colorIndex: 3 },
    { id: "projecao", name: "Projeção", colorIndex: 4 },
    { id: "transmissao", name: "Transmissão", colorIndex: 5 },
    { id: "bercario", name: "Berçário", colorIndex: 6 },
  ];
  const members = [
    { id: "ana", name: "Ana" },
    { id: "maria", name: "Maria" },
    { id: "joao", name: "João" },
    { id: "elaine", name: "Elaine" },
    { id: "rita", name: "Rita" },
    { id: "pedro", name: "Pedro" },
    { id: "felipe", name: "Felipe" },
  ];
  const day = [
    schedule({ id: "proj-manha", date: "2026-10-04", ministryId: "projecao", shift: "Manhã", memberIds: ["pedro"] }),
    schedule({ id: "fotos-manha", date: "2026-10-04", ministryId: "fotos", shift: "Manhã", memberIds: ["rita"] }),
    schedule({ id: "audio-manha", date: "2026-10-04", ministryId: "audio", shift: "Manhã", memberIds: ["ana", "maria", "joao", "elaine"] }),
    schedule({ id: "fotos-noite", date: "2026-10-04", ministryId: "fotos", shift: "Noite", memberIds: ["felipe"] }),
    schedule({ id: "trans-noite", date: "2026-10-04", ministryId: "transmissao", shift: "Noite", memberIds: ["felipe"] }),
    schedule({ id: "audio-noite", date: "2026-10-04", ministryId: "audio", shift: "Noite", memberIds: ["maria"] }),
  ];

  const board = () => buildDayBoards({ schedules: day, ministries, members })[0];

  it("monta um dia com vários ministérios", () => {
    const morning = board().shifts.find(shift => shift.shift === "Manhã");
    expect(morning?.ministries.map(ministry => ministry.name)).toEqual(["Áudio", "Mídia"]);
    expect(morning?.ministries.find(ministry => ministry.id === "audio")).toMatchObject({
      color: getMinistryColor(2),
      iconKey: "headphones",
    });
    const media = morning?.ministries.find(ministry => ministry.name === "Mídia");
    expect(media?.iconKey).toBe("camera");
    expect(media?.roles.map(role => role.functionName)).toEqual(["Fotos", "Projeção"]);
    expect(media?.roles.find(role => role.functionName === "Fotos")?.iconKey).toBe("camera");
    expect(media?.roles.find(role => role.functionName === "Projeção")?.iconKey).toBe("monitor");
  });

  it("mantém todos os membros de um turno", () => {
    const audio = board().shifts[0].ministries.find(ministry => ministry.id === "audio");
    expect(audio?.people.map(person => person.name)).toEqual(["Ana", "Maria", "João", "Elaine"]);
  });

  it("separa manhã e noite com o horário de cada turno", () => {
    expect(board().shifts.map(shift => [shift.shift, shift.time])).toEqual([
      ["Manhã", "10:00"],
      ["Noite", "18:00"],
    ]);
  });

  it("omite o ministério que não tem escala no dia", () => {
    const ids = board().shifts.flatMap(shift => shift.ministries.map(ministry => ministry.id));
    expect(ids).not.toContain("bercario");
    expect(ministries.some(ministry => ministry.id === "bercario")).toBe(true);
  });

  it("não marca conflito em quem aparece uma vez", () => {
    const ana = board().shifts.flatMap(shift => shift.ministries.flatMap(ministry => ministry.people)).find(person => person.id === "ana");
    expect(ana?.conflicted).toBe(false);
    expect(board().conflicts.map(conflict => conflict.memberId)).not.toContain("ana");
  });

  it("mostra a pessoa escalada em dois ministérios no mesmo dia", () => {
    const felipe = board().conflicts.find(conflict => conflict.memberId === "felipe");
    expect(felipe?.assignments.map(place => ({
      ministryName: place.ministryName,
      functionName: place.functionName,
      ministryId: place.ministryId,
      shift: place.shift,
      time: place.time,
    }))).toEqual([
      { ministryName: "Mídia", functionName: "Fotos", ministryId: "fotos", shift: "Noite", time: "18:00" },
      { ministryName: "Mídia", functionName: "Transmissão", ministryId: "transmissao", shift: "Noite", time: "18:00" },
    ]);

    const onlyPhotos = buildDayBoards({
      schedules: day.filter(item => item.ministryId === "fotos"),
      conflictSchedules: day,
      ministries,
      members,
    })[0];
    expect(onlyPhotos.conflicts.map(conflict => conflict.memberId)).toEqual(["felipe"]);
    expect(onlyPhotos.conflicts[0].assignments.map(place => place.originalName)).toEqual(["Mídia Fotos", "Transmissão"]);
    expect(onlyPhotos.shifts.flatMap(shift => shift.ministries.flatMap(ministry => ministry.roles)).every(role => role.ministryId === "fotos")).toBe(true);
  });

  it("marca conflito entre turnos", () => {
    const maria = board().conflicts.find(conflict => conflict.memberId === "maria");
    expect(maria?.assignments.map(place => place.shift)).toEqual(["Manhã", "Noite"]);
    expect(maria?.assignments.map(place => place.time)).toEqual(["10:00", "18:00"]);
  });

  it("lista cada pessoa em conflito", () => {
    expect(board().conflicts.map(conflict => conflict.name)).toEqual(["Felipe", "Maria"]);
  });

  it("mostra todas as escalas quando a pessoa está em três no mesmo dia", () => {
    const withThird = [
      ...day,
      schedule({ id: "proj-noite", date: "2026-10-04", ministryId: "projecao", shift: "Noite", memberIds: ["maria"] }),
    ];
    const maria = buildDayBoards({ schedules: withThird, ministries, members })[0]
      .conflicts.find(conflict => conflict.memberId === "maria");
    expect(maria?.assignments).toHaveLength(3);
    expect(maria?.assignments.map(place => ({
      ministryName: place.ministryName,
      functionName: place.functionName,
      shift: place.shift,
      time: place.time,
    }))).toEqual([
      { ministryName: "Áudio", functionName: null, shift: "Manhã", time: "10:00" },
      { ministryName: "Áudio", functionName: null, shift: "Noite", time: "18:00" },
      { ministryName: "Mídia", functionName: "Projeção", shift: "Noite", time: "18:00" },
    ]);
  });

  it("ordena os ministérios pela ordem já usada no sistema", () => {
    const morning = board().shifts.find(shift => shift.shift === "Manhã");
    expect(morning?.ministries.map(ministry => ministry.id)).toEqual(["audio", "visual:midia"]);
    expect(morning?.ministries.find(ministry => ministry.id === "visual:midia")?.roles.map(role => role.ministryId)).toEqual(["fotos", "projecao"]);
    const night = board().shifts.find(shift => shift.shift === "Noite");
    expect(night?.ministries.map(ministry => ministry.id)).toEqual(["audio", "visual:midia"]);
    expect(night?.ministries.find(ministry => ministry.id === "visual:midia")?.roles.map(role => role.ministryId)).toEqual(["fotos", "transmissao"]);
  });

  it("inclui todos os membros escalados, sem corte", () => {
    const listed = board().shifts.flatMap(shift => shift.ministries.flatMap(ministry => ministry.roles.flatMap(role => role.people.map(person => `${role.scheduleId}:${person.id}`)))).sort();
    const expected = day.flatMap(item => item.memberIds.map(id => `${item.id}:${id}`)).sort();
    expect(listed).toEqual(expected);
  });
});

import { describe, expect, it } from "vitest";
import {
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

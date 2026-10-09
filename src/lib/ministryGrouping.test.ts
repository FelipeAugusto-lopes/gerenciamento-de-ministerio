import { describe, expect, it } from "vitest";
import type { Schedule } from "@/types";
import { getMinistryOrder } from "@/lib/helpers";
import { buildDayBoards } from "@/lib/scheduleInsights";
import {
  VISUAL_MEDIA_ID,
  getVisualMinistry,
  listVisualMinistries,
  scheduleBelongsToMinistryFilter,
} from "@/lib/ministryGrouping";

function schedule(partial: Pick<Schedule, "id" | "date" | "ministryId" | "shift" | "memberIds">): Schedule {
  return { status: "Pendente", ...partial };
}

const catalog = [
  { id: "audio", name: "Áudio", colorIndex: 2 },
  { id: "fotos", name: "Mídia Fotos", colorIndex: 3 },
  { id: "story", name: "Mídia Story", colorIndex: 1 },
  { id: "fotos-story", name: "Mídia Fotos e Story", colorIndex: 8 },
  { id: "reels", name: "Mídia Reels", colorIndex: 9 },
  { id: "projecao", name: "Projeção", colorIndex: 4 },
  { id: "transmissao", name: "Transmissão", colorIndex: 5 },
  { id: "kids", name: "INA Kids", colorIndex: 6 },
  { id: "louvor", name: "Louvor", colorIndex: 7 },
];

const members = [
  { id: "joao", name: "João" },
  { id: "maria", name: "Maria" },
  { id: "felipe", name: "Felipe" },
  { id: "ana", name: "Ana" },
];

describe("agrupamento visual da Mídia", () => {
  it.each([
    ["fotos", "Mídia Fotos", "Fotos"],
    ["story", "Mídia Story", "Story"],
    ["fotos-story", "Mídia Fotos e Story", "Fotos e Story"],
    ["reels", "Mídia Reels", "Reels"],
    ["projecao", "Projeção", "Projeção"],
    ["transmissao", "Transmissão", "Transmissão"],
  ])("%s vira Mídia / %s", (id, originalName, functionName) => {
    expect(getVisualMinistry({ id, name: originalName })).toEqual({
      ministryId: id,
      visualId: VISUAL_MEDIA_ID,
      visualName: "Mídia",
      functionName,
      originalName,
      grouped: true,
    });
  });

  it("mantém Áudio como Áudio", () => {
    expect(getVisualMinistry({ id: "audio", name: "Áudio" })).toMatchObject({
      visualId: "audio",
      visualName: "Áudio",
      functionName: null,
      originalName: "Áudio",
      grouped: false,
    });
  });

  it("mantém INA Kids como INA Kids", () => {
    expect(getVisualMinistry({ id: "kids", name: "INA Kids" })).toMatchObject({
      visualId: "kids",
      visualName: "INA Kids",
      functionName: null,
      grouped: false,
    });
  });

  it("reúne vários registros da Mídia em um único ministério visual e preserva função e id", () => {
    const day = [
      schedule({ id: "s-fotos", date: "2026-10-11", ministryId: "fotos", shift: "Manhã", memberIds: ["joao"] }),
      schedule({ id: "s-story", date: "2026-10-11", ministryId: "story", shift: "Manhã", memberIds: ["maria"] }),
      schedule({ id: "s-reels", date: "2026-10-11", ministryId: "reels", shift: "Manhã", memberIds: ["felipe"] }),
      schedule({ id: "s-proj", date: "2026-10-11", ministryId: "projecao", shift: "Manhã", memberIds: ["ana"] }),
      schedule({ id: "s-audio", date: "2026-10-11", ministryId: "audio", shift: "Manhã", memberIds: ["felipe"] }),
    ];
    const morning = buildDayBoards({ schedules: day, ministries: catalog, members })[0].shifts[0];
    expect(morning.ministries.map(ministry => ministry.name)).toEqual(["Áudio", "Mídia"]);
    const media = morning.ministries.find(ministry => ministry.name === "Mídia");
    expect(media?.roles.map(role => ({
      ministryId: role.ministryId,
      functionName: role.functionName,
      originalName: role.originalName,
      scheduleId: role.scheduleId,
      person: role.people[0]?.name,
    }))).toEqual([
      { ministryId: "fotos", functionName: "Fotos", originalName: "Mídia Fotos", scheduleId: "s-fotos", person: "João" },
      { ministryId: "story", functionName: "Story", originalName: "Mídia Story", scheduleId: "s-story", person: "Maria" },
      { ministryId: "reels", functionName: "Reels", originalName: "Mídia Reels", scheduleId: "s-reels", person: "Felipe" },
      { ministryId: "projecao", functionName: "Projeção", originalName: "Projeção", scheduleId: "s-proj", person: "Ana" },
    ]);
  });

  it("mantém conflito entre duas funções da Mídia, inclusive manhã e noite", () => {
    const day = [
      schedule({ id: "s-fotos", date: "2026-10-11", ministryId: "fotos", shift: "Manhã", memberIds: ["felipe"] }),
      schedule({ id: "s-reels", date: "2026-10-11", ministryId: "reels", shift: "Noite", memberIds: ["felipe"] }),
    ];
    const conflict = buildDayBoards({ schedules: day, ministries: catalog, members })[0].conflicts[0];
    expect(conflict.assignments).toHaveLength(2);
    expect(conflict.assignments.map(place => ({
      ministryId: place.ministryId,
      label: `${place.ministryName} · ${place.functionName} · ${place.shift} · ${place.time}`,
    }))).toEqual([
      { ministryId: "fotos", label: "Mídia · Fotos · Manhã · 10:00" },
      { ministryId: "reels", label: "Mídia · Reels · Noite · 18:00" },
    ]);
  });

  it("mantém conflito entre Mídia e outro ministério", () => {
    const day = [
      schedule({ id: "s-fotos", date: "2026-10-11", ministryId: "fotos", shift: "Manhã", memberIds: ["felipe"] }),
      schedule({ id: "s-audio", date: "2026-10-11", ministryId: "audio", shift: "Noite", memberIds: ["felipe"] }),
    ];
    const conflict = buildDayBoards({ schedules: day, ministries: catalog, members })[0].conflicts[0];
    expect(conflict.assignments.map(place => place.functionName
      ? `${place.ministryName} · ${place.functionName} · ${place.shift} · ${place.time}`
      : `${place.ministryName} · ${place.shift} · ${place.time}`)).toEqual([
      "Mídia · Fotos · Manhã · 10:00",
      "Áudio · Noite · 18:00",
    ]);
  });

  it("separa duas pessoas diferentes em conflito", () => {
    const day = [
      schedule({ id: "s-fotos", date: "2026-10-18", ministryId: "fotos", shift: "Manhã", memberIds: ["felipe"] }),
      schedule({ id: "s-reels", date: "2026-10-18", ministryId: "reels", shift: "Noite", memberIds: ["felipe"] }),
      schedule({ id: "s-audio", date: "2026-10-18", ministryId: "audio", shift: "Manhã", memberIds: ["maria"] }),
      schedule({ id: "s-louvor", date: "2026-10-18", ministryId: "louvor", shift: "Noite", memberIds: ["maria"] }),
    ];
    const conflicts = buildDayBoards({ schedules: day, ministries: catalog, members })[0].conflicts;
    expect(conflicts.map(conflict => conflict.name)).toEqual(["Felipe", "Maria"]);
    expect(conflicts.find(conflict => conflict.memberId === "maria")?.assignments.map(place => place.ministryName)).toEqual(["Áudio", "Louvor"]);
  });

  it("conserva três ocorrências da mesma pessoa", () => {
    const day = [
      schedule({ id: "s-fotos", date: "2026-10-25", ministryId: "fotos", shift: "Manhã", memberIds: ["felipe"] }),
      schedule({ id: "s-reels", date: "2026-10-25", ministryId: "reels", shift: "Noite", memberIds: ["felipe"] }),
      schedule({ id: "s-trans", date: "2026-10-25", ministryId: "transmissao", shift: "Noite", memberIds: ["felipe"] }),
    ];
    const conflict = buildDayBoards({ schedules: day, ministries: catalog, members })[0].conflicts[0];
    expect(conflict.assignments.map(place => place.scheduleId)).toEqual(["s-fotos", "s-reels", "s-trans"]);
  });

  it("o filtro visual Mídia inclui as seis funções e exclui Áudio", () => {
    const options = listVisualMinistries(catalog, getMinistryOrder);
    expect(options.filter(option => option.name === "Mídia")).toHaveLength(1);
    expect(options.map(option => option.name)).toEqual(["Louvor", "Áudio", "Mídia", "INA Kids"]);
    for (const ministry of catalog) {
      const belongs = scheduleBelongsToMinistryFilter(ministry, VISUAL_MEDIA_ID);
      if (ministry.name === "Áudio" || ministry.name === "INA Kids" || ministry.name === "Louvor") {
        expect(belongs).toBe(false);
      } else {
        expect(belongs).toBe(true);
      }
    }
    expect(catalog.filter(ministry => scheduleBelongsToMinistryFilter(ministry, VISUAL_MEDIA_ID))).toHaveLength(6);
  });
});

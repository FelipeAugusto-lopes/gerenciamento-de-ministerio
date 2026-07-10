import { MINISTRY_COLORS, type Ministry } from "@/types";

export function getMinistryColor(colorIndex: number) {
  return MINISTRY_COLORS[colorIndex % MINISTRY_COLORS.length];
}

export function getMinistryStyle(colorIndex: number) {
  const color = getMinistryColor(colorIndex);
  return {
    backgroundColor: `hsl(${color} / 0.15)`,
    color: `hsl(${color})`,
    borderColor: `hsl(${color} / 0.3)`,
  };
}

export function getDayOfWeek(dateStr: string): string {
  const days = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const d = new Date(dateStr + "T12:00:00");
  return days[d.getDay()];
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Fixed display order for ministries across the app.
export const MINISTRY_ORDER = [
  "Voluntariado",
  "Louvor",
  "Áudio",
  "Mídia Story",
  "Mídia Fotos",
  "Mídia Reels",
  "Mídia Fotos e Story",
  "Projeção",
  "Transmissão",
  "Berçário",
  "INA Kids 3-6",
  "INA Kids 7-8",
  "INA Kids 9-12",
  "INA Kids 9-13",
];

function normalizeMinistryName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getMinistryOrder(name: string): number {
  const normalized = normalizeMinistryName(name);
  const compact = normalized.replace(/\s+/g, "");
  const idx = MINISTRY_ORDER.findIndex(n => {
    const orderName = normalizeMinistryName(n);
    return orderName === normalized || orderName.replace(/\s+/g, "") === compact;
  });
  return idx >= 0 ? idx : 999;
}

export function sortMinistries(ministries: Ministry[]): Ministry[] {
  return [...ministries].sort((a, b) => getMinistryOrder(a.name) - getMinistryOrder(b.name));
}


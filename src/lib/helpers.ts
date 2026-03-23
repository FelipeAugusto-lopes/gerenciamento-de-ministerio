import { MINISTRY_COLORS } from "@/types";

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

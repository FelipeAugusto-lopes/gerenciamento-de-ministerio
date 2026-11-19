import type { Member, Ministry, Schedule } from "@/types";
import { getMinistryOrder } from "@/lib/helpers";

const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const SHIFT_TIMES: Record<string, string> = { Manhã: "10:00", Noite: "18:00" };

interface Line {
  text: string;
  type: "shift" | "entry";
  gapBefore?: number;
}

/** Linhas de cada dia do mês, só com os ministérios escolhidos. */
export function buildCalendarDayEntries(
  schedules: Schedule[], ministries: Ministry[], members: Member[], ministryIds: string[], year: number, month: number,
) {
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const allowed = new Set(ministryIds);
  const result = new Map<string, { ministry: string; colorIndex: number; shift: string; names: string[] }[]>();
  schedules
    .filter(s => s.date.startsWith(prefix) && allowed.has(s.ministryId))
    .forEach(s => {
      const min = ministries.find(m => m.id === s.ministryId);
      if (!min) return;
      const names = s.memberIds.map(id => members.find(m => m.id === id)?.name).filter(Boolean) as string[];
      const list = result.get(s.date) || [];
      list.push({ ministry: min.name, colorIndex: min.colorIndex, shift: s.shift, names });
      result.set(s.date, list);
    });
  result.forEach(list => list.sort((a, b) =>
    a.shift === b.shift ? getMinistryOrder(a.ministry) - getMinistryOrder(b.ministry) : a.shift === "Manhã" ? -1 : 1));
  return result;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(" ");
  const out: string[] = [];
  let cur = "";
  words.forEach(word => {
    const candidate = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(candidate).width > max && cur) {
      out.push(cur);
      cur = word;
    } else {
      cur = candidate;
    }
  });
  if (cur) out.push(cur);
  return out;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function linesHeight(lines: Line[]): number {
  return lines.reduce((height, line) =>
    height + (line.gapBefore || 0) + (line.type === "shift" ? 36 : 32), 0);
}

export function renderCalendarImage(opts: {
  schedules: Schedule[]; ministries: Ministry[]; members: Member[];
  ministryIds: string[]; year: number; month: number; monthLabel: string; title: string;
}): HTMLCanvasElement {
  const { year, month } = opts;
  const entries = buildCalendarDayEntries(opts.schedules, opts.ministries, opts.members, opts.ministryIds, year, month);
  const frameMargin = 48;
  const framePadding = 28;
  const minRowH = 300;
  const weekH = 82;
  const landscapeRatio = 1.45;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const font = (size: number, bold = false) => `${bold ? "700" : "500"} ${size}px 'Plus Jakarta Sans', system-ui, sans-serif`;

  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const rows = cells.length / 7;

  // Meses com muitos nomes precisam de células mais largas para não virar uma imagem alongada.
  const measure = (width: number) => {
    const frameWidth = width - frameMargin * 2;
    const contentWidth = frameWidth - framePadding * 2;
    const colW = contentWidth / 7;
    const cellLines = cells.map(day => {
      if (!day) return [] as Line[];
      const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const lines: Line[] = [];
      let lastShift = "";
      ctx.font = font(22);
      (entries.get(date) || []).forEach(entry => {
        if (entry.shift !== lastShift) {
          lines.push({
            text: `${entry.shift === "Manhã" ? "☀" : "☾"}  ${SHIFT_TIMES[entry.shift] || entry.shift}`,
            type: "shift",
            gapBefore: lastShift ? 20 : 0,
          });
          lastShift = entry.shift;
        }
        const names = entry.names.length ? entry.names.join(", ").toUpperCase() : "—";
        wrap(ctx, `${entry.ministry} · ${names}`, colW - 68).forEach((text, index) => {
          lines.push({ text, type: "entry", gapBefore: index === 0 ? 10 : 0 });
        });
      });
      return lines;
    });
    const requiredRowH = Math.max(...cellLines.map(lines => 96 + linesHeight(lines) + 28));
    const rowH = Math.max(minRowH, requiredRowH);
    const frameH = weekH + rows * rowH + framePadding;
    return { frameWidth, contentWidth, colW, cellLines, rowH, frameH };
  };

  let W = 3000;
  let layout = measure(W);
  while (W / (layout.frameH + frameMargin * 2) < landscapeRatio && W < 12000) {
    W += 500;
    layout = measure(W);
  }
  const { frameWidth, contentWidth, colW, cellLines, rowH, frameH } = layout;
  const H = frameH + frameMargin * 2;
  const exportScale = Math.min(1, 4200 / W);
  canvas.width = Math.round(W * exportScale);
  canvas.height = Math.round(H * exportScale);
  ctx.scale(exportScale, exportScale);

  // Fundo e moldura única, como no modelo de referência.
  ctx.fillStyle = "#f5f4f0";
  ctx.fillRect(0, 0, W, H);
  roundedRect(ctx, frameMargin, frameMargin, frameWidth, frameH, 26);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#d8dad4";
  ctx.lineWidth = 2;
  ctx.stroke();

  const contentX = frameMargin + framePadding;
  const gridY = frameMargin + weekH;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = font(21, true);
  ctx.fillStyle = "#777b75";
  WEEKDAYS.forEach((weekday, index) => {
    ctx.fillText(weekday, contentX + colW * index + colW / 2, frameMargin + 48);
  });
  ctx.textAlign = "left";

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDay = isCurrentMonth ? today.getDate() : null;

  for (let index = 0; index < cells.length; index++) {
    const day = cells[index];
    if (!day) continue;
    const row = Math.floor(index / 7);
    const column = index % 7;
    const cellX = contentX + column * colW;
    const cellY = gridY + row * rowH;
    const lines = cellLines[index];
    const hasSchedules = lines.length > 0;
    const cardX = cellX + 8;
    const cardY = cellY + 6;
    const cardW = colW - 16;
    const cardH = rowH - 12;
    const isToday = day === todayDay;

    if (hasSchedules) {
      roundedRect(ctx, cardX, cardY, cardW, cardH, 26);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = isToday ? "#555b57" : "#d7dad5";
      ctx.lineWidth = isToday ? 4 : 2;
      ctx.stroke();
    }

    const numberX = hasSchedules ? cardX + 25 : cellX + 25;
    const numberY = cellY + 47;
    if (isToday) {
      ctx.beginPath();
      ctx.arc(numberX + 10, numberY - 11, 24, 0, Math.PI * 2);
      ctx.fillStyle = "#454a47";
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.font = font(27, true);
      ctx.fillText(String(day), numberX + 10, numberY);
      ctx.textAlign = "left";
    } else {
      ctx.fillStyle = "#373b37";
      ctx.font = font(27, true);
      ctx.fillText(String(day), numberX, numberY);
    }

    let lineY = cellY + 94;
    lines.forEach(line => {
      lineY += line.gapBefore || 0;
      if (!line.text) return;
      if (line.type === "shift") {
        ctx.font = font(23);
        ctx.fillStyle = line.text.startsWith("☀") ? "#a8893e" : "#7181a5";
      } else {
        ctx.font = font(22);
        ctx.fillStyle = "#515550";
      }
      ctx.fillText(line.text, cardX + 25, lineY);
      lineY += line.type === "shift" ? 36 : 32;
    });
  }

  return canvas;
}

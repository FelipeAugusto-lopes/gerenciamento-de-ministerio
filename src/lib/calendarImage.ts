import { MINISTRY_COLORS, type Member, type Ministry, type Schedule } from "@/types";
import { getMinistryOrder } from "@/lib/helpers";

const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

interface Line { text: string; color: string; bold?: boolean }

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
  words.forEach(w => {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > max && cur) { out.push(cur); cur = w; } else cur = t;
  });
  if (cur) out.push(cur);
  return out;
}

export function renderCalendarImage(opts: {
  schedules: Schedule[]; ministries: Ministry[]; members: Member[];
  ministryIds: string[]; year: number; month: number; monthLabel: string; title: string;
}): HTMLCanvasElement {
  const { year, month } = opts;
  const entries = buildCalendarDayEntries(opts.schedules, opts.ministries, opts.members, opts.ministryIds, year, month);
  const W = 1800, pad = 40, colW = (W - pad * 2) / 7, inner = colW - 20, lineH = 24;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const font = (size: number, bold = false) => `${bold ? "700" : "500"} ${size}px 'Plus Jakarta Sans', system-ui, sans-serif`;
  const showShift = new Set(Array.from(entries.values()).flat().map(e => e.shift)).size > 1;

  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  const cellLines = cells.map(day => {
    if (!day) return [] as Line[];
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const lines: Line[] = [];
    let lastShift = "";
    (entries.get(date) || []).forEach(e => {
      if (showShift && e.shift !== lastShift) { lines.push({ text: e.shift === "Manhã" ? "☀ Manhã" : "☾ Noite", color: "#64748b", bold: true }); lastShift = e.shift; }
      const color = `hsl(${MINISTRY_COLORS[e.colorIndex % MINISTRY_COLORS.length]})`;
      ctx.font = font(18, true);
      wrap(ctx, e.ministry, inner).forEach(t => lines.push({ text: t, color, bold: true }));
      ctx.font = font(18);
      (e.names.length ? e.names : ["—"]).forEach(n => wrap(ctx, n, inner - 10).forEach(t => lines.push({ text: t, color: "#1e293b" })));
    });
    return lines;
  });

  const rows = cells.length / 7;
  const rowHeights = Array.from({ length: rows }, (_, r) =>
    Math.max(130, 46 + Math.max(...cellLines.slice(r * 7, r * 7 + 7).map(l => l.length)) * lineH + 12));
  const headerH = 170, weekH = 50, footerH = 50;
  canvas.width = W;
  canvas.height = headerH + weekH + rowHeights.reduce((a, b) => a + b, 0) + footerH + pad;

  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, canvas.height);
  ctx.fillStyle = "#1f4d3a"; ctx.fillRect(0, 0, W, headerH - 20);
  ctx.fillStyle = "#e0b04a"; ctx.fillRect(0, headerH - 26, W, 6);
  ctx.textAlign = "center"; ctx.fillStyle = "#ffffff";
  ctx.font = font(52, true); ctx.fillText(opts.title, W / 2, 78);
  ctx.font = font(28); ctx.fillStyle = "#f4e3b5";
  const ml = opts.monthLabel; ctx.fillText(ml.charAt(0).toUpperCase() + ml.slice(1), W / 2, 122);

  let y = headerH;
  ctx.font = font(20, true);
  WEEKDAYS.forEach((d, i) => { ctx.fillStyle = "#1f4d3a"; ctx.fillText(d, pad + colW * i + colW / 2, y + 32); });
  y += weekH;
  ctx.textAlign = "left";
  for (let r = 0; r < rows; r++) {
    const h = rowHeights[r];
    for (let c = 0; c < 7; c++) {
      const idx = r * 7 + c, day = cells[idx], x = pad + colW * c;
      ctx.fillStyle = day ? (cellLines[idx].length ? "#f8faf7" : "#ffffff") : "#f1f5f9";
      ctx.fillRect(x, y, colW, h);
      ctx.strokeStyle = "#d6ddd8"; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, colW, h);
      if (!day) continue;
      ctx.font = font(24, true); ctx.fillStyle = "#1f4d3a"; ctx.fillText(String(day), x + 10, y + 32);
      let ly = y + 62;
      cellLines[idx].forEach(l => {
        ctx.font = font(l.bold ? 17 : 18, l.bold); ctx.fillStyle = l.color;
        ctx.fillText(l.text, x + (l.bold ? 10 : 18), ly); ly += lineH;
      });
    }
    y += h;
  }
  ctx.textAlign = "center"; ctx.font = font(16); ctx.fillStyle = "#94a3b8";
  ctx.fillText("INA Escalas · Igreja Nova Aliança", W / 2, y + 34);
  return canvas;
}

import { Schedule, Member, Ministry, MINISTRY_COLORS } from "@/types";
import { formatDate, getDayOfWeek, getMinistryOrder } from "@/lib/helpers";

interface ExportData {
  schedules: Schedule[];
  members: Member[];
  ministries: Ministry[];
}

function getDaySchedules(schedules: Schedule[], date: string) {
  return schedules
    .filter(s => s.date === date)
    .sort((a, b) => a.shift.localeCompare(b.shift));
}

function buildTextReport(data: ExportData, date: string): string {
  const daySchedules = getDaySchedules(data.schedules, date);

  let text = `📋 *ESCALA DO DIA*\n📅 ${formatDate(date)} — ${getDayOfWeek(date)}\n\n`;

  if (daySchedules.length === 0) {
    text += "Nenhuma escala nesta data.\n";
    return text;
  }

  const byShift = new Map<string, Schedule[]>();
  daySchedules.forEach(s => {
    const list = byShift.get(s.shift) || [];
    list.push(s);
    byShift.set(s.shift, list);
  });

  byShift.forEach((shiftSchedules, shift) => {
    const sorted = [...shiftSchedules].sort((a, b) => {
      const minA = data.ministries.find(m => m.id === a.ministryId);
      const minB = data.ministries.find(m => m.id === b.ministryId);
      return getMinistryOrder(minA?.name || "") - getMinistryOrder(minB?.name || "");
    });

    text += `${shift === "Manhã" ? "☀️" : "🌙"} *${shift}*\n`;
    sorted.forEach(s => {
      const ministry = data.ministries.find(m => m.id === s.ministryId);
      const names = s.memberIds.map(id => data.members.find(m => m.id === id)?.name || "?").join(", ");
      text += `  • ${ministry?.name || "?"}: ${names}\n`;
    });
    text += "\n";
  });

  return text;
}

export function shareViaWhatsApp(data: ExportData, date: string) {
  const text = buildTextReport(data, date);
  const encoded = encodeURIComponent(text);
  window.open(`https://wa.me/?text=${encoded}`, "_blank");
}

export interface PdfExportOptions {
  showMinistry?: boolean;
  showMembers?: boolean;
  showShift?: boolean;
  showDate?: boolean;
}

const DEFAULT_OPTS: Required<PdfExportOptions> = {
  showMinistry: true,
  showMembers: true,
  showShift: true,
  showDate: true,
};

function buildShiftColumn(
  shift: string,
  schedules: Schedule[],
  data: ExportData,
  isManha: boolean,
  opts: Required<PdfExportOptions>
): string {
  const accentColor = isManha ? "#f59e0b" : "#6366f1";
  const bgGradient = isManha
    ? "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)"
    : "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)";
  const icon = isManha ? "☀️" : "🌙";
  const headerBg = isManha
    ? "linear-gradient(135deg, #f59e0b, #d97706)"
    : "linear-gradient(135deg, #6366f1, #4f46e5)";

  const sorted = [...schedules].sort((a, b) => {
    const minA = data.ministries.find(m => m.id === a.ministryId);
    const minB = data.ministries.find(m => m.id === b.ministryId);
    return getMinistryOrder(minA?.name || "") - getMinistryOrder(minB?.name || "");
  });

  let rows = "";
  sorted.forEach(s => {
    const ministry = data.ministries.find(m => m.id === s.ministryId);
    const color = ministry ? MINISTRY_COLORS[ministry.colorIndex % MINISTRY_COLORS.length] : "0 0% 50%";
    const names = s.memberIds.map(id => data.members.find(m => m.id === id)?.name || "?");

    const memberChips = opts.showMembers
      ? names.map(n =>
          `<span style="display:inline-block;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:3px 10px;font-size:14px;margin:2px 3px;color:#1e293b;">${n}</span>`
        ).join(" ")
      : "";

    const ministryBlock = opts.showMinistry
      ? `<div style="margin-bottom:5px;">
          <span style="background:hsl(${color}/0.15);color:hsl(${color});padding:3px 12px;border-radius:6px;font-size:14px;font-weight:700;letter-spacing:0.3px;">${ministry?.name || "?"}</span>
        </div>`
      : "";

    const membersBlock = opts.showMembers
      ? `<div style="margin-top:5px;">${memberChips}</div>`
      : "";

    rows += `
      <div style="padding:10px 14px;border-bottom:1px solid rgba(0,0,0,0.06);">
        ${ministryBlock}
        ${membersBlock}
      </div>`;
  });

  if (sorted.length === 0) {
    rows = `<div style="padding:16px;text-align:center;color:#94a3b8;font-size:14px;">Nenhuma escala</div>`;
  }

  const header = opts.showShift
    ? `<div style="background:${headerBg};padding:12px 16px;display:flex;align-items:center;gap:8px;">
        <span style="font-size:22px;">${icon}</span>
        <span style="color:white;font-weight:700;font-size:18px;letter-spacing:0.5px;">${shift}</span>
        <span style="color:rgba(255,255,255,0.85);font-size:14px;margin-left:auto;">${sorted.length} escala${sorted.length !== 1 ? "s" : ""}</span>
      </div>`
    : "";

  return `
    <div style="flex:1;min-width:280px;border-radius:12px;overflow:hidden;border:2px solid ${accentColor}20;background:${bgGradient};">
      ${header}
      <div>${rows}</div>
    </div>`;
}

export function exportToPDF(data: ExportData, date: string, options?: PdfExportOptions) {
  const opts = { ...DEFAULT_OPTS, ...(options || {}) };
  const daySchedules = getDaySchedules(data.schedules, date);

  const manhaSchedules = daySchedules.filter(s => s.shift === "Manhã");
  const noiteSchedules = daySchedules.filter(s => s.shift === "Noite");

  const showManha = manhaSchedules.length > 0 || opts.showShift;
  const showNoite = noiteSchedules.length > 0 || opts.showShift;

  // If shift is hidden, merge into a single column
  let bodyContent: string;
  if (daySchedules.length === 0) {
    bodyContent = '<p style="text-align:center;padding:40px;color:#94a3b8;font-size:16px;">Nenhuma escala nesta data.</p>';
  } else if (!opts.showShift) {
    // single merged column without shift header
    bodyContent = `<div style="display:flex;gap:12px;align-items:flex-start;">${buildShiftColumn("", daySchedules, data, true, opts)}</div>`;
  } else {
    const cols: string[] = [];
    if (showManha) cols.push(buildShiftColumn("Manhã", manhaSchedules, data, true, opts));
    if (showNoite) cols.push(buildShiftColumn("Noite", noiteSchedules, data, false, opts));
    bodyContent = `<div style="display:flex;gap:12px;align-items:flex-start;">${cols.join("")}</div>`;
  }

  const dateHeader = opts.showDate
    ? `<div style="margin-top:4px;">
        <span style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:5px 16px;font-size:16px;font-weight:600;color:#475569;">
          📅 ${formatDate(date)} — ${getDayOfWeek(date)}
        </span>
      </div>`
    : "";

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Escala - ${formatDate(date)}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:'Plus Jakarta Sans','Segoe UI',system-ui,-apple-system,sans-serif;background:#ffffff;color:#1e293b;padding:20px;}
      @media print{
        body{padding:10px;}
        @page{size:A4 landscape;margin:8mm;}
      }
    </style></head><body>
    <div style="text-align:center;margin-bottom:14px;">
      <h1 style="font-size:28px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;">📋 INA Escalas</h1>
      ${dateHeader}
    </div>

    ${bodyContent}

    <div style="margin-top:14px;text-align:center;font-size:11px;color:#cbd5e1;border-top:1px solid #f1f5f9;padding-top:8px;">
      INA Escalas · Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
    </div>
    </body></html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, "_blank");
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
      URL.revokeObjectURL(url);
    };
  }
}

// ============================================================
// Month-level exports (Visualizar Escalas)
// ============================================================

export const SHIFT_TIMES: Record<string, string> = { "Manhã": "10:00", "Noite": "18:00" };

function sortByMinistryOrder(schedules: Schedule[], ministries: Ministry[]): Schedule[] {
  return [...schedules].sort((a, b) => {
    const minA = ministries.find(m => m.id === a.ministryId);
    const minB = ministries.find(m => m.id === b.ministryId);
    return getMinistryOrder(minA?.name || "") - getMinistryOrder(minB?.name || "");
  });
}

function groupMonthSchedules(schedules: Schedule[]) {
  const dates = Array.from(new Set(schedules.map(s => s.date))).sort();
  return dates.map(date => ({
    date,
    manha: schedules.filter(s => s.date === date && s.shift === "Manhã"),
    noite: schedules.filter(s => s.date === date && s.shift === "Noite"),
  }));
}

function buildMonthText(data: ExportData, monthLabel: string, schedules: Schedule[], ministryName?: string): string {
  const title = ministryName ? `ESCALA ${ministryName.toUpperCase()}` : "ESCALA GERAL";
  let text = `📋 *${title}*\n🗓️ *${monthLabel.toUpperCase()}*\n`;

  const groups = groupMonthSchedules(schedules);
  if (groups.length === 0) {
    text += "\nNenhuma escala neste período.\n";
    return text;
  }

  groups.forEach(g => {
    text += `\n📅 *${formatDate(g.date)} — ${getDayOfWeek(g.date)}*\n`;
    (["Manhã", "Noite"] as const).forEach(shift => {
      const list = shift === "Manhã" ? g.manha : g.noite;
      if (list.length === 0) return;
      text += `${shift === "Manhã" ? "☀️" : "🌙"} *${shift}* (${SHIFT_TIMES[shift]})\n`;
      sortByMinistryOrder(list, data.ministries).forEach(s => {
        const ministry = data.ministries.find(m => m.id === s.ministryId);
        const names = s.memberIds.map(id => data.members.find(m => m.id === id)?.name || "?").join(", ");
        text += `  • ${ministry?.name || "?"}: ${names || "—"}\n`;
      });
    });
  });

  return text;
}

export function shareMonthViaWhatsApp(data: ExportData, monthLabel: string, schedules: Schedule[], ministryName?: string) {
  const text = buildMonthText(data, monthLabel, schedules, ministryName);
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
}

export function exportMonthToPDF(data: ExportData, monthLabel: string, schedules: Schedule[], ministryName?: string) {
  const groups = groupMonthSchedules(schedules);
  const title = ministryName ? `Escala ${ministryName}` : "Escala Geral";

  let body = "";
  if (groups.length === 0) {
    body = '<p style="text-align:center;padding:40px;color:#94a3b8;font-size:16px;">Nenhuma escala neste período.</p>';
  }

  groups.forEach(g => {
    const d = new Date(g.date + "T12:00:00");
    const dayNum = d.getDate();
    const weekday = getDayOfWeek(g.date);

    let shiftsHtml = "";
    (["Manhã", "Noite"] as const).forEach(shift => {
      const list = shift === "Manhã" ? g.manha : g.noite;
      if (list.length === 0) return;
      const isManha = shift === "Manhã";
      const icon = isManha ? "☀️" : "🌙";

      let ministriesHtml = "";
      sortByMinistryOrder(list, data.ministries).forEach(s => {
        const ministry = data.ministries.find(m => m.id === s.ministryId);
        const color = ministry ? MINISTRY_COLORS[ministry.colorIndex % MINISTRY_COLORS.length] : "0 0% 50%";
        const names = s.memberIds.map(id => data.members.find(m => m.id === id)?.name || "?");
        const chips = names.length > 0
          ? names.map(n => `<span style="display:inline-block;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:2px 9px;font-size:13px;margin:2px 3px;color:#1e293b;">${n}</span>`).join(" ")
          : '<span style="color:#94a3b8;font-size:13px;">—</span>';
        ministriesHtml += `
          <div style="padding:7px 12px;border-left:3px solid hsl(${color});margin:6px 0;">
            <span style="background:hsl(${color}/0.15);color:hsl(${color});padding:2px 10px;border-radius:6px;font-size:12px;font-weight:700;">${ministry?.name || "?"}</span>
            <div style="margin-top:4px;">${chips}</div>
          </div>`;
      });

      shiftsHtml += `
        <div style="margin-top:8px;">
          <div style="font-size:13px;font-weight:700;color:#64748b;letter-spacing:0.4px;">${icon} ${shift.toUpperCase()} · ${SHIFT_TIMES[shift]}</div>
          ${ministriesHtml}
        </div>`;
    });

    body += `
      <div style="display:flex;gap:14px;align-items:flex-start;padding:12px 0;border-bottom:1px solid #f1f5f9;page-break-inside:avoid;">
        <div style="text-align:center;min-width:64px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px 6px;">
          <div style="font-size:24px;font-weight:800;color:#0f172a;line-height:1;">${String(dayNum).padStart(2, "0")}</div>
          <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;margin-top:2px;">${weekday.slice(0, 3)}</div>
        </div>
        <div style="flex:1;">${shiftsHtml}</div>
      </div>`;
  });

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title} - ${monthLabel}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:'Plus Jakarta Sans','Segoe UI',system-ui,-apple-system,sans-serif;background:#ffffff;color:#1e293b;padding:24px;max-width:800px;margin:0 auto;}
      @media print{ body{padding:10px;} @page{size:A4 portrait;margin:10mm;} }
    </style></head><body>
    <div style="text-align:center;margin-bottom:16px;">
      <h1 style="font-size:26px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;">📋 ${title}</h1>
      <div style="margin-top:6px;">
        <span style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:5px 16px;font-size:15px;font-weight:600;color:#475569;text-transform:capitalize;">🗓️ ${monthLabel}</span>
      </div>
    </div>
    ${body}
    <div style="margin-top:16px;text-align:center;font-size:11px;color:#cbd5e1;border-top:1px solid #f1f5f9;padding-top:8px;">
      INA Escalas · Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
    </div>
    </body></html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, "_blank");
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
      URL.revokeObjectURL(url);
    };
  }
}


import { Schedule, Member, Ministry, MINISTRY_COLORS } from "@/types";
import { formatDate, getDayOfWeek } from "@/lib/helpers";

interface ExportData {
  schedules: Schedule[];
  members: Member[];
  ministries: Ministry[];
}

function getWeekRange(date: string): { start: Date; end: Date; label: string } {
  const d = new Date(date + "T12:00:00");
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (dt: Date) => dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return { start, end, label: `${fmt(start)} a ${fmt(end)}` };
}

function getWeekSchedules(schedules: Schedule[], date: string) {
  const { start, end } = getWeekRange(date);
  return schedules.filter(s => {
    const d = new Date(s.date + "T12:00:00");
    return d >= start && d <= end;
  }).sort((a, b) => a.date.localeCompare(b.date) || a.shift.localeCompare(b.shift));
}

function buildTextReport(data: ExportData, date: string): string {
  const { label } = getWeekRange(date);
  const weekSchedules = getWeekSchedules(data.schedules, date);
  
  let text = `📋 *ESCALA DA SEMANA*\n${label}\n\n`;

  if (weekSchedules.length === 0) {
    text += "Nenhuma escala nesta semana.\n";
    return text;
  }

  // Group by date
  const byDate = new Map<string, Schedule[]>();
  weekSchedules.forEach(s => {
    const list = byDate.get(s.date) || [];
    list.push(s);
    byDate.set(s.date, list);
  });

  byDate.forEach((daySchedules, dateKey) => {
    text += `📅 *${formatDate(dateKey)} — ${getDayOfWeek(dateKey)}*\n`;
    
    const byShift = new Map<string, Schedule[]>();
    daySchedules.forEach(s => {
      const list = byShift.get(s.shift) || [];
      list.push(s);
      byShift.set(s.shift, list);
    });

    byShift.forEach((shiftSchedules, shift) => {
      text += `  ${shift === "Manhã" ? "☀️" : "🌙"} *${shift}*\n`;
      shiftSchedules.forEach(s => {
        const ministry = data.ministries.find(m => m.id === s.ministryId);
        const names = s.memberIds.map(id => data.members.find(m => m.id === id)?.name || "?").join(", ");
        const statusIcon = s.status === "Confirmado" ? "✅" : s.status === "Recusado" ? "❌" : s.status === "Concluído" ? "✔️" : "⏳";
        text += `    • ${ministry?.name || "?"}: ${names} ${statusIcon}\n`;
      });
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

export function exportToPDF(data: ExportData, date: string) {
  const { label } = getWeekRange(date);
  const weekSchedules = getWeekSchedules(data.schedules, date);

  // Group by date
  const byDate = new Map<string, Schedule[]>();
  weekSchedules.forEach(s => {
    const list = byDate.get(s.date) || [];
    list.push(s);
    byDate.set(s.date, list);
  });

  // Build HTML for PDF
  let rows = "";
  byDate.forEach((daySchedules, dateKey) => {
    daySchedules.forEach((s, idx) => {
      const ministry = data.ministries.find(m => m.id === s.ministryId);
      const names = s.memberIds.map(id => data.members.find(m => m.id === id)?.name || "?").join(", ");
      const color = ministry ? MINISTRY_COLORS[ministry.colorIndex % MINISTRY_COLORS.length] : "0 0% 50%";
      const statusIcon = s.status === "Confirmado" ? "✅" : s.status === "Recusado" ? "❌" : s.status === "Concluído" ? "✔️" : "⏳";
      rows += `
        <tr>
          ${idx === 0 ? `<td rowspan="${daySchedules.length}" style="font-weight:600;border-right:1px solid #ddd;padding:8px;vertical-align:top;">${formatDate(dateKey)}<br><small style="color:#666">${getDayOfWeek(dateKey)}</small></td>` : ""}
          <td style="padding:8px;border-right:1px solid #ddd;">
            <span style="background:hsl(${color}/0.15);color:hsl(${color});padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">${ministry?.name || "?"}</span>
          </td>
          <td style="padding:8px;border-right:1px solid #ddd;">${s.shift === "Manhã" ? "☀️" : "🌙"} ${s.shift}</td>
          <td style="padding:8px;border-right:1px solid #ddd;">${names}</td>
          <td style="padding:8px;text-align:center;">${statusIcon} ${s.status}</td>
        </tr>`;
    });
  });

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Escala Semanal</title>
    <style>
      body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:24px;color:#1a1a1a;}
      h1{font-size:20px;margin:0 0 4px;}
      h2{font-size:14px;color:#666;margin:0 0 16px;font-weight:400;}
      table{width:100%;border-collapse:collapse;font-size:13px;}
      th{background:#f5f5f5;padding:10px 8px;text-align:left;border-bottom:2px solid #ddd;font-size:12px;text-transform:uppercase;color:#555;}
      tr{border-bottom:1px solid #eee;}
      @media print{body{padding:16px;}}
    </style></head><body>
    <h1>📋 Escala Semanal</h1>
    <h2>${label}</h2>
    ${weekSchedules.length === 0 ? "<p>Nenhuma escala nesta semana.</p>" : `
    <table>
      <thead><tr><th>Data</th><th>Ministério</th><th>Turno</th><th>Pessoas</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`}
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

import { useState, useMemo } from "react";
import { useStore } from "@/store/StoreContext";
import { getMinistryStyle, formatDate } from "@/lib/helpers";
import { Calendar, CheckCircle2, Clock, UserCheck, BarChart3, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export default function FrequencyReport() {
  const { schedules, members, ministries } = useStore();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [search, setSearch] = useState("");

  const monthSchedules = useMemo(() => {
    return schedules.filter(s => {
      const d = new Date(s.date + "T12:00:00");
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }, [schedules, year, month]);

  const stats = useMemo(() => {
    const memberStats = members.map(m => {
      const memberSchedules = monthSchedules.filter(s => s.memberIds.includes(m.id));
      const confirmed = memberSchedules.filter(s => s.status === "Confirmado" || s.status === "Concluído").length;
      const total = memberSchedules.length;
      const last = memberSchedules.sort((a, b) => b.date.localeCompare(a.date))[0];
      const ministryCounts = new Map<string, number>();
      memberSchedules.forEach(s => {
        ministryCounts.set(s.ministryId, (ministryCounts.get(s.ministryId) || 0) + 1);
      });
      const topMinistry = Array.from(ministryCounts.entries()).sort((a, b) => b[1] - a[1])[0];
      return {
        member: m,
        total,
        confirmed,
        rate: total > 0 ? Math.round((confirmed / total) * 100) : 0,
        lastDate: last?.date || null,
        topMinistryId: topMinistry?.[0],
      };
    });
    return memberStats.filter(s => s.total > 0).sort((a, b) => b.total - a.total);
  }, [members, monthSchedules]);

  const filtered = useMemo(() => {
    if (!search.trim()) return stats;
    const q = search.toLowerCase();
    return stats.filter(s => s.member.name.toLowerCase().includes(q));
  }, [stats, search]);

  const totals = useMemo(() => {
    const total = monthSchedules.length;
    const confirmed = monthSchedules.filter(s => s.status === "Confirmado" || s.status === "Concluído").length;
    const membersActive = new Set(monthSchedules.flatMap(s => s.memberIds)).size;
    return { total, confirmed, membersActive };
  }, [monthSchedules]);

  const exportCSV = () => {
    const header = "Membro,Total,Confirmadas,Frequência,Ultima escala,Ministério principal\n";
    const rows = filtered.map(s => {
      const ministry = ministries.find(m => m.id === s.topMinistryId)?.name || "";
      return `"${s.member.name}",${s.total},${s.confirmed},${s.rate}%,${s.lastDate ? formatDate(s.lastDate) : ""},${ministry}`;
    }).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `frequencia-${String(month + 1).padStart(2, "0")}-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-stack">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Relatório de frequência</h1>
          <p className="meta-text">Acompanhe a presença dos membros nas escalas do mês.</p>
        </div>
        <Button variant="outline" onClick={exportCSV} className="h-11 gap-2">
          <FileText className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: "Escalas no mês", value: totals.total, Icon: Calendar, tone: "primary" },
          { label: "Confirmadas", value: totals.confirmed, Icon: CheckCircle2, tone: "emerald" },
          { label: "Membros ativos", value: totals.membersActive, Icon: UserCheck, tone: "accent" },
          { label: "Taxa média", value: `${totals.total > 0 ? Math.round((totals.confirmed / totals.total) * 100) : 0}%`, Icon: BarChart3, tone: "amber" },
        ].map(({ label, value, Icon, tone }) => {
          const toneMap: Record<string, string> = {
            primary: "from-primary/15 to-primary/5 text-primary",
            emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400",
            amber: "from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400",
            accent: "from-accent/20 to-accent/5 text-accent-foreground",
          };
          return (
            <div key={label} className={cn("stat-card bg-gradient-to-br border-border/60 text-left", toneMap[tone])}>
              <div className="flex items-center justify-between">
                <span className="eyebrow">{label}</span>
                <Icon className="h-4 w-4 opacity-70" />
              </div>
              <div className="mt-1.5 font-display text-2xl sm:text-3xl font-bold tabular-nums text-foreground">{value}</div>
            </div>
          );
        })}
      </div>

      <div className="content-card p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-2">
            <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
              <SelectTrigger className="h-11 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((name, i) => <SelectItem key={i} value={String(i)}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="h-11 w-28" />
          </div>
          <div className="relative flex-1">
            <Input
              placeholder="Buscar membro..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-11 pl-10"
            />
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>Nenhum dado encontrado para o período.</p>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((s, idx) => {
              const ministry = ministries.find(m => m.id === s.topMinistryId);
              return (
                <div key={s.member.id} className="py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted font-display font-bold text-sm text-muted-foreground">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{s.member.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {s.total} escala{s.total !== 1 ? "s" : ""}</span>
                        {s.lastDate && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> última {formatDate(s.lastDate)}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:justify-end flex-wrap">
                    {ministry && (
                      <span className="ministry-badge border text-xs" style={getMinistryStyle(ministry.colorIndex)}>
                        {ministry.name}
                      </span>
                    )}
                    <div className="flex items-center gap-2 min-w-[140px]">
                      <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn("h-full rounded-full", s.rate >= 80 ? "bg-emerald-500" : s.rate >= 50 ? "bg-amber-500" : "bg-red-500")}
                          style={{ width: `${s.rate}%` }}
                        />
                      </div>
                      <span className={cn("text-sm font-semibold w-12 text-right", s.rate >= 80 ? "text-emerald-600" : s.rate >= 50 ? "text-amber-600" : "text-red-600")}>
                        {s.rate}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

import { useMemo } from "react";
import { useStore } from "@/store/StoreContext";
import { MINISTRY_COLORS } from "@/types";
import { getMinistryIcon } from "@/lib/ministryIcons";
import { TrendingUp, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface Props {
  year: number;
  month: number; // 0-11
  onSelectDate?: (date: string) => void;
}

export function HomeDashboard({ year, month }: Props) {
  const { schedules, ministries, members } = useStore();

  const monthSchedules = useMemo(
    () =>
      schedules.filter(s => {
        const d = new Date(s.date + "T12:00:00");
        return d.getFullYear() === year && d.getMonth() === month;
      }),
    [schedules, year, month]
  );

  // Previous month (relative to displayed month)
  const prevYear = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevMonthSchedules = useMemo(
    () =>
      schedules.filter(s => {
        const d = new Date(s.date + "T12:00:00");
        return d.getFullYear() === prevYear && d.getMonth() === prevMonth;
      }),
    [schedules, prevYear, prevMonth]
  );

  const topMinistries = useMemo(() => {
    const map = new Map<string, number>();
    monthSchedules.forEach(s => map.set(s.ministryId, (map.get(s.ministryId) || 0) + 1));
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ ministry: ministries.find(m => m.id === id), count }))
      .filter(x => x.ministry);
  }, [monthSchedules, ministries]);

  const getTopMember = (list: typeof schedules) => {
    const map = new Map<string, number>();
    list.forEach(s => s.memberIds.forEach(mid => map.set(mid, (map.get(mid) || 0) + 1)));
    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) return null;
    const [id, count] = sorted[0];
    const member = members.find(m => m.id === id);
    if (!member) return null;
    return { member, count };
  };

  const topCurrent = useMemo(() => getTopMember(monthSchedules), [monthSchedules, members]);
  const topPrev = useMemo(() => getTopMember(prevMonthSchedules), [prevMonthSchedules, members]);

  const maxMinistry = topMinistries[0]?.count || 1;

  const initialsOf = (name: string) =>
    name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
      {/* Ministérios mais ativos */}
      <div className="content-card">
        <div className="card-header-pad flex items-center gap-2 border-b bg-muted/30">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="section-title">Ministérios ativos</h3>
        </div>
        <div className="p-3 sm:p-4 space-y-2.5">
          <p className="eyebrow">{MONTH_NAMES[month]} · {monthSchedules.length} escalas</p>
          {topMinistries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sem dados no mês.</p>
          ) : (
            topMinistries.map(({ ministry, count }) => {
              const color = MINISTRY_COLORS[ministry!.colorIndex % MINISTRY_COLORS.length];
              const Icon = getMinistryIcon(ministry!.name);
              const pct = (count / maxMinistry) * 100;
              return (
                <div key={ministry!.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-6 w-6 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `hsl(${color} / 0.18)`, color: `hsl(${color})` }}
                    >
                      <Icon className="h-3 w-3" />
                    </span>
                    <span className="text-sm font-medium truncate flex-1">{ministry!.name}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: `hsl(${color})` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Destaques: membro mais escalado — mês anterior vs mês atual */}
      <div className="content-card">
        <div className="card-header-pad flex items-center gap-2 border-b bg-muted/30">
          <Crown className="h-4 w-4 text-primary" />
          <h3 className="section-title">Destaques do mês</h3>
        </div>
        <div className="p-3 sm:p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 font-medium">Período</th>
                <th className="pb-2 font-medium">Membro mais escalado</th>
                <th className="pb-2 font-medium text-right">Escalas</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                { label: MONTH_NAMES[prevMonth], sub: "Mês anterior", data: topPrev, highlight: false },
                { label: MONTH_NAMES[month], sub: "Mês atual", data: topCurrent, highlight: true },
              ].map(row => (
                <tr key={row.sub} className="align-middle">
                  <td className="py-3 pr-2">
                    <div className={cn("text-sm font-medium", row.highlight && "text-primary")}>
                      {row.label}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{row.sub}</div>
                  </td>
                  <td className="py-3 pr-2">
                    {row.data ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={cn(
                            "h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0",
                            row.highlight
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground"
                          )}
                        >
                          {initialsOf(row.data.member.name)}
                        </span>
                        <span className="text-sm font-medium truncate">{row.data.member.name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sem dados</span>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    <span className="text-sm font-semibold tabular-nums">
                      {row.data ? row.data.count : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

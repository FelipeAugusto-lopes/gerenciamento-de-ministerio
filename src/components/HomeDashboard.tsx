import { useMemo } from "react";
import { useStore } from "@/store/StoreContext";
import { Crown, PieChart, Clock, UserPlus } from "lucide-react";
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

const DAY_MS = 86400000;

export function HomeDashboard({ year, month }: Props) {
  const { schedules, members } = useStore();

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

  const getTopMembers = (list: typeof schedules, n = 3) => {
    const map = new Map<string, number>();
    list.forEach(s => s.memberIds.forEach(mid => map.set(mid, (map.get(mid) || 0) + 1)));
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([id, count]) => {
        const member = members.find(m => m.id === id);
        return member ? { member, count } : null;
      })
      .filter((x): x is { member: typeof members[number]; count: number } => !!x);
  };

  const topCurrent = useMemo(() => getTopMembers(monthSchedules), [monthSchedules, members]);
  const topPrev = useMemo(() => getTopMembers(prevMonthSchedules), [prevMonthSchedules, members]);

  // 1. Pessoas há mais tempo sem servir (última escala realizada)
  const idleMembers = useMemo(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const lastServed = new Map<string, number>();
    schedules.forEach(s => {
      const t = new Date(s.date + "T12:00:00").getTime();
      if (t > today.getTime()) return; // apenas escalas já realizadas
      s.memberIds.forEach(mid => {
        const prev = lastServed.get(mid);
        if (prev === undefined || t > prev) lastServed.set(mid, t);
      });
    });
    return members
      .map(member => {
        const last = lastServed.get(member.id);
        return {
          member,
          days: last === undefined ? null : Math.max(0, Math.round((today.getTime() - last) / DAY_MS)),
        };
      })
      .sort((a, b) => {
        if (a.days === null && b.days === null) return a.member.name.localeCompare(b.member.name);
        if (a.days === null) return -1;
        if (b.days === null) return 1;
        return b.days - a.days;
      })
      .slice(0, 5);
  }, [schedules, members]);

  const maxIdle = Math.max(1, ...idleMembers.map(i => i.days ?? 0));

  // 3. Voluntários sobrecarregados (mês exibido)
  const overloaded = useMemo(() => getTopMembers(monthSchedules, 5), [monthSchedules, members]);
  const maxOverload = overloaded[0]?.count || 1;

  // 4. Novos membros
  const newMembers = useMemo(() => {
    const now = Date.now();
    const served = new Set<string>();
    schedules.forEach(s => s.memberIds.forEach(mid => served.add(mid)));
    return [...members]
      .filter(m => !!m.createdAt)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
      .slice(0, 5)
      .map(member => ({
        member,
        days: Math.max(0, Math.round((now - new Date(member.createdAt!).getTime()) / DAY_MS)),
        served: served.has(member.id),
      }));
  }, [members, schedules]);

  const initialsOf = (name: string) =>
    name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
      {/* Pessoas há mais tempo sem servir */}
      <div className="content-card">
        <div className="card-header-pad flex items-center gap-2 border-b bg-muted/30">
          <Clock className="h-4 w-4 text-primary" />
          <h3 className="section-title">Há mais tempo sem servir</h3>
        </div>
        <div className="p-3 sm:p-4 space-y-2.5">
          <p className="eyebrow">Top 5 · membros cadastrados</p>
          {idleMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sem membros cadastrados.</p>
          ) : (
            idleMembers.map((entry, idx) => (
              <div key={entry.member.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0",
                      idx === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                    )}
                  >
                    {idx === 0 ? initialsOf(entry.member.name) : `${idx + 1}º`}
                  </span>
                  <span className="text-sm font-medium truncate flex-1">{entry.member.name}</span>
                  <span className="text-xs font-semibold tabular-nums text-primary whitespace-nowrap">
                    {entry.days === null ? "Nunca participou" : `${entry.days} d`}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${entry.days === null ? 100 : Math.min(100, (entry.days / maxIdle) * 100)}%` }}
                  />
                </div>
              </div>
            ))
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
                <th className="pb-2 font-medium">Top 3 membros</th>
                <th className="pb-2 font-medium text-right">Escalas</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                { label: MONTH_NAMES[prevMonth], sub: "Mês anterior", data: topPrev, highlight: false },
                { label: MONTH_NAMES[month], sub: "Mês atual", data: topCurrent, highlight: true },
              ].flatMap(row =>
                row.data.length === 0
                  ? [(
                      <tr key={row.sub} className="align-middle">
                        <td className="py-3 pr-2">
                          <div className={cn("text-sm font-medium", row.highlight && "text-primary")}>
                            {row.label}
                          </div>
                          <div className="text-[11px] text-muted-foreground">{row.sub}</div>
                        </td>
                        <td className="py-3 pr-2" colSpan={2}>
                          <span className="text-xs text-muted-foreground">Sem dados</span>
                        </td>
                      </tr>
                    )]
                  : row.data.map((entry, idx) => (
                      <tr key={`${row.sub}-${entry.member.id}`} className="align-middle">
                        <td className="py-3 pr-2">
                          {idx === 0 ? (
                            <>
                              <div className={cn("text-sm font-medium", row.highlight && "text-primary")}>
                                {row.label}
                              </div>
                              <div className="text-[11px] text-muted-foreground">{row.sub}</div>
                            </>
                          ) : null}
                        </td>
                        <td className="py-3 pr-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={cn(
                                "h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0",
                                row.highlight && idx === 0
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-foreground"
                              )}
                            >
                              {idx === 0 ? initialsOf(entry.member.name) : `${idx + 1}º`}
                            </span>
                            <span className="text-sm font-medium truncate">{entry.member.name}</span>
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          <span className="text-sm font-semibold tabular-nums">{entry.count}</span>
                        </td>
                      </tr>
                    ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Voluntários sobrecarregados */}
      <div className="content-card">
        <div className="card-header-pad flex items-center gap-2 border-b bg-muted/30">
          <PieChart className="h-4 w-4 text-primary" />
          <h3 className="section-title">Voluntários sobrecarregados</h3>
        </div>
        <div className="p-3 sm:p-4 space-y-2.5">
          <p className="eyebrow">{MONTH_NAMES[month]} · {monthSchedules.length} escalas</p>
          {overloaded.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sem dados no mês.</p>
          ) : (
            overloaded.map((entry, idx) => (
              <div key={entry.member.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0",
                      idx === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                    )}
                  >
                    {idx === 0 ? initialsOf(entry.member.name) : `${idx + 1}º`}
                  </span>
                  <span className="text-sm font-medium truncate flex-1">{entry.member.name}</span>
                  <span className="text-xs font-semibold tabular-nums text-primary">
                    {entry.count} {entry.count === 1 ? "escala" : "escalas"}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, (entry.count / maxOverload) * 100)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Novos membros */}
      <div className="content-card">
        <div className="card-header-pad flex items-center gap-2 border-b bg-muted/30">
          <UserPlus className="h-4 w-4 text-primary" />
          <h3 className="section-title">Novos membros</h3>
        </div>
        <div className="p-3 sm:p-4 space-y-2.5">
          <p className="eyebrow">Últimos 5 cadastros</p>
          {newMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sem cadastros recentes.</p>
          ) : (
            newMembers.map((entry, idx) => (
              <div key={entry.member.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0",
                      idx === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                    )}
                  >
                    {initialsOf(entry.member.name)}
                  </span>
                  <span className="text-sm font-medium truncate flex-1">{entry.member.name}</span>
                  <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                    {entry.days === 0 ? "hoje" : `${entry.days} d`}
                  </span>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                    entry.served ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  {entry.served ? "Primeira escala realizada" : "Ainda não escalado"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

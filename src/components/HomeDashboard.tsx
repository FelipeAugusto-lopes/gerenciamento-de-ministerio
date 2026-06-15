import { useMemo } from "react";
import { useStore } from "@/store/StoreContext";
import { MINISTRY_COLORS } from "@/types";
import { getMinistryIcon } from "@/lib/ministryIcons";
import { formatDate, getDayOfWeek } from "@/lib/helpers";
import { CalendarClock, TrendingUp, Users } from "lucide-react";
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

export function HomeDashboard({ year, month, onSelectDate }: Props) {
  const { schedules, ministries, members } = useStore();

  const todayStr = new Date().toISOString().split("T")[0];

  const monthSchedules = useMemo(
    () =>
      schedules.filter(s => {
        const d = new Date(s.date + "T12:00:00");
        return d.getFullYear() === year && d.getMonth() === month;
      }),
    [schedules, year, month]
  );

  const upcoming = useMemo(
    () =>
      [...schedules]
        .filter(s => s.date >= todayStr)
        .sort((a, b) =>
          a.date === b.date ? a.shift.localeCompare(b.shift) : a.date.localeCompare(b.date)
        )
        .slice(0, 4),
    [schedules, todayStr]
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

  const topMembers = useMemo(() => {
    const map = new Map<string, number>();
    monthSchedules.forEach(s =>
      s.memberIds.forEach(mid => map.set(mid, (map.get(mid) || 0) + 1))
    );
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ member: members.find(m => m.id === id), count }))
      .filter(x => x.member);
  }, [monthSchedules, members]);

  const maxMinistry = topMinistries[0]?.count || 1;
  const maxMember = topMembers[0]?.count || 1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
      {/* Próximas escalas */}
      <div className="content-card">
        <div className="card-header-pad flex items-center gap-2 border-b bg-muted/30">
          <CalendarClock className="h-4 w-4 text-primary" />
          <h3 className="section-title">Próximas escalas</h3>
        </div>
        <div className="p-3 sm:p-4 space-y-2">
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Sem escalas futuras.
            </p>
          ) : (
            upcoming.map(s => {
              const ministry = ministries.find(m => m.id === s.ministryId);
              if (!ministry) return null;
              const color = MINISTRY_COLORS[ministry.colorIndex % MINISTRY_COLORS.length];
              const Icon = getMinistryIcon(ministry.name);
              return (
                <button
                  key={s.id}
                  onClick={() => onSelectDate?.(s.date)}
                  className="w-full flex items-center gap-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors p-2.5 text-left"
                >
                  <span
                    className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `hsl(${color} / 0.18)`, color: `hsl(${color})` }}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{ministry.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {formatDate(s.date)} · {getDayOfWeek(s.date)} · {s.shift}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {s.memberIds.length} {s.memberIds.length === 1 ? "membro" : "membros"}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

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

      {/* Membros com mais escalas */}
      <div className="content-card">
        <div className="card-header-pad flex items-center gap-2 border-b bg-muted/30">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="section-title">Membros mais escalados</h3>
        </div>
        <div className="p-3 sm:p-4 space-y-2">
          <p className="eyebrow">{MONTH_NAMES[month]}</p>
          {topMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sem dados no mês.</p>
          ) : (
            topMembers.map(({ member, count }, idx) => {
              const initials = member!.name
                .split(" ")
                .map(p => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase();
              const pct = (count / maxMember) * 100;
              return (
                <div
                  key={member!.id}
                  className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/40 transition-colors"
                >
                  <span
                    className={cn(
                      "h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0",
                      idx === 0
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{member!.name}</p>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1">
                      <div
                        className="h-full rounded-full bg-primary/70 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                    {count}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

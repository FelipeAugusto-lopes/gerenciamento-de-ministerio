import { useMemo, useState } from "react";
import { useStore } from "@/store/StoreContext";
import { Crown, Clock, PieChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/helpers";
import { membersLongestWithoutServing, rankScheduleAssignments, type AssignmentRank } from "@/lib/scheduleInsights";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface Props {
  year: number;
  month: number;
  onSelectDate?: (date: string) => void;
}

function localTodayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function schedulesInMonth<T extends { date: string }>(list: T[], year: number, month: number): T[] {
  return list.filter(item => {
    const date = new Date(item.date + "T12:00:00");
    return date.getFullYear() === year && date.getMonth() === month;
  });
}

export function HomeDashboard({ year, month }: Props) {
  const { schedules, members, ministries } = useStore();
  const [selectedRank, setSelectedRank] = useState<AssignmentRank | null>(null);

  const prevYear = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 11 : month - 1;

  const names = useMemo(() => new Map(members.map(member => [member.id, member.name])), [members]);
  const ministryName = (id: string) => ministries.find(ministry => ministry.id === id)?.name;

  const monthSchedules = useMemo(() => schedulesInMonth(schedules, year, month), [schedules, year, month]);
  const prevMonthSchedules = useMemo(
    () => schedulesInMonth(schedules, prevYear, prevMonth),
    [schedules, prevYear, prevMonth],
  );

  const topCurrent = useMemo(
    () => rankScheduleAssignments(monthSchedules, names, 5),
    [monthSchedules, names],
  );
  const topPrev = useMemo(
    () => rankScheduleAssignments(prevMonthSchedules, names, 5),
    [prevMonthSchedules, names],
  );
  const idleMembers = useMemo(
    () => membersLongestWithoutServing(schedules, members, localTodayIso(), 5),
    [schedules, members],
  );
  const memberById = useMemo(() => new Map(members.map(member => [member.id, member])), [members]);

  const selectedMember = selectedRank ? memberById.get(selectedRank.memberId) : undefined;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
      <section className="content-card xl:col-span-2">
        <div className="card-header-pad flex items-center gap-2 border-b bg-muted/30">
          <Crown className="h-4 w-4 text-primary" />
          <h3 className="section-title">Destaques do mês</h3>
        </div>
        <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
          <RankColumn
            title={`Destaques — ${MONTH_NAMES[month]} ${year}`}
            entries={topCurrent}
            names={names}
            highlight
          />
          <RankColumn
            title={`Mês anterior — ${MONTH_NAMES[prevMonth]} ${prevYear}`}
            entries={topPrev}
            names={names}
          />
        </div>
      </section>

      <section className="content-card">
        <div className="card-header-pad flex items-center gap-2 border-b bg-muted/30">
          <Clock className="h-4 w-4 text-primary" />
          <h3 className="section-title">Há mais tempo sem servir</h3>
        </div>
        <div className="p-3 sm:p-4 space-y-3">
          <p className="eyebrow">Top 5 · escalas já realizadas</p>
          {idleMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sem membros cadastrados.</p>
          ) : (
            idleMembers.map((entry, index) => {
              const member = memberById.get(entry.memberId);
              if (!member) return null;
              const linked = member.ministryIds.map(ministryName).filter(Boolean) as string[];
              const lastMinistries = entry.lastMinistryIds.map(ministryName).filter(Boolean) as string[];
              return (
                <div key={entry.memberId} className="rounded-xl border border-border/60 px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <span className={cn(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                      index === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                    )}>
                      {index + 1}º
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{member.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {linked.length > 0 ? linked.slice(0, 3).join(" · ") : "Sem ministério vinculado"}
                      </p>
                      <p className="mt-1 text-xs font-medium text-primary">
                        {entry.lastDate
                          ? `Última vez: ${formatDate(entry.lastDate)}${lastMinistries.length ? ` · ${lastMinistries.join(", ")}` : ""} · há ${entry.days} dia${entry.days === 1 ? "" : "s"}`
                          : "Nunca serviu"}
                      </p>
                      {member.unavailableDates.length > 0 && (
                        <p className="text-[11px] text-muted-foreground">Possui datas de indisponibilidade</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="content-card">
        <div className="card-header-pad flex items-center gap-2 border-b bg-muted/30">
          <PieChart className="h-4 w-4 text-primary" />
          <h3 className="section-title">Voluntários sobrecarregados</h3>
        </div>
        <div className="p-3 sm:p-4 space-y-2">
          <p className="eyebrow">{MONTH_NAMES[month]} {year} · top 5 mais escalados</p>
          {topCurrent.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sem dados no mês.</p>
          ) : (
            topCurrent.map((entry, index) => {
              const mainMinistry = entry.byMinistry[0] ? ministryName(entry.byMinistry[0].ministryId) : undefined;
              return (
                <button
                  key={entry.memberId}
                  type="button"
                  onClick={() => setSelectedRank(entry)}
                  className="flex w-full items-center gap-2 rounded-xl border border-border/60 px-3 py-2.5 text-left hover:border-primary/40 hover:bg-muted/30 transition-colors"
                >
                  <span className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                    index === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                  )}>
                    {index + 1}º
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold truncate">{names.get(entry.memberId)}</span>
                    {mainMinistry && (
                      <span className="block text-xs text-muted-foreground truncate">{mainMinistry}</span>
                    )}
                  </span>
                  <span className="text-xs font-semibold tabular-nums text-primary whitespace-nowrap">
                    {entry.count} {entry.count === 1 ? "escala" : "escalas"}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </section>

      <Dialog open={!!selectedRank} onOpenChange={open => !open && setSelectedRank(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedMember?.name || "Escalas do mês"}</DialogTitle>
          </DialogHeader>
          {selectedRank && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {selectedRank.count} {selectedRank.count === 1 ? "escala" : "escalas"} em {MONTH_NAMES[month]} {year}.
              </p>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Ministérios</p>
                <div className="space-y-1">
                  {selectedRank.byMinistry.map(item => (
                    <p key={item.ministryId} className="text-sm">
                      {ministryName(item.ministryId) || "Ministério"} · {item.count} {item.count === 1 ? "vez" : "vezes"}
                    </p>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Dias</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedRank.dates.map(date => (
                    <span key={date} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                      {formatDate(date)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RankColumn({
  title,
  entries,
  names,
  highlight = false,
}: {
  title: string;
  entries: AssignmentRank[];
  names: Map<string, string>;
  highlight?: boolean;
}) {
  return (
    <div className="p-3 sm:p-4 space-y-2">
      <p className={cn("text-sm font-semibold", highlight && "text-primary")}>{title}</p>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground py-3">Sem escalas neste mês.</p>
      ) : (
        entries.map((entry, index) => (
          <div key={entry.memberId} className="flex items-center gap-2">
            <span className="w-7 text-xs font-semibold text-muted-foreground">{index + 1}º</span>
            <span className="min-w-0 flex-1 text-sm font-medium truncate">{names.get(entry.memberId)}</span>
            <span className="text-sm font-semibold tabular-nums">{entry.count}</span>
          </div>
        ))
      )}
    </div>
  );
}

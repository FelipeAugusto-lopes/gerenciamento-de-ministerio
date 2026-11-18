import { useMemo } from "react";
import { useStore } from "@/store/StoreContext";
import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { rankScheduleAssignments, type AssignmentRank } from "@/lib/scheduleInsights";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface Props {
  year: number;
  month: number;
}

function schedulesInMonth<T extends { date: string }>(list: T[], year: number, month: number): T[] {
  return list.filter(item => {
    const date = new Date(item.date + "T12:00:00");
    return date.getFullYear() === year && date.getMonth() === month;
  });
}

export function HomeDashboard({ year, month }: Props) {
  const { schedules, members } = useStore();

  const prevYear = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 11 : month - 1;

  const names = useMemo(() => new Map(members.map(member => [member.id, member.name])), [members]);

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

  return (
    <section className="content-card">
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

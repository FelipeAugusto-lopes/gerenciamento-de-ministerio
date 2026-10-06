import type { Schedule, Shift } from "@/types";

export interface AssignmentRank {
  memberId: string;
  count: number;
  dates: string[];
  byMinistry: { ministryId: string; count: number }[];
}

export interface IdleMember {
  memberId: string;
  lastDate: string | null;
  days: number | null;
  lastMinistryIds: string[];
}

export interface DayAssignment {
  scheduleId: string;
  ministryId: string;
  shift: string;
}

const SHIFTS: Shift[] = ["Manhã", "Noite"];

function daysBetween(later: string, earlier: string): number {
  const a = new Date(later + "T12:00:00").getTime();
  const b = new Date(earlier + "T12:00:00").getTime();
  return Math.max(0, Math.round((a - b) / 86400000));
}

/**
 * Conta cada escala em que a pessoa aparece, em qualquer status.
 * É a mesma regra já usada no dashboard: uma participação soma 1.
 */
export function rankScheduleAssignments(
  schedules: Pick<Schedule, "memberIds" | "ministryId" | "date">[],
  names: Map<string, string>,
  limit: number,
): AssignmentRank[] {
  const totals = new Map<string, number>();
  const dates = new Map<string, Set<string>>();
  const ministries = new Map<string, Map<string, number>>();

  schedules.forEach(schedule => {
    schedule.memberIds.forEach(memberId => {
      totals.set(memberId, (totals.get(memberId) || 0) + 1);
      const memberDates = dates.get(memberId) || new Set<string>();
      memberDates.add(schedule.date);
      dates.set(memberId, memberDates);
      const byMinistry = ministries.get(memberId) || new Map<string, number>();
      byMinistry.set(schedule.ministryId, (byMinistry.get(schedule.ministryId) || 0) + 1);
      ministries.set(memberId, byMinistry);
    });
  });

  return [...totals.entries()]
    .map(([memberId, count]) => ({
      memberId,
      count,
      dates: [...(dates.get(memberId) || [])].sort(),
      byMinistry: [...(ministries.get(memberId) || [])]
        .map(([ministryId, ministryCount]) => ({ ministryId, count: ministryCount }))
        .sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return (names.get(a.memberId) || "").localeCompare(names.get(b.memberId) || "", "pt-BR");
    })
    .slice(0, limit);
}

/**
 * Quem está há mais tempo sem uma escala já realizada.
 * Escalas futuras não contam. Quem nunca serviu fica no topo.
 */
export function membersLongestWithoutServing(
  schedules: Pick<Schedule, "memberIds" | "ministryId" | "date">[],
  members: { id: string; name: string }[],
  todayIso: string,
  limit: number,
): IdleMember[] {
  const lastDate = new Map<string, string>();
  schedules.forEach(schedule => {
    if (schedule.date > todayIso) return;
    schedule.memberIds.forEach(memberId => {
      const prev = lastDate.get(memberId);
      if (!prev || schedule.date > prev) lastDate.set(memberId, schedule.date);
    });
  });

  return members
    .map(member => {
      const last = lastDate.get(member.id) || null;
      const lastMinistryIds = last
        ? [...new Set(schedules.filter(s => s.date === last && s.memberIds.includes(member.id)).map(s => s.ministryId))]
        : [];
      return {
        memberId: member.id,
        lastDate: last,
        days: last ? daysBetween(todayIso, last) : null,
        lastMinistryIds,
      };
    })
    .sort((a, b) => {
      if (a.days === null && b.days === null) {
        const nameA = members.find(m => m.id === a.memberId)?.name || "";
        const nameB = members.find(m => m.id === b.memberId)?.name || "";
        return nameA.localeCompare(nameB, "pt-BR");
      }
      if (a.days === null) return -1;
      if (b.days === null) return 1;
      if (b.days !== a.days) return b.days - a.days;
      return (members.find(m => m.id === a.memberId)?.name || "").localeCompare(
        members.find(m => m.id === b.memberId)?.name || "",
        "pt-BR",
      );
    })
    .slice(0, limit);
}

/** Pessoa em duas ou mais escalas no mesmo dia, em qualquer ministério ou turno. */
export function sameDayConflicts(
  schedules: Pick<Schedule, "id" | "date" | "ministryId" | "shift" | "memberIds">[],
): Map<string, Map<string, DayAssignment[]>> {
  const byDate = new Map<string, Map<string, DayAssignment[]>>();

  schedules.forEach(schedule => {
    const members = byDate.get(schedule.date) || new Map<string, DayAssignment[]>();
    schedule.memberIds.forEach(memberId => {
      const list = members.get(memberId) || [];
      if (!list.some(item => item.scheduleId === schedule.id)) {
        list.push({ scheduleId: schedule.id, ministryId: schedule.ministryId, shift: schedule.shift });
      }
      members.set(memberId, list);
    });
    byDate.set(schedule.date, members);
  });

  const conflicts = new Map<string, Map<string, DayAssignment[]>>();
  byDate.forEach((members, date) => {
    const flagged = new Map<string, DayAssignment[]>();
    members.forEach((assignments, memberId) => {
      if (assignments.length >= 2) flagged.set(memberId, assignments);
    });
    if (flagged.size > 0) conflicts.set(date, flagged);
  });
  return conflicts;
}

/** Agrupa escalas pela data, sem nova consulta ao banco. */
export function groupSchedulesByDate<T extends { date: string }>(schedules: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  schedules.forEach(schedule => {
    const list = map.get(schedule.date) || [];
    list.push(schedule);
    map.set(schedule.date, list);
  });
  return map;
}

export function groupByShift<T extends { shift: string; ministryId: string }>(
  schedules: T[],
  ministryOrder: (ministryId: string) => number,
): { shift: Shift; items: T[] }[] {
  return SHIFTS.map(shift => ({
    shift,
    items: schedules
      .filter(schedule => schedule.shift === shift)
      .sort((a, b) => ministryOrder(a.ministryId) - ministryOrder(b.ministryId)),
  })).filter(group => group.items.length > 0);
}

import type { Ministry, Schedule, Shift } from "@/types";
import { getMinistryColor, getMinistryOrder } from "@/lib/helpers";
import { getMinistryIconKey } from "@/lib/ministryIcons";

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

/** Horários já usados na visualização. O modelo não inventa outro turno. */
const SHIFT_TIMES: Record<Shift, string> = { "Manhã": "10:00", "Noite": "18:00" };

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

export interface DayBoardPerson {
  id: string;
  name: string;
  conflicted: boolean;
}

export interface DayBoardMinistry {
  scheduleId: string;
  id: string;
  name: string;
  color: string;
  iconKey: string;
  people: DayBoardPerson[];
}

export interface DayBoardShift {
  shift: Shift;
  time: string;
  ministries: DayBoardMinistry[];
}

export interface DayBoardConflictAssignment {
  scheduleId: string;
  ministryId: string;
  ministryName: string;
  shift: Shift;
  time: string;
}

export interface DayBoardConflict {
  memberId: string;
  name: string;
  assignments: DayBoardConflictAssignment[];
}

export interface DayBoard {
  date: string;
  shifts: DayBoardShift[];
  conflicts: DayBoardConflict[];
}

type BoardSchedule = Pick<Schedule, "id" | "date" | "ministryId" | "shift" | "memberIds">;

export interface DayBoardInput {
  schedules: BoardSchedule[];
  ministries: Pick<Ministry, "id" | "name" | "colorIndex">[];
  members: { id: string; name: string }[];
  /**
   * Escalas de toda a igreja, usadas só para detectar conflito.
   * Quando omitidas, o conflito é calculado sobre `schedules`.
   * A pessoa só entra no aviso se também estiver numa escala visível.
   */
  conflictSchedules?: BoardSchedule[];
}

function shiftOrder(shift: string): number {
  return shift === "Manhã" ? 0 : shift === "Noite" ? 1 : 2;
}

/**
 * Monta a leitura de cada dia: turno, horário, ministério e todas as pessoas.
 * Não corta nomes. Não acessa o banco. Não descreve a interface.
 */
export function buildDayBoards(input: DayBoardInput): DayBoard[] {
  const ministryById = new Map(input.ministries.map(ministry => [ministry.id, ministry]));
  const memberName = new Map(input.members.map(member => [member.id, member.name]));
  const conflictsByDate = sameDayConflicts(input.conflictSchedules ?? input.schedules);
  const visibleByDate = groupSchedulesByDate(input.schedules);

  const ministryOrder = (ministryId: string) => getMinistryOrder(ministryById.get(ministryId)?.name || "");

  const describeMinistry = (ministryId: string) => {
    const ministry = ministryById.get(ministryId);
    if (!ministry) {
      return { name: "Ministério", color: "0 0% 50%", iconKey: "church" };
    }
    return {
      name: ministry.name,
      color: getMinistryColor(ministry.colorIndex),
      iconKey: getMinistryIconKey(ministry.name),
    };
  };

  return [...visibleByDate.keys()].sort().map(date => {
    const daySchedules = visibleByDate.get(date) || [];
    const dayConflicts = conflictsByDate.get(date);
    const visibleMemberIds = new Set(daySchedules.flatMap(schedule => schedule.memberIds));

    const shifts = groupByShift(daySchedules, ministryOrder).map(group => ({
      shift: group.shift,
      time: SHIFT_TIMES[group.shift],
      ministries: group.items.map(schedule => {
        const described = describeMinistry(schedule.ministryId);
        const seen = new Set<string>();
        const people = schedule.memberIds.filter(id => {
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        }).map(id => ({
          id,
          name: memberName.get(id) || "?",
          conflicted: dayConflicts?.has(id) ?? false,
        }));
        return {
          scheduleId: schedule.id,
          id: schedule.ministryId,
          name: described.name,
          color: described.color,
          iconKey: described.iconKey,
          people,
        };
      }),
    }));

    const conflicts: DayBoardConflict[] = [];
    dayConflicts?.forEach((assignments, memberId) => {
      if (!visibleMemberIds.has(memberId)) return;
      conflicts.push({
        memberId,
        name: memberName.get(memberId) || "?",
        assignments: [...assignments]
          .flatMap(assignment => {
            if (assignment.shift !== "Manhã" && assignment.shift !== "Noite") return [];
            const described = describeMinistry(assignment.ministryId);
            return [{
              scheduleId: assignment.scheduleId,
              ministryId: assignment.ministryId,
              ministryName: described.name,
              shift: assignment.shift,
              time: SHIFT_TIMES[assignment.shift],
            }];
          })
          .sort((a, b) => {
            if (a.shift !== b.shift) return shiftOrder(a.shift) - shiftOrder(b.shift);
            return getMinistryOrder(a.ministryName) - getMinistryOrder(b.ministryName);
          }),
      });
    });
    conflicts.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    return { date, shifts, conflicts };
  });
}

import type { Member, Ministry, Schedule, Shift } from "@/types";

// Ministries eligible for the automatic (random) generator.
export const AUTO_MINISTRY_NAMES = [
  "Áudio",
  "Mídia Story",
  "Mídia Fotos",
  "Projeção",
  "Transmissão",
  "Berçário",
];

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isAutoMinistry(name: string): boolean {
  const n = normalize(name);
  return AUTO_MINISTRY_NAMES.some(m => normalize(m) === n);
}

export function getAutoMinistries(ministries: Ministry[]): Ministry[] {
  return ministries.filter(m => isAutoMinistry(m.name));
}

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getNextMonth(): { year: number; month: number } {
  const t = new Date();
  const m = t.getMonth();
  return m === 11 ? { year: t.getFullYear() + 1, month: 0 } : { year: t.getFullYear(), month: m + 1 };
}

export function getMonthDates(year: number, month: number): string[] {
  const total = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: total }, (_, i) => toISO(new Date(year, month, i + 1)));
}

export interface GeneratedSchedule {
  ministryId: string;
  date: string;
  shift: Shift;
  memberIds: string[];
}

interface HistoryProfile {
  // key: `${weekday}|${shift}` -> average team size (rounded, >=1)
  slots: Map<string, number>;
  counts: Map<string, number>; // memberId -> historical assignments
}

function buildHistory(schedules: Schedule[], ministryId: string, beforeDate: string): HistoryProfile {
  const past = schedules.filter(s => s.ministryId === ministryId && s.date < beforeDate);
  const sizes = new Map<string, number[]>();
  const counts = new Map<string, number>();
  past.forEach(s => {
    const weekday = new Date(s.date + "T12:00:00").getDay();
    const key = `${weekday}|${s.shift}`;
    const arr = sizes.get(key) || [];
    arr.push(Math.max(1, s.memberIds.length));
    sizes.set(key, arr);
    s.memberIds.forEach(id => counts.set(id, (counts.get(id) || 0) + 1));
  });
  const slots = new Map<string, number>();
  sizes.forEach((arr, key) => {
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    slots.set(key, Math.max(1, Math.round(avg)));
  });
  return { slots, counts };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Builds a random-but-history-aware schedule proposal for the given dates.
 * - Only the AUTO_MINISTRY_NAMES ministries are considered.
 * - Weekday + shift slots come from what each ministry historically served.
 * - Team size = rounded average of past teams for that weekday/shift.
 * - Members are picked from that ministry, prioritizing whoever served least
 *   (historically + within this generation), skipping unavailable dates and
 *   avoiding double-booking on the same date when possible.
 */
export function generateRandomSchedules(params: {
  dates: string[];
  ministries: Ministry[];
  members: Member[];
  schedules: Schedule[];
}): GeneratedSchedule[] {
  const { dates, ministries, members, schedules } = params;
  const targets = getAutoMinistries(ministries);
  if (targets.length === 0 || dates.length === 0) return [];

  const firstDate = [...dates].sort()[0];
  const histories = new Map<string, HistoryProfile>();
  targets.forEach(m => histories.set(m.id, buildHistory(schedules, m.id, firstDate)));

  // Running assignment counts per member (seeded from history for fairness)
  const running = new Map<string, number>();
  targets.forEach(m => {
    histories.get(m.id)!.counts.forEach((c, id) => running.set(id, (running.get(id) || 0) + c));
  });

  const result: GeneratedSchedule[] = [];
  const sortedDates = [...dates].sort();

  for (const date of sortedDates) {
    const weekday = new Date(date + "T12:00:00").getDay();
    const usedOnDate = new Set<string>();
    // members already scheduled on this date in existing schedules
    schedules.filter(s => s.date === date).forEach(s => s.memberIds.forEach(id => usedOnDate.add(id)));

    for (const ministry of targets) {
      const hist = histories.get(ministry.id)!;
      const shifts: Shift[] = ["Manhã", "Noite"];
      for (const shift of shifts) {
        const slotKey = `${weekday}|${shift}`;
        const teamSize = hist.slots.get(slotKey);
        if (!teamSize) continue; // ministry never served this weekday/shift

        // already exists?
        const exists = schedules.some(
          s => s.date === date && s.ministryId === ministry.id && s.shift === shift
        );
        if (exists) continue;

        const pool = members.filter(
          m => m.ministryIds.includes(ministry.id) && !(m.unavailableDates || []).includes(date)
        );
        if (pool.length === 0) continue;

        const pick = (avoidDouble: boolean) =>
          shuffle(pool.filter(m => !avoidDouble || !usedOnDate.has(m.id))).sort(
            (a, b) => (running.get(a.id) || 0) - (running.get(b.id) || 0)
          );

        let candidates = pick(true);
        if (candidates.length < teamSize) {
          const extra = pick(false).filter(m => !candidates.some(c => c.id === m.id));
          candidates = [...candidates, ...extra];
        }
        const chosen = candidates.slice(0, teamSize);
        if (chosen.length === 0) continue;

        chosen.forEach(m => {
          usedOnDate.add(m.id);
          running.set(m.id, (running.get(m.id) || 0) + 1);
        });

        result.push({
          ministryId: ministry.id,
          date,
          shift,
          memberIds: chosen.map(m => m.id),
        });
      }
    }
  }

  return result;
}

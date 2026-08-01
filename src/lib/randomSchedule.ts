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

// Fairness window: how much past history counts when balancing members.
export const FAIRNESS_MONTHS = 3;

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, date.getDate());
}

interface HistoryProfile {
  // key: `${weekday}|${shift}` -> average team size (rounded, >=1)
  slots: Map<string, number>;
  counts: Map<string, number>; // memberId -> assignments in this ministry (fairness window)
}

function buildHistory(schedules: Schedule[], ministryId: string, beforeDate: string): HistoryProfile {
  const past = schedules.filter(s => s.ministryId === ministryId && s.date < beforeDate);
  const windowStart = toISO(addMonths(new Date(beforeDate + "T12:00:00"), -FAIRNESS_MONTHS));

  const sizes = new Map<string, number[]>();
  const counts = new Map<string, number>();
  past.forEach(s => {
    const weekday = new Date(s.date + "T12:00:00").getDay();
    const key = `${weekday}|${s.shift}`;
    const arr = sizes.get(key) || [];
    arr.push(Math.max(1, s.memberIds.length));
    sizes.set(key, arr);
    if (s.date >= windowStart) {
      s.memberIds.forEach(id => counts.set(id, (counts.get(id) || 0) + 1));
    }
  });
  const slots = new Map<string, number>();
  sizes.forEach((arr, key) => {
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    slots.set(key, Math.max(1, Math.round(avg)));
  });
  return { slots, counts };
}

function daysBetween(a: string, b: string): number {
  const d1 = new Date(a + "T12:00:00").getTime();
  const d2 = new Date(b + "T12:00:00").getTime();
  return Math.abs(Math.round((d1 - d2) / 86400000));
}

/**
 * Builds a fair, history-aware schedule proposal for the given dates.
 * - Only the AUTO_MINISTRY_NAMES ministries are considered.
 * - Weekday + shift slots and team sizes come from past schedules of each ministry.
 * - Members are balanced: whoever served less (in the ministry and overall, over the
 *   last 3 months plus what is being generated) is picked first; a per-member quota
 *   prevents anyone from being scheduled far more than the others.
 * - Repetition is spread out: recently scheduled members are pushed back, and nobody
 *   serves twice on the same date unless there is no alternative.
 * - Random tie-breaks keep the result varied between generations.
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

  const sortedDates = [...dates].sort();
  const firstDate = sortedDates[0];

  const histories = new Map<string, HistoryProfile>();
  targets.forEach(m => histories.set(m.id, buildHistory(schedules, m.id, firstDate)));

  // Historical (last 3 months) counts
  const histMinistry = new Map<string, number>(); // `${ministryId}|${memberId}` -> count
  const histGlobal = new Map<string, number>();
  targets.forEach(m => {
    histories.get(m.id)!.counts.forEach((c, id) => {
      histMinistry.set(`${m.id}|${id}`, c);
      histGlobal.set(id, (histGlobal.get(id) || 0) + c);
    });
  });

  // Last date each member served (existing schedules)
  const lastServed = new Map<string, string>();
  schedules.forEach(s =>
    s.memberIds.forEach(id => {
      const cur = lastServed.get(id);
      if (!cur || s.date > cur) lastServed.set(id, s.date);
    })
  );

  // Running counters for this generation
  const genMinistry = new Map<string, number>();
  const genGlobal = new Map<string, number>();

  // Build the slot list first so we can compute a fair quota per ministry.
  interface Slot { date: string; ministryId: string; shift: Shift; teamSize: number }
  const slotList: Slot[] = [];
  for (const date of sortedDates) {
    const weekday = new Date(date + "T12:00:00").getDay();
    for (const ministry of targets) {
      const hist = histories.get(ministry.id)!;
      for (const shift of ["Manhã", "Noite"] as Shift[]) {
        const teamSize = hist.slots.get(`${weekday}|${shift}`);
        if (!teamSize) continue; // ministry never served this weekday/shift
        const exists = schedules.some(
          s => s.date === date && s.ministryId === ministry.id && s.shift === shift
        );
        if (exists) continue;
        slotList.push({ date, ministryId: ministry.id, shift, teamSize });
      }
    }
  }

  // Fair quota: max assignments per member inside each ministry for this generation.
  const quota = new Map<string, number>();
  targets.forEach(m => {
    const totalSeats = slotList
      .filter(s => s.ministryId === m.id)
      .reduce((a, s) => a + s.teamSize, 0);
    const poolSize = members.filter(mb => mb.ministryIds.includes(m.id)).length;
    quota.set(m.id, poolSize > 0 ? Math.ceil(totalSeats / poolSize) : Number.MAX_SAFE_INTEGER);
  });

  const result: GeneratedSchedule[] = [];

  for (const slot of slotList) {
    const { date, ministryId, shift, teamSize } = slot;

    const usedOnDate = new Set<string>();
    schedules
      .filter(s => s.date === date)
      .forEach(s => s.memberIds.forEach(id => usedOnDate.add(id)));
    result
      .filter(r => r.date === date)
      .forEach(r => r.memberIds.forEach(id => usedOnDate.add(id)));

    const pool = members.filter(
      m => m.ministryIds.includes(ministryId) && !(m.unavailableDates || []).includes(date)
    );
    if (pool.length === 0) continue;

    const scoreOf = (memberId: string) => {
      const minCount =
        (histMinistry.get(`${ministryId}|${memberId}`) || 0) +
        (genMinistry.get(`${ministryId}|${memberId}`) || 0);
      const allCount = (histGlobal.get(memberId) || 0) + (genGlobal.get(memberId) || 0);
      const last = lastServed.get(memberId);
      const gap = last ? daysBetween(date, last) : 999;
      // Recently scheduled members get pushed back so repetition is spread out.
      const recency = gap <= 7 ? 3 : gap <= 14 ? 1.5 : gap <= 21 ? 0.5 : 0;
      return minCount * 3 + allCount + recency + Math.random() * 0.4;
    };

    const rank = (list: Member[]) =>
      list
        .map(m => ({ m, score: scoreOf(m.id) }))
        .sort((a, b) => a.score - b.score)
        .map(x => x.m);

    const underQuota = (m: Member) =>
      (genMinistry.get(`${ministryId}|${m.id}`) || 0) < (quota.get(ministryId) || 1);

    // Preference order: under quota & free that day → under quota → free that day → anyone
    const tiers = [
      pool.filter(m => underQuota(m) && !usedOnDate.has(m.id)),
      pool.filter(m => underQuota(m)),
      pool.filter(m => !usedOnDate.has(m.id)),
      pool,
    ];

    const chosen: Member[] = [];
    for (const tier of tiers) {
      if (chosen.length >= teamSize) break;
      for (const m of rank(tier)) {
        if (chosen.length >= teamSize) break;
        if (chosen.some(c => c.id === m.id)) continue;
        chosen.push(m);
      }
    }
    if (chosen.length === 0) continue;

    chosen.forEach(m => {
      genMinistry.set(`${ministryId}|${m.id}`, (genMinistry.get(`${ministryId}|${m.id}`) || 0) + 1);
      genGlobal.set(m.id, (genGlobal.get(m.id) || 0) + 1);
      const cur = lastServed.get(m.id);
      if (!cur || date > cur) lastServed.set(m.id, date);
    });

    result.push({ ministryId, date, shift, memberIds: chosen.map(m => m.id) });
  }

  return result;
}

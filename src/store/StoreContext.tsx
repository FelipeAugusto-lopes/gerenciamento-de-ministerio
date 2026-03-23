import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { Member, Ministry, Schedule, DEFAULT_MINISTRIES } from "@/types";

interface StoreContextType {
  ministries: Ministry[];
  members: Member[];
  schedules: Schedule[];
  addMinistry: (m: Omit<Ministry, "id">) => void;
  updateMinistry: (m: Ministry) => void;
  deleteMinistry: (id: string) => void;
  addMember: (m: Omit<Member, "id">) => void;
  updateMember: (m: Member) => void;
  deleteMember: (id: string) => void;
  addSchedule: (s: Omit<Schedule, "id">) => void;
  updateSchedule: (s: Schedule) => void;
  deleteSchedule: (id: string) => void;
}

const StoreContext = createContext<StoreContextType | null>(null);

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

let nextId = Date.now();
const genId = () => String(++nextId);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ministries, setMinistries] = useState<Ministry[]>(() => load("ministries", DEFAULT_MINISTRIES));
  const [members, setMembers] = useState<Member[]>(() => load("members", []));
  const [schedules, setSchedules] = useState<Schedule[]>(() => load("schedules", []));

  useEffect(() => { localStorage.setItem("ministries", JSON.stringify(ministries)); }, [ministries]);
  useEffect(() => { localStorage.setItem("members", JSON.stringify(members)); }, [members]);
  useEffect(() => { localStorage.setItem("schedules", JSON.stringify(schedules)); }, [schedules]);

  const addMinistry = useCallback((m: Omit<Ministry, "id">) => setMinistries(prev => [...prev, { ...m, id: genId() }]), []);
  const updateMinistry = useCallback((m: Ministry) => setMinistries(prev => prev.map(x => x.id === m.id ? m : x)), []);
  const deleteMinistry = useCallback((id: string) => setMinistries(prev => prev.filter(x => x.id !== id)), []);

  const addMember = useCallback((m: Omit<Member, "id">) => setMembers(prev => [...prev, { ...m, id: genId() }]), []);
  const updateMember = useCallback((m: Member) => setMembers(prev => prev.map(x => x.id === m.id ? m : x)), []);
  const deleteMember = useCallback((id: string) => setMembers(prev => prev.filter(x => x.id !== id)), []);

  const addSchedule = useCallback((s: Omit<Schedule, "id">) => setSchedules(prev => [...prev, { ...s, id: genId() }]), []);
  const updateSchedule = useCallback((s: Schedule) => setSchedules(prev => prev.map(x => x.id === s.id ? s : x)), []);
  const deleteSchedule = useCallback((id: string) => setSchedules(prev => prev.filter(x => x.id !== id)), []);

  return (
    <StoreContext.Provider value={{ ministries, members, schedules, addMinistry, updateMinistry, deleteMinistry, addMember, updateMember, deleteMember, addSchedule, updateSchedule, deleteSchedule }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

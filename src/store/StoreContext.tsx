import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { Member, Ministry, Schedule, Notification } from "@/types";
import { supabase } from "@/integrations/supabase/client";

interface StoreContextType {
  ministries: Ministry[];
  members: Member[];
  schedules: Schedule[];
  notifications: Notification[];
  loading: boolean;
  addMinistry: (m: Omit<Ministry, "id">) => void;
  updateMinistry: (m: Ministry) => void;
  deleteMinistry: (id: string) => void;
  addMember: (m: Omit<Member, "id">) => void;
  updateMember: (m: Member) => void;
  deleteMember: (id: string) => void;
  addSchedule: (s: Omit<Schedule, "id">) => void;
  updateSchedule: (s: Schedule) => void;
  deleteSchedule: (id: string) => void;
  addNotification: (n: Omit<Notification, "id">) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
}

const StoreContext = createContext<StoreContextType | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Fetch all data ---
  const fetchMinistries = useCallback(async () => {
    const { data } = await supabase.from("ministries").select("*").order("name");
    if (data) setMinistries(data.map(m => ({ id: m.id, name: m.name, colorIndex: m.color_index })));
  }, []);

  const fetchMembers = useCallback(async () => {
    const { data: membersData } = await supabase.from("members").select("*").order("name");
    const { data: mmData } = await supabase.from("member_ministries").select("*");
    if (membersData) {
      setMembers(membersData.map(m => ({
        id: m.id,
        name: m.name,
        phone: m.phone || undefined,
        ministryIds: (mmData || []).filter(mm => mm.member_id === m.id).map(mm => mm.ministry_id),
        unavailableDates: (m.unavailable_dates || []).map((d: string) => d),
      })));
    }
  }, []);

  const fetchSchedules = useCallback(async () => {
    const { data: schedData } = await supabase.from("schedules").select("*").order("date", { ascending: false });
    const { data: smData } = await supabase.from("schedule_members").select("*");
    if (schedData) {
      setSchedules(schedData.map(s => ({
        id: s.id,
        ministryId: s.ministry_id,
        date: s.date,
        shift: s.shift as Schedule["shift"],
        status: s.status as Schedule["status"],
        memberIds: (smData || []).filter(sm => sm.schedule_id === s.id).map(sm => sm.member_id),
      })));
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false });
    if (data) {
      setNotifications(data.map(n => ({
        id: n.id,
        memberId: n.member_id,
        scheduleId: n.schedule_id,
        message: n.message,
        createdAt: n.created_at,
        read: n.read,
      })));
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchMinistries(), fetchMembers(), fetchSchedules(), fetchNotifications()])
      .finally(() => setLoading(false));
  }, [fetchMinistries, fetchMembers, fetchSchedules, fetchNotifications]);

  // --- Realtime subscriptions ---
  useEffect(() => {
    const channel = supabase.channel("store-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "ministries" }, () => fetchMinistries())
      .on("postgres_changes", { event: "*", schema: "public", table: "members" }, () => fetchMembers())
      .on("postgres_changes", { event: "*", schema: "public", table: "member_ministries" }, () => fetchMembers())
      .on("postgres_changes", { event: "*", schema: "public", table: "schedules" }, () => fetchSchedules())
      .on("postgres_changes", { event: "*", schema: "public", table: "schedule_members" }, () => fetchSchedules())
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => fetchNotifications())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchMinistries, fetchMembers, fetchSchedules, fetchNotifications]);

  // --- Ministries CRUD ---
  const addMinistry = useCallback(async (m: Omit<Ministry, "id">) => {
    await supabase.from("ministries").insert({ name: m.name, color_index: m.colorIndex });
  }, []);

  const updateMinistry = useCallback(async (m: Ministry) => {
    await supabase.from("ministries").update({ name: m.name, color_index: m.colorIndex }).eq("id", m.id);
  }, []);

  const deleteMinistry = useCallback(async (id: string) => {
    await supabase.from("ministries").delete().eq("id", id);
  }, []);

  // --- Members CRUD ---
  const addMember = useCallback(async (m: Omit<Member, "id">) => {
    const { data } = await supabase.from("members").insert({ name: m.name, phone: m.phone || null }).select().single();
    if (data && m.ministryIds.length > 0) {
      await supabase.from("member_ministries").insert(
        m.ministryIds.map(mid => ({ member_id: data.id, ministry_id: mid }))
      );
    }
  }, []);

  const updateMember = useCallback(async (m: Member) => {
    await supabase.from("members").update({ name: m.name, phone: m.phone || null }).eq("id", m.id);
    // Replace ministry associations
    await supabase.from("member_ministries").delete().eq("member_id", m.id);
    if (m.ministryIds.length > 0) {
      await supabase.from("member_ministries").insert(
        m.ministryIds.map(mid => ({ member_id: m.id, ministry_id: mid }))
      );
    }
  }, []);

  const deleteMember = useCallback(async (id: string) => {
    await supabase.from("members").delete().eq("id", id);
  }, []);

  // --- Schedules CRUD ---
  const addSchedule = useCallback(async (s: Omit<Schedule, "id">) => {
    const { data } = await supabase.from("schedules").insert({
      ministry_id: s.ministryId,
      date: s.date,
      shift: s.shift,
      status: s.status,
    }).select().single();
    if (data && s.memberIds.length > 0) {
      await supabase.from("schedule_members").insert(
        s.memberIds.map(mid => ({ schedule_id: data.id, member_id: mid }))
      );
    }
  }, []);

  const updateSchedule = useCallback(async (s: Schedule) => {
    await supabase.from("schedules").update({
      ministry_id: s.ministryId,
      date: s.date,
      shift: s.shift,
      status: s.status,
    }).eq("id", s.id);
    // Replace member associations
    await supabase.from("schedule_members").delete().eq("schedule_id", s.id);
    if (s.memberIds.length > 0) {
      await supabase.from("schedule_members").insert(
        s.memberIds.map(mid => ({ schedule_id: s.id, member_id: mid }))
      );
    }
  }, []);

  const deleteSchedule = useCallback(async (id: string) => {
    await supabase.from("schedules").delete().eq("id", id);
  }, []);

  // --- Notifications ---
  const addNotification = useCallback(async (n: Omit<Notification, "id">) => {
    await supabase.from("notifications").insert({
      member_id: n.memberId,
      schedule_id: n.scheduleId || null,
      message: n.message,
      read: n.read,
    });
  }, []);

  const markNotificationRead = useCallback(async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    await supabase.from("notifications").update({ read: true }).eq("read", false);
  }, []);

  return (
    <StoreContext.Provider value={{
      ministries, members, schedules, notifications, loading,
      addMinistry, updateMinistry, deleteMinistry,
      addMember, updateMember, deleteMember,
      addSchedule, updateSchedule, deleteSchedule,
      addNotification, markNotificationRead, markAllNotificationsRead,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

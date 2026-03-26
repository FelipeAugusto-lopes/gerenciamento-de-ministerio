import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AuditEntry {
  id: string;
  action: string;
  detail: string;
  timestamp: string;
  user: string;
}

interface AuditContextType {
  entries: AuditEntry[];
  addEntry: (action: string, detail: string) => void;
}

const AuditContext = createContext<AuditContextType | null>(null);

export function AuditProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  const fetchEntries = useCallback(async () => {
    const { data } = await supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data) {
      setEntries(data.map(e => ({
        id: e.id,
        action: e.action,
        detail: e.detail,
        timestamp: e.created_at,
        user: e.username,
      })));
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    const channel = supabase.channel("audit-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "audit_log" }, () => fetchEntries())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchEntries]);

  const addEntry = useCallback(async (action: string, detail: string) => {
    await supabase.from("audit_log").insert({ action, detail, username: "Usuário" });
  }, []);

  return (
    <AuditContext.Provider value={{ entries, addEntry }}>
      {children}
    </AuditContext.Provider>
  );
}

export function useAudit() {
  const ctx = useContext(AuditContext);
  if (!ctx) throw new Error("useAudit must be used within AuditProvider");
  return ctx;
}

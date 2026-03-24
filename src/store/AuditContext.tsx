import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

export interface AuditEntry {
  id: string;
  action: string; // e.g. "Adicionou membro", "Editou escala"
  detail: string; // e.g. "João Silva no ministério Louvor"
  timestamp: string; // ISO
  user: string; // who did it
}

interface AuditContextType {
  entries: AuditEntry[];
  addEntry: (action: string, detail: string) => void;
}

const AuditContext = createContext<AuditContextType | null>(null);

let nextId = Date.now();

export function AuditProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<AuditEntry[]>(() => {
    try {
      const raw = localStorage.getItem("audit_log");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem("audit_log", JSON.stringify(entries));
  }, [entries]);

  const addEntry = useCallback((action: string, detail: string) => {
    setEntries(prev => [{
      id: String(++nextId),
      action,
      detail,
      timestamp: new Date().toISOString(),
      user: "Usuário",
    }, ...prev].slice(0, 500)); // keep last 500
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

import { useAudit } from "@/store/AuditContext";
import { History, Clock } from "lucide-react";

export default function AuditLogPage() {
  const { entries } = useAudit();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <History className="h-6 w-6 text-primary" /> Histórico de Alterações
        </h1>
        <p className="text-sm text-muted-foreground">{entries.length} registro{entries.length !== 1 ? "s" : ""}</p>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <History className="h-12 w-12 mb-3 opacity-40" />
          <p className="text-sm">Nenhuma alteração registrada ainda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map(e => (
            <div key={e.id} className="rounded-lg border bg-card p-4 flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2 mt-0.5">
                <History className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{e.action}</p>
                <p className="text-sm text-muted-foreground truncate">{e.detail}</p>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                  <Clock className="h-3 w-3" />
                  {new Date(e.timestamp).toLocaleDateString("pt-BR")} às{" "}
                  {new Date(e.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

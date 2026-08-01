import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Shuffle, Wand2, Calendar } from "lucide-react";
import { useStore } from "@/store/StoreContext";
import { useAudit } from "@/store/AuditContext";
import { getMinistryOrder, formatDate } from "@/lib/helpers";
import {
  AUTO_MINISTRY_NAMES,
  generateRandomSchedules,
  getAutoMinistries,
  getMonthDates,
  getNextMonth,
  type GeneratedSchedule,
} from "@/lib/randomSchedule";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onGenerated?: (year: number, month: number) => void;
}

export function RandomScheduleDialog({ open, onOpenChange, onGenerated }: Props) {
  const { schedules, ministries, members, addSchedule } = useStore();
  const { addEntry } = useAudit();

  const { year, month } = useMemo(() => getNextMonth(), []);
  const monthDates = useMemo(() => getMonthDates(year, month), [year, month]);

  const [mode, setMode] = useState<"full" | "some">("full");
  const [picked, setPicked] = useState<string[]>([]);
  const [preview, setPreview] = useState<GeneratedSchedule[] | null>(null);
  const [busy, setBusy] = useState(false);

  const autoMinistries = useMemo(
    () => getAutoMinistries(ministries).sort((a, b) => getMinistryOrder(a.name) - getMinistryOrder(b.name)),
    [ministries]
  );

  const dates = mode === "full" ? monthDates : [...picked].sort();

  const toggleDate = (d: string) =>
    setPicked(p => (p.includes(d) ? p.filter(x => x !== d) : [...p, d]));

  const handleGenerate = () => {
    if (dates.length === 0) {
      toast.error("Escolha pelo menos um dia.");
      return;
    }
    const result = generateRandomSchedules({ dates, ministries, members, schedules });
    if (result.length === 0) {
      toast.error("Não foi possível gerar", {
        description: "Sem histórico suficiente nesses ministérios ou sem membros disponíveis.",
      });
      return;
    }
    setPreview(result);
  };

  const handleApply = async () => {
    if (!preview) return;
    setBusy(true);
    for (const g of preview) {
      await addSchedule({ ...g, status: "Pendente" });
    }
    addEntry(
      "Gerou escala aleatória",
      `${preview.length} escalas criadas para ${MONTH_NAMES[month]} ${year}`
    );
    setBusy(false);
    setPreview(null);
    onOpenChange(false);
    onGenerated?.(year, month);
    toast.success(`${preview.length} escalas criadas em ${MONTH_NAMES[month]} ${year}`);
  };

  const ministryName = (id: string) => ministries.find(m => m.id === id)?.name || "?";
  const memberName = (id: string) => members.find(m => m.id === id)?.name || "?";

  const previewByDate = useMemo(() => {
    if (!preview) return [];
    const map = new Map<string, GeneratedSchedule[]>();
    preview.forEach(g => map.set(g.date, [...(map.get(g.date) || []), g]));
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [preview]);

  const firstWeekday = new Date(year, month, 1).getDay();

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) setPreview(null); onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Shuffle className="h-5 w-5 text-primary" />
            Escala aleatória — {MONTH_NAMES[month]} {year}
          </DialogTitle>
          <DialogDescription>
            Gera automaticamente com base nas escalas passadas (dias, turnos e tamanho das equipes),
            distribuindo os membros de forma equilibrada.
          </DialogDescription>
        </DialogHeader>

        {!preview ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Ministérios incluídos
              </p>
              <div className="flex flex-wrap gap-1.5">
                {AUTO_MINISTRY_NAMES.map(n => {
                  const exists = autoMinistries.some(m => m.name.toLowerCase() === n.toLowerCase());
                  return (
                    <span
                      key={n}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs",
                        exists ? "bg-primary/10 border-primary/30 text-primary" : "opacity-40 line-through"
                      )}
                    >
                      {n}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center rounded-full border border-border/60 bg-muted/40 p-0.5 w-fit">
              {(["full", "some"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                    mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {m === "full" ? "Mês inteiro" : "Dias escolhidos"}
                </button>
              ))}
            </div>

            {mode === "some" && (
              <div>
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {DAYS.map(d => (
                    <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: firstWeekday }).map((_, i) => <div key={`e${i}`} />)}
                  {monthDates.map(d => {
                    const day = Number(d.slice(-2));
                    const active = picked.includes(d);
                    return (
                      <button
                        key={d}
                        onClick={() => toggleDate(d)}
                        className={cn(
                          "aspect-square rounded-lg border text-xs font-medium transition-colors",
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/30 hover:bg-muted border-border/60"
                        )}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
                <p className="meta-text mt-2">{picked.length} dia(s) selecionado(s)</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">
              <span className="font-semibold">{preview.length}</span> escalas propostas em{" "}
              <span className="font-semibold">{previewByDate.length}</span> dia(s).
            </p>
            <div className="space-y-2">
              {previewByDate.map(([date, list]) => (
                <div key={date} className="rounded-lg border border-border/60 p-2.5">
                  <p className="text-xs font-semibold flex items-center gap-1.5 mb-1.5">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    {formatDate(date)}
                  </p>
                  <ul className="space-y-1">
                    {list
                      .sort((a, b) => getMinistryOrder(ministryName(a.ministryId)) - getMinistryOrder(ministryName(b.ministryId)))
                      .map((g, i) => (
                        <li key={i} className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{ministryName(g.ministryId)}</span>
                          {" · "}{g.shift}{" — "}{g.memberIds.map(memberName).join(", ")}
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {!preview ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleGenerate} className="gap-2">
                <Wand2 className="h-4 w-4" /> Gerar proposta
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setPreview(null)} disabled={busy}>Refazer</Button>
              <Button onClick={handleApply} disabled={busy} className="gap-2">
                <Shuffle className="h-4 w-4" /> {busy ? "Salvando..." : "Salvar escalas"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

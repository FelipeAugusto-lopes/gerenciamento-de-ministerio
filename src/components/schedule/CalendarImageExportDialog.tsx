import { useEffect, useMemo, useState } from "react";
import { Download, FileDown, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { renderCalendarImage } from "@/lib/calendarImage";
import { getMinistryColor } from "@/lib/helpers";
import type { Member, Ministry, Schedule } from "@/types";

interface Props {
  open: boolean; onOpenChange: (o: boolean) => void;
  schedules: Schedule[]; ministries: Ministry[]; members: Member[];
  year: number; month: number; monthLabel: string;
}

export function CalendarImageExportDialog({ open, onOpenChange, schedules, ministries, members, year, month, monthLabel }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => { if (!open) setPreview(null); }, [open]);

  const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    schedules.filter(s => s.date.startsWith(prefix)).forEach(s => m.set(s.ministryId, (m.get(s.ministryId) || 0) + 1));
    return m;
  }, [schedules, prefix]);

  const title = selected.length === 0 ? "" : selected.length <= 3
    ? `Escala ${selected.map(id => ministries.find(m => m.id === id)?.name).join(" · ")}` : "Escala dos Ministérios";

  const build = () => renderCalendarImage({ schedules, ministries, members, ministryIds: selected, year, month, monthLabel, title });
  const fileName = `${title.replace(/[^\p{L}\p{N}]+/gu, "-")}-${prefix}.png`;

  const toBlob = () => new Promise<Blob>(res => build().toBlob(b => res(b!), "image/png"));

  const download = async () => {
    const url = URL.createObjectURL(await toBlob());
    const a = document.createElement("a"); a.href = url; a.download = fileName; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  const exportPdf = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const image = build().toDataURL("image/png");
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title></title>
      <style>
        *{box-sizing:border-box}body{margin:0;background:#f5f4f0;font-family:system-ui,sans-serif}
        img{display:block;width:100%;height:auto;margin:0 auto}
        @media print{body{background:#fff}img{width:auto;max-width:194mm;max-height:277mm}@page{size:A4 portrait;margin:8mm}}
      </style></head><body><img alt="Calendário da escala"></body></html>`);
    printWindow.document.close();
    printWindow.document.title = `${title} - ${monthLabel}`;
    const img = printWindow.document.querySelector("img");
    if (img) {
      img.onload = () => { printWindow.focus(); printWindow.print(); };
      img.src = image;
    }
  };

  const share = async () => {
    const file = new File([await toBlob()], fileName, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title }); } catch { /* cancelado */ }
    } else download();
  };

  const toggle = (id: string) => { setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]); setPreview(null); };
  const selectAll = () => { setSelected(ministries.map(m => m.id)); setPreview(null); };
  const clear = () => { setSelected([]); setPreview(null); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-1.5rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Exportar calendário</DialogTitle>
          <DialogDescription>
            Escolha os ministérios de {monthLabel}. O calendário seguirá o modelo com horários, ministérios e nomes das pessoas.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={selectAll}>Selecionar todos</Button>
          <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={!selected.length}>Limpar seleção</Button>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ministries.map(m => (
            <label key={m.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm">
              <Checkbox checked={selected.includes(m.id)} onCheckedChange={() => toggle(m.id)} />
              <span className="h-3 w-3 rounded-full" style={{ background: `hsl(${getMinistryColor(m.colorIndex)})` }} />
              <span className="flex-1 font-medium">{m.name}</span>
              <span className="text-xs text-muted-foreground">{counts.get(m.id) || 0}</span>
            </label>
          ))}
        </div>
        {preview && <img src={preview} alt={`Prévia do calendário de ${monthLabel}`} className="w-full rounded-lg border" />}
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <Button className="w-full sm:w-auto" variant="ghost" disabled={!selected.length} onClick={() => setPreview(build().toDataURL("image/png"))}>Ver prévia</Button>
          <Button className="w-full gap-1.5 sm:w-auto" variant="outline" disabled={!selected.length} onClick={exportPdf}><FileDown className="h-4 w-4" />Salvar PDF</Button>
          <Button className="w-full gap-1.5 sm:w-auto" variant="outline" disabled={!selected.length} onClick={download}><Download className="h-4 w-4" />Salvar imagem</Button>
          <Button className="w-full gap-1.5 sm:w-auto" disabled={!selected.length} onClick={share}><Share2 className="h-4 w-4" />Enviar no WhatsApp</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Users, Church, LayoutDashboard, User } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useStore } from "@/store/StoreContext";
import { formatDate } from "@/lib/helpers";

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const navigate = useNavigate();
  const { members, ministries, schedules } = useStore();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const upcomingDates = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const dates = Array.from(new Set(schedules.map(s => s.date)))
      .filter(d => d >= today)
      .sort()
      .slice(0, 6);
    return dates;
  }, [schedules]);

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Buscar membros, ministérios, datas…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>Nenhum resultado.</CommandEmpty>

        <CommandGroup heading="Navegar">
          <CommandItem onSelect={() => go("/")}>
            <LayoutDashboard className="mr-2 h-4 w-4" /> Início
          </CommandItem>
          <CommandItem onSelect={() => go("/escalas")}>
            <Calendar className="mr-2 h-4 w-4" /> Escalas
          </CommandItem>
          <CommandItem onSelect={() => go("/membros")}>
            <Users className="mr-2 h-4 w-4" /> Membros
          </CommandItem>
          <CommandItem onSelect={() => go("/ministerios")}>
            <Church className="mr-2 h-4 w-4" /> Ministérios
          </CommandItem>
        </CommandGroup>

        {members.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Membros">
              {members.slice(0, 30).map(m => (
                <CommandItem key={m.id} value={`membro ${m.name}`} onSelect={() => go("/membros")}>
                  <User className="mr-2 h-4 w-4 text-primary" />
                  <span className="truncate">{m.name}</span>
                  {m.phone && <span className="ml-auto text-xs text-muted-foreground">{m.phone}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {ministries.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Ministérios">
              {ministries.map(m => (
                <CommandItem key={m.id} value={`ministerio ${m.name}`} onSelect={() => go("/ministerios")}>
                  <Church className="mr-2 h-4 w-4 text-accent-foreground" />
                  {m.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {upcomingDates.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Próximas datas">
              {upcomingDates.map(d => {
                const count = schedules.filter(s => s.date === d).length;
                return (
                  <CommandItem
                    key={d}
                    value={`data ${d} ${formatDate(d)}`}
                    onSelect={() => go(`/escalas?date=${d}`)}
                  >
                    <Calendar className="mr-2 h-4 w-4 text-emerald-600" />
                    {formatDate(d)}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {count} escala{count !== 1 ? "s" : ""}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

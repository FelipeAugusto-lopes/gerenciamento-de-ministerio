import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { visibleCountForSpace } from "@/lib/calendarCell";

interface FittedRowsProps<T> {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  remainder: (hidden: number) => string;
}

/**
 * Mostra o que cabe na altura da célula.
 * O que não cabe aparece como "e mais N" ou "+N ministérios", sem sumir em silêncio.
 */
export function FittedRows<T>({ items, getKey, renderItem, remainder }: FittedRowsProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const boxRef = useRef({ w: 0, h: 0 });
  const signatureRef = useRef("");
  const [shown, setShown] = useState(items.length);
  const signature = items.map(getKey).join("\n");

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (signatureRef.current !== signature) {
      signatureRef.current = signature;
      boxRef.current = { w: 0, h: 0 };
    }

    const fit = () => {
      if (el.clientHeight === 0) {
        setShown(items.length);
        return;
      }
      const resized = el.clientWidth !== boxRef.current.w || el.clientHeight !== boxRef.current.h;
      boxRef.current = { w: el.clientWidth, h: el.clientHeight };
      if (resized) {
        const row = el.querySelector<HTMLElement>("[data-fit-row]");
        const line = Math.max(row?.offsetHeight ?? 16, 1);
        const estimated = visibleCountForSpace(items.length, el.clientHeight, line, line);
        if (estimated !== shown) {
          setShown(estimated);
          return;
        }
      }
      if (el.scrollHeight > el.clientHeight + 1 && shown > 0) setShown(shown - 1);
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [signature, shown, items.length]);

  const hidden = Math.max(0, items.length - shown);

  return (
    <div ref={ref} className="min-h-0 flex-1 overflow-hidden">
      {items.slice(0, shown).map(item => (
        <div key={getKey(item)} data-fit-row className="break-words text-xs leading-4 text-foreground">
          {renderItem(item)}
        </div>
      ))}
      {hidden > 0 && <p className="text-xs font-medium leading-4 text-muted-foreground">{remainder(hidden)}</p>}
    </div>
  );
}

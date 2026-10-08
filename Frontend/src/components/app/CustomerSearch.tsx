import { useEffect, useRef, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import * as api from "@/api";
import type { Customer } from "@/api";
import { cn } from "@/lib/utils";
import { BalanceBadge, Highlight, Pill } from "./bits";
import { useApp } from "./AppContext";

export function CustomerSearch({ onSelect, autoFocus, placeholder, limit = 8, onQueryChange, allowCreate = true }: {
  onSelect: (c: Customer) => void; autoFocus?: boolean; placeholder?: string; limit?: number;
  onQueryChange?: (q: string) => void; allowCreate?: boolean;
}) {
  const { openMemberForm } = useApp();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Customer[]>([]);
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    api.searchCustomers(q, limit).then((r) => { if (live) { setRes(r); setIdx(0); } });
    return () => { live = false; };
  }, [q, limit]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const showCreate = allowCreate && q.trim().length > 0 && res.length === 0;
  const count = res.length + (showCreate ? 1 : 0);
  const pick = (i: number) => {
    if (i < res.length && res[i]) { onSelect(res[i]!); setQ(""); onQueryChange?.(""); setOpen(false); }
    else if (showCreate) { setOpen(false); openMemberForm({ initialName: q.trim(), onSaved: (c) => { onSelect(c); setQ(""); onQueryChange?.(""); } }); }
  };

  return (
    <div className="relative" ref={box}>
      <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
      <input
        className="field pl-12"
        autoFocus={autoFocus}
        value={q}
        placeholder={placeholder ?? "Naam ya phone likho..."}
        onChange={(e) => { setQ(e.target.value); onQueryChange?.(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, count - 1)); setOpen(true); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
          else if (e.key === "Enter" && open && count) { e.preventDefault(); pick(idx); }
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && q.trim() && count > 0 && (
        <ul className="card-soft absolute z-30 mt-2 w-full overflow-hidden p-1">
          {res.map((c, i) => (
            <li key={c.id}>
              <button type="button" onMouseEnter={() => setIdx(i)} onClick={() => pick(i)}
                className={cn("flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left", idx === i && "bg-tint")}>
                <span className="flex flex-col">
                  <span className="font-semibold"><Highlight text={c.name} q={q} /></span>
                  <span className="text-sm text-muted-foreground"><Highlight text={c.phone} q={q} /></span>
                </span>
                <span className="flex items-center gap-3"><Pill kind={c.type}>{c.type}</Pill><BalanceBadge balance={c.balance} /></span>
              </button>
            </li>
          ))}
          {showCreate && (
            <li>
              <button type="button" onClick={() => pick(res.length)}
                className={cn("flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left font-semibold text-primary", idx === res.length && "bg-tint")}>
                <UserPlus className="size-5" /> + Naya member banao: {q.trim()}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

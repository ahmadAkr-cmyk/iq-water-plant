import { useEffect, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { rs } from "@/lib/format";
import type { Label } from "@/labels";

export function Drop({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M12 2.5c-.3 0-.6.15-.78.4C9.4 5.4 5 11.2 5 15a7 7 0 0 0 14 0c0-3.8-4.4-9.6-6.22-12.1a.97.97 0 0 0-.78-.4Z" />
      <path d="M9 15.5a3 3 0 0 0 3 3" stroke="white" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity=".8" />
    </svg>
  );
}

export function Bi({ l, className, sub }: { l: Label; className?: string; sub?: string }) {
  return (
    <span className={cn("flex flex-col leading-tight", className)}>
      <span>{l.en}</span>
      <span className={cn("text-sm font-normal opacity-75", sub)}>{l.ro}</span>
    </span>
  );
}

export function BalanceBadge({ balance, size = "md" }: { balance: number; size?: "md" | "lg" | "xl" }) {
  const sz = size === "xl" ? "text-[2.4rem]" : size === "lg" ? "text-2xl" : "text-base";
  if (balance > 0) return <span className={cn("font-bold text-udhar tabular", sz)}>Udhar {rs(balance)}</span>;
  if (balance < 0) return <span className={cn("font-bold text-advance tabular", sz)}>Advance {rs(balance)}</span>;
  return (
    <span className={cn("inline-flex items-center gap-1 font-bold text-muted-foreground", sz)}>
      <Check className="size-[1em]" /> Clear
    </span>
  );
}

const pillStyles: Record<string, string> = {
  cash: "bg-muted text-muted-foreground",
  udhar: "bg-udhar-bg text-udhar",
  advance: "bg-advance-bg text-advance",
  cancelled: "border-2 border-udhar text-udhar bg-card",
  active: "bg-advance-bg text-advance",
  neutral: "bg-neutral-badge-bg text-neutral-badge",
  warn: "bg-warning-bg text-warning-text",
};
export function Pill({ kind, children }: { kind: keyof typeof pillStyles | string; children: ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-full px-3 py-0.5 text-sm font-bold capitalize whitespace-nowrap", pillStyles[kind] ?? pillStyles["neutral"])}>{children}</span>;
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("card-soft p-6", className)}>{children}</div>;
}

export function StatCard({ icon, label, value, tone, sub }: { icon: ReactNode; label: Label; value: ReactNode; tone?: "udhar" | "advance"; sub?: ReactNode }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-tint text-primary">{icon}</span>
        <Bi l={label} className="font-semibold" sub="text-muted-foreground" />
      </div>
      <div className={cn("text-[1.8rem] font-bold tabular", tone === "udhar" && "text-udhar", tone === "advance" && "text-advance")}>{value}</div>
      {sub && <div className="text-sm text-muted-foreground">{sub}</div>}
    </Card>
  );
}

export function PageHeader({ title, actions }: { title: Label; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[1.65rem] font-bold text-deep">{title.en}</h1>
        <p className="text-muted-foreground">{title.ro}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">{actions}</div>
    </div>
  );
}

export function EmptyState({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <span className="grid size-24 place-items-center rounded-full bg-tint"><Drop className="size-12 text-wa" /></span>
      <p className="text-lg text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[0.9rem] font-semibold">{label}</span>
      {children}
      {hint && !error && <span className="text-sm text-muted-foreground">{hint}</span>}
      {error && <span className="text-sm font-semibold text-udhar">{error}</span>}
    </label>
  );
}

export function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <b className="font-bold text-primary">{text.slice(i, i + q.length)}</b>
      {text.slice(i + q.length)}
    </>
  );
}

/** Amount input: digits only, thousand separators on blur. */
export function AmountInput({ value, onChange, className, autoFocus, placeholder }: { value: number | null; onChange: (n: number | null) => void; className?: string; autoFocus?: boolean; placeholder?: string }) {
  const [focus, setFocus] = useState(false);
  const shown = value == null ? "" : focus ? String(value) : value.toLocaleString("en-US");
  return (
    <input
      inputMode="numeric"
      autoFocus={autoFocus}
      placeholder={placeholder ?? "0"}
      className={cn("field tabular", className)}
      value={shown}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      onChange={(e) => {
        const d = e.target.value.replace(/\D/g, "");
        onChange(d ? parseInt(d, 10) : null);
      }}
    />
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          className={cn("min-h-14 flex-1 rounded-xl border-2 px-4 font-semibold transition-colors",
            value === o.v ? "border-primary bg-tint text-deep" : "border-input bg-card hover:border-primary")}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

/** Tiny async hook: loads through api, toasts on error. */
export function useApi<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    fn().then((d) => live && setData(d)).catch((e) => toast.error(String(e?.message ?? e)));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, reload: () => setTick((t) => t + 1) };
}

export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />)}
    </div>
  );
}

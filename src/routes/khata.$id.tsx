import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { HandCoins, Pencil, PiggyBank, Printer, ShoppingCart } from "lucide-react";
import * as api from "@/api";
import type { LedgerEntry } from "@/api";
import { cn } from "@/lib/utils";
import { fmtDate, fmtTime, itemsShort, presetRange, rs, type Preset } from "@/lib/format";
import { BalanceBadge, Card, Loading, Pill, useApi } from "@/components/app/bits";
import { WhatsAppButton } from "@/components/app/WhatsAppButton";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { useApp } from "@/components/app/AppContext";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/khata/$id")({
  head: () => ({
    meta: [
      { title: "Member Khata — IQ Waterland" },
      { name: "description", content: "Member ka poora hisaab, payments aur sales." },
      { property: "og:title", content: "Member Khata — IQ Waterland" },
      { property: "og:description", content: "Full ledger for one member." },
    ],
  }),
  component: Member,
});

function Member() {
  const { id } = Route.useParams();
  const { version, bump, openPayment, openMemberForm, wa, settings } = useApp();
  const [preset, setPreset] = useState<Preset>("all");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [deact, setDeact] = useState(false);
  const { data: c } = useApi(() => api.getCustomer(id), [id, version]);
  const range = presetRange(preset, custom);
  const { data: ledger } = useApi(() => api.getLedger(id, range), [id, version, preset, custom.from, custom.to]);
  const { data: sales } = useApi(() => api.listSales({ customerId: id }), [id, version]);

  if (!c) return <Loading rows={5} />;
  const saleOf = (e: LedgerEntry) => sales?.find((s) => s.id === e.saleId);
  const details = (e: LedgerEntry) => {
    const s = saleOf(e);
    if (e.kind === "sale") return `Sale: ${s ? itemsShort(s.items) : ""}${s?.deliveryFee ? " + delivery" : ""}`;
    if (e.kind === "payment") return `Payment received - ${e.method ?? "Cash"}`;
    if (e.kind === "advance") return "Advance jama";
    if (e.kind === "opening") return "Opening balance";
    return "Sale cancelled";
  };
  const rowMsg = (e: LedgerEntry) => {
    const s = saleOf(e);
    if (e.kind === "sale" && s) return wa(c.phone, "sale", { customerName: c.name, date: s.createdAt, items: s.items, deliveryFee: s.deliveryFee, total: s.total, balance: e.runningBalance });
    if (e.kind === "advance") return wa(c.phone, "advance", { customerName: c.name, date: e.createdAt, amount: -e.amount, balance: e.runningBalance });
    if (e.kind === "payment") return wa(c.phone, "payment", { customerName: c.name, date: e.createdAt, amount: -e.amount, balance: e.runningBalance });
    return wa(c.phone, "reminder", { customerName: c.name, balance: e.runningBalance });
  };
  const statement = () => {
    const last = (ledger ?? []).slice(0, 10).map((e) => `${fmtDate(e.createdAt)}: ${details(e)} ${e.amount > 0 ? "+" : "-"}Rs ${Math.abs(e.amount)}`).join("\n");
    api.openWhatsApp(c.phone, `Assalam o Alaikum ${c.name},\nAapka hisaab:\n${last}\n\n${api.balanceLine(c.balance)}\nShukriya - ${settings?.businessName ?? "IQ Waterland"}`);
  };

  return (
    <div className="print-area flex flex-col gap-6">
      <Card className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <h1 className="text-[1.65rem] font-bold text-deep">{c.name} {!c.active && <Pill kind="cancelled">Inactive</Pill>}</h1>
          <p className="text-muted-foreground">{c.phone}{c.address && ` · ${c.address}`}</p>
          <div className="mt-2 flex gap-2"><Pill kind={c.type}>{c.type}</Pill>{c.cycle && <Pill kind="neutral">{c.cycle}</Pill>}{c.creditLimit != null && <Pill kind="warn">Limit {rs(c.creditLimit)}</Pill>}</div>
        </div>
        <div className="text-right"><div className="text-muted-foreground">Current balance</div><BalanceBadge balance={c.balance} size="xl" /></div>
      </Card>

      <div className="no-print flex flex-wrap gap-3">
        <Button onClick={() => openPayment({ customer: c })}><HandCoins /> Receive Payment</Button>
        <Button variant="outline" onClick={() => openPayment({ customer: c, mode: "advance" })}><PiggyBank /> Add Advance</Button>
        <Button variant="outline" asChild><Link to="/sale/new" search={{ customerId: c.id }}><ShoppingCart /> New Sale</Link></Button>
        <WhatsAppButton phone={c.phone} label="WhatsApp Reminder" onClick={() => wa(c.phone, "reminder", { customerName: c.name, balance: c.balance })} />
        <Button variant="outline" onClick={() => openMemberForm({ member: c })}><Pencil /> Edit</Button>
        {c.active ? <Button variant="ghost" className="text-udhar" onClick={() => setDeact(true)}>Deactivate member</Button>
          : <Button variant="ghost" onClick={async () => { await api.setCustomerActive(c.id, true); toast.success("Member chalu ho gaya"); bump(); }}>Activate member</Button>}
      </div>

      <Card className="p-0">
        <div className="no-print flex flex-wrap items-center gap-2 border-b p-4">
          {(["today", "7d", "month", "all", "custom"] as Preset[]).map((p) => (
            <button key={p} onClick={() => setPreset(p)} className={cn("min-h-11 rounded-full border-2 px-4 font-semibold", preset === p ? "border-primary bg-tint" : "border-input")}>
              {{ today: "Today", "7d": "7 days", month: "This month", all: "All", custom: "Custom", yesterday: "" }[p]}
            </button>
          ))}
          {preset === "custom" && <>
            <input type="date" className="field w-44" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
            <input type="date" className="field w-44" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
          </>}
          <div className="ml-auto flex gap-2">
            <WhatsAppButton phone={c.phone} label="Send statement" onClick={statement} />
            <Button variant="outline" onClick={() => window.print()}><Printer /> Print statement</Button>
          </div>
        </div>
        {!ledger ? <div className="p-6"><Loading /></div> : (
          <table className="w-full">
            <thead className="border-b text-left text-sm text-muted-foreground">
              <tr><th className="p-4">Date</th><th>Details</th><th className="text-right">Debit</th><th className="text-right">Credit</th><th className="text-right">Running Balance</th><th className="no-print w-16" /></tr>
            </thead>
            <tbody className="divide-y">
              {ledger.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Is waqt mein koi entry nahi</td></tr>}
              {ledger.map((e) => {
                const cancelled = e.kind === "sale" && saleOf(e)?.status === "cancelled";
                return (
                  <tr key={e.id}>
                    <td className="p-4"><div>{fmtDate(e.createdAt)}</div><div className="text-sm text-muted-foreground">{fmtTime(e.createdAt)}</div></td>
                    <td><span className={cn(cancelled && "line-through opacity-60")}>{details(e)}</span> {cancelled && <Pill kind="cancelled">Cancelled</Pill>}{e.note && <div className="text-sm text-muted-foreground">{e.note}</div>}</td>
                    <td className="text-right font-semibold text-udhar tabular">{e.amount > 0 ? rs(e.amount) : ""}</td>
                    <td className="text-right font-semibold text-advance tabular">{e.amount < 0 ? rs(e.amount) : ""}</td>
                    <td className="text-right"><BalanceBadge balance={e.runningBalance} /></td>
                    <td className="no-print pr-2"><WhatsAppButton icon phone={c.phone} onClick={() => rowMsg(e)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
      <ConfirmDialog open={deact} destructive title="Member band karein?" message={`${c.name} list se hat jayega, lekin hisaab mehfooz rahega.`}
        onClose={() => setDeact(false)} onConfirm={async () => { await api.setCustomerActive(c.id, false); toast.success("Member band ho gaya"); setDeact(false); bump(); }} />
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, Printer, XCircle } from "lucide-react";
import * as api from "@/api";
import type { Customer, PaymentType, Sale } from "@/api";
import { labels } from "@/labels";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDateTime, fmtTime, itemsShort, presetRange, rs, type Preset } from "@/lib/format";
import { Card, EmptyState, Loading, PageHeader, Pill, useApi } from "@/components/app/bits";
import { CustomerSearch } from "@/components/app/CustomerSearch";
import { WhatsAppButton } from "@/components/app/WhatsAppButton";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { Receipt } from "@/components/app/Receipt";
import { useApp } from "@/components/app/AppContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/sales")({
  validateSearch: (s: Record<string, unknown>): { bill?: string } => (typeof s["bill"] === "string" ? { bill: s["bill"] } : {}),
  head: () => ({
    meta: [
      { title: "Sale History — IQ Waterland" },
      { name: "description", content: "Purani sales dekho, print karo ya cancel karo." },
      { property: "og:title", content: "Sale History — IQ Waterland" },
      { property: "og:description", content: "Browse, print or cancel past sales." },
    ],
  }),
  component: Sales,
});

function Sales() {
  const { bill } = Route.useSearch();
  const { version, bump, wa, settings } = useApp();
  const [preset, setPreset] = useState<Preset>(bill ? "all" : "7d");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [cust, setCust] = useState<Customer | null>(null);
  const [pt, setPt] = useState<PaymentType | "all">("all");
  const [st, setSt] = useState<"all" | "active" | "cancelled">("all");
  const [view, setView] = useState<Sale | null>(null);
  const [cancel, setCancel] = useState<Sale | null>(null);
  const [printSale, setPrintSale] = useState<Sale | null>(null);
  const r = presetRange(preset, custom);
  const { data } = useApi(() => api.listSales({ ...r, customerId: cust?.id, paymentType: pt, status: st }), [preset, custom.from, custom.to, cust?.id, pt, st, version]);
  const { data: viewFromBill } = useApi(async () => (bill ? (await api.listSales({})).find((s) => s.billNo === bill) ?? null : null), [bill]);
  const shownView = view ?? (viewFromBill && !closedBill(bill) ? viewFromBill : null);

  const active = (data ?? []).filter((s) => s.status === "active");
  const print = (s: Sale) => { setPrintSale(s); setTimeout(() => window.print(), 200); };
  const sendWa = async (s: Sale) => {
    if (!s.customerId) return;
    const c = await api.getCustomer(s.customerId);
    wa(c.phone, "sale", { customerName: c.name, date: s.createdAt, items: s.items, deliveryFee: s.deliveryFee, total: s.total, balance: c.balance });
  };
  const [phones, setPhones] = useState<Record<string, string>>({});
  useApi(async () => { const cs = await api.listCustomers({ includeInactive: true }); setPhones(Object.fromEntries(cs.map((c) => [c.id, c.phone]))); return null; }, [version]);

  return (
    <div>
      <PageHeader title={labels.sales.title} />
      <Card className="mb-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {(["today", "yesterday", "7d", "month", "all", "custom"] as Preset[]).map((p) => (
            <button key={p} onClick={() => setPreset(p)} className={cn("min-h-12 rounded-full border-2 px-4 font-semibold", preset === p ? "border-primary bg-tint" : "border-input")}>
              {{ today: "Today", yesterday: "Yesterday", "7d": "Last 7 days", month: "This month", all: "All", custom: "Custom" }[p]}
            </button>
          ))}
          {preset === "custom" && <>
            <input type="date" className="field w-44" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
            <input type="date" className="field w-44" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
          </>}
        </div>
        <div className="grid grid-cols-[2fr_1fr_1fr] gap-4">
          {cust ? (
            <div className="flex min-h-14 items-center justify-between rounded-xl bg-tint px-4"><b>{cust.name}</b><button className="font-semibold text-primary underline" onClick={() => setCust(null)}>Clear</button></div>
          ) : <CustomerSearch allowCreate={false} onSelect={setCust} placeholder="Customer se filter karo..." />}
          <select className="field" value={pt} onChange={(e) => setPt(e.target.value as typeof pt)}>
            <option value="all">All payments</option><option value="cash">Cash</option><option value="udhar">Udhar</option><option value="advance">Advance</option>
          </select>
          <select className="field" value={st} onChange={(e) => setSt(e.target.value as typeof st)}>
            <option value="all">All status</option><option value="active">Active</option><option value="cancelled">Cancelled</option>
          </select>
        </div>
      </Card>
      <div className="mb-4 flex gap-8 rounded-2xl bg-tint px-6 py-4 text-lg">
        <span>Sales: <b className="tabular">{active.length}</b></span>
        <span>Total: <b className="tabular text-deep">{rs(active.reduce((a, s) => a + s.total, 0))}</b></span>
      </div>
      <Card className="p-0">
        {!data ? <div className="p-6"><Loading /></div> : data.length === 0 ? <EmptyState text="Is waqt mein koi sale nahi" /> : (
          <table className="w-full">
            <thead className="border-b text-left text-sm text-muted-foreground">
              <tr><th className="p-4">Bill no</th><th>Date</th><th>Customer</th><th>Items</th><th className="text-right">Delivery</th><th className="text-right">Total</th><th className="pl-4">Payment</th><th>Status</th><th className="pr-4 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y">
              {data.map((s) => {
                const x = s.status === "cancelled";
                return (
                  <tr key={s.id} className={cn(x && "text-muted-foreground")}>
                    <td className={cn("p-4 font-semibold", x && "line-through")}>{s.billNo}</td>
                    <td><div>{fmtDate(s.createdAt)}</div><div className="text-sm text-muted-foreground">{fmtTime(s.createdAt)}</div></td>
                    <td className={cn(x && "line-through")}>{s.customerName}</td>
                    <td className={cn(x && "line-through")}>{itemsShort(s.items)}</td>
                    <td className="text-right tabular">{s.deliveryFee ? rs(s.deliveryFee) : "—"}</td>
                    <td className={cn("text-right font-bold tabular", x && "line-through")}>{rs(s.total)}</td>
                    <td className="pl-4"><Pill kind={s.paymentType}>{s.paymentType}</Pill></td>
                    <td>{x ? <Pill kind="cancelled">Cancelled</Pill> : <Pill kind="active">Active</Pill>}</td>
                    <td className="pr-4"><div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="View" onClick={() => setView(s)}><Eye /></Button>
                      <Button variant="ghost" size="icon" title="Print" onClick={() => print(s)}><Printer /></Button>
                      <WhatsAppButton icon phone={s.customerId ? phones[s.customerId] : null} onClick={() => sendWa(s)} />
                      <Button variant="ghost" size="icon" title="Cancel" disabled={x} className="text-udhar" onClick={() => setCancel(s)}><XCircle /></Button>
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Dialog open={!!shownView} onOpenChange={(o) => { if (!o) { setView(null); markClosed(bill); } }}>
        <DialogContent className="max-w-md rounded-2xl p-8">
          <DialogTitle className="text-2xl text-deep">Bill {shownView?.billNo}</DialogTitle>
          {shownView && (
            <div className="flex flex-col gap-2">
              <div className="text-muted-foreground">{fmtDateTime(shownView.createdAt)} · {shownView.customerName}</div>
              {shownView.items.map((i) => <div key={i.productId} className="flex justify-between"><span>{i.name} x {i.qty} @ {rs(i.unitPrice)}</span><span>{rs(i.lineTotal)}</span></div>)}
              {shownView.deliveryFee > 0 && <div className="flex justify-between"><span>Delivery</span><span>{rs(shownView.deliveryFee)}</span></div>}
              <div className="flex justify-between border-t pt-2 text-xl font-bold"><span>Total</span><span>{rs(shownView.total)}</span></div>
              <div className="flex gap-2"><Pill kind={shownView.paymentType}>{shownView.paymentType}</Pill>{shownView.status === "cancelled" && <Pill kind="cancelled">Cancelled: {shownView.cancelReason}</Pill>}</div>
              {shownView.note && <p className="text-muted-foreground">{shownView.note}</p>}
              <Button variant="outline" className="mt-2" onClick={() => print(shownView)}><Printer /> Print</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!cancel} destructive requireReason confirmLabel="Sale cancel karo" title={`Bill ${cancel?.billNo} cancel karein?`}
        message="Sale history mein rahegi lekin cancelled likhi jayegi. Agar udhar/advance tha to balance wapas ho jayega."
        onClose={() => setCancel(null)}
        onConfirm={async (reason) => { await api.cancelSale(cancel!.id, reason); toast.success("Sale cancel ho gayi"); setCancel(null); bump(); }} />
      {printSale && <Receipt sale={printSale} businessName={settings?.businessName ?? "IQ Waterland"} />}
    </div>
  );
}

const closed = new Set<string>();
function closedBill(b?: string) { return !b || closed.has(b); }
function markClosed(b?: string) { if (b) closed.add(b); }

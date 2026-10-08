import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Minus, Pencil, Plus, Printer, Star } from "lucide-react";
import * as api from "@/api";
import type { Customer, PaymentType, Product, Sale } from "@/api";
import { labels } from "@/labels";
import { cn } from "@/lib/utils";
import { rs, toLocalInput } from "@/lib/format";
import { AmountInput, BalanceBadge, Bi, Card, Field, Pill } from "@/components/app/bits";
import { CustomerSearch } from "@/components/app/CustomerSearch";
import { WhatsAppButton } from "@/components/app/WhatsAppButton";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { Receipt } from "@/components/app/Receipt";
import { useApp } from "@/components/app/AppContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/sale/new")({
  validateSearch: (s: Record<string, unknown>): { customerId?: string } => (typeof s["customerId"] === "string" ? { customerId: s["customerId"] } : {}),
  head: () => ({
    meta: [
      { title: "New Sale — IQ Waterland" },
      { name: "description", content: "Nayi sale banao: bottlein, delivery aur payment." },
      { property: "og:title", content: "New Sale — IQ Waterland" },
      { property: "og:description", content: "Create a new water bottle sale." },
    ],
  }),
  component: NewSale,
});

type Line = { qty: number; price: number; editing?: boolean };

function NewSale() {
  const { customerId } = Route.useSearch();
  const { settings, bump, wa } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lines, setLines] = useState<Record<string, Line>>({});
  const [delivery, setDelivery] = useState(false);
  const [fee, setFee] = useState<number | null>(30);
  const [pay, setPay] = useState<PaymentType>("cash");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => toLocalInput(new Date().toISOString()));
  const [limitAsk, setLimitAsk] = useState<null | "wa" | "print" | "plain">(null);
  const [done, setDone] = useState<{ sale: Sale; balance: number | null } | null>(null);

  const reset = (ps = products) => {
    setLines(Object.fromEntries(ps.map((p) => [p.id, { qty: p.isDefault ? 1 : 0, price: p.price }])));
    setNote("");
    setDate(toLocalInput(new Date().toISOString()));
  };
  useEffect(() => { api.listProducts().then((ps) => { setProducts(ps); reset(ps); }); }, []); // eslint-disable-line
  useEffect(() => { if (customerId) api.getCustomer(customerId).then(choose).catch(() => {}); }, [customerId]); // eslint-disable-line
  useEffect(() => { if (settings) setFee(settings.deliveryFee); }, [settings]);

  function choose(c: Customer | null) {
    setCustomer(c);
    setDelivery(!!c?.usuallyDelivery);
    setPay(!c || c.type === "cash" ? "cash" : c.type === "advance" && c.balance < 0 ? "advance" : c.type === "advance" ? "cash" : "udhar");
  }

  const items = products.filter((p) => (lines[p.id]?.qty ?? 0) > 0).map((p) => ({ p, ...lines[p.id]! }));
  const subtotal = items.reduce((a, i) => a + i.qty * i.price, 0);
  const deliveryFee = delivery ? fee ?? 0 : 0;
  const total = subtotal + deliveryFee;
  const balance = customer?.balance ?? 0;
  const after = customer && pay !== "cash" ? balance + total : balance;
  const advLow = pay === "advance" && -balance < total;
  const overLimit = pay === "udhar" && customer?.creditLimit != null && after > customer.creditLimit;

  const setQty = (id: string, q: number) => setLines((l) => ({ ...l, [id]: { ...l[id]!, qty: Math.max(0, q) } }));

  const save = async (then: "wa" | "print" | "plain", force = false) => {
    if (!items.length) return;
    if (overLimit && !force) return setLimitAsk(then);
    try {
      const sale = await api.createSale({
        customerId: customer?.id ?? null, items: items.map((i) => ({ productId: i.p.id, qty: i.qty, unitPrice: i.price })),
        deliveryFee, paymentType: pay, note, createdAt: new Date(date).toISOString(),
      });
      const bal = customer ? (await api.getCustomer(customer.id)).balance : null;
      toast.success(`Sale save ho gayi — ${sale.billNo}`);
      bump();
      setDone({ sale, balance: bal });
      if (customer?.phone && (then === "wa" || settings?.autoOpenWhatsApp)) sendWa(sale, bal);
      if (then === "print") setTimeout(() => window.print(), 300);
      if (customer) setCustomer({ ...customer, balance: bal ?? 0 });
      reset();
    } catch (e) { toast.error(String(e)); }
  };
  const sendWa = (sale: Sale, bal: number | null) =>
    customer && wa(customer.phone, "sale", { customerName: customer.name, date: sale.createdAt, items: sale.items, deliveryFee: sale.deliveryFee, total: sale.total, balance: bal ?? 0 });

  const payCards = useMemo(() => [
    { v: "cash" as const, t: "Cash", s: "abhi paisa mila", dis: false, hint: "" },
    { v: "udhar" as const, t: "Udhar", s: "baad mein dega", dis: !customer, hint: "Pehle member select karo" },
    { v: "advance" as const, t: "Advance se kato", s: "advance balance se", dis: !customer || balance >= 0, hint: !customer ? "Pehle member select karo" : "Advance balance nahi hai" },
  ], [customer, balance]);

  return (
    <div className="grid grid-cols-[62fr_38fr] items-start gap-6">
      <div className="flex flex-col gap-6">
        <Card>
          <Step n={1} l={labels.sale.customer} />
          {customer ? (
            <div className="flex items-center justify-between rounded-xl bg-tint p-4">
              <div>
                <div className="text-lg font-bold">{customer.name}</div>
                <div className="flex items-center gap-3 text-muted-foreground">{customer.phone}<Pill kind={customer.type}>{customer.type}</Pill></div>
              </div>
              <div className="flex items-center gap-4"><BalanceBadge balance={customer.balance} size="lg" />
                <button className="font-semibold text-primary underline" onClick={() => choose(null)}>Change</button></div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <CustomerSearch onSelect={choose} />
              <p className="text-muted-foreground">Abhi: <b>Walk-in / Cash customer</b></p>
            </div>
          )}
        </Card>

        <Card>
          <Step n={2} l={labels.sale.bottles} />
          <div className="grid grid-cols-2 gap-4">
            {products.map((p) => {
              const ln = lines[p.id] ?? { qty: 0, price: p.price };
              const sel = ln.qty > 0;
              return (
                <div key={p.id} onClick={() => setQty(p.id, ln.qty + 1)} role="button"
                  className={cn("relative cursor-pointer rounded-2xl border-2 p-5 transition-colors", sel ? "border-wa bg-tint" : "border-input bg-card hover:border-primary")}>
                  {p.isDefault && <span className="absolute -top-3 left-4 flex items-center gap-1 rounded-full bg-primary px-3 py-0.5 text-sm font-bold text-primary-foreground"><Star className="size-3.5" /> Most used</span>}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xl font-bold">{p.name}</div>
                      {ln.editing ? (
                        <div onClick={(e) => e.stopPropagation()} className="mt-1 w-32">
                          <AmountInput value={ln.price} autoFocus onChange={(v) => setLines((l) => ({ ...l, [p.id]: { ...ln, price: v ?? 0 } }))} />
                        </div>
                      ) : <div className={cn("text-muted-foreground", ln.price !== p.price && "font-bold text-warning-text")}>{rs(ln.price)} each</div>}
                    </div>
                    {sel && (
                      <button className="rounded-lg p-2 hover:bg-card" aria-label="Rate badlo" onClick={(e) => { e.stopPropagation(); setLines((l) => ({ ...l, [p.id]: { ...ln, editing: !ln.editing } })); }}>
                        <Pencil className="size-5 text-primary" />
                      </button>
                    )}
                  </div>
                  <div className="mt-4 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                    <Button variant="outline" size="icon" className="size-14" onClick={() => setQty(p.id, ln.qty - 1)} aria-label="Kam"><Minus /></Button>
                    <span className="text-[2.2rem] font-bold tabular">{ln.qty}</span>
                    <Button size="icon" className="size-14" onClick={() => setQty(p.id, ln.qty + 1)} aria-label="Zyada"><Plus /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <Step n={3} l={labels.sale.delivery} />
          <label className="flex min-h-16 cursor-pointer items-center justify-between rounded-xl border-2 border-input px-5">
            <span className="text-lg font-semibold">Delivery? / Delivery chahiye? <span className="text-muted-foreground">(+ {rs(fee ?? 0)})</span></span>
            <Switch checked={delivery} onCheckedChange={setDelivery} className="scale-150" />
          </label>
          {delivery && <div className="mt-4 w-48"><Field label="Delivery fee (Rs)"><AmountInput value={fee} onChange={setFee} /></Field></div>}
        </Card>

        <Card>
          <Step n={4} l={labels.sale.payment} />
          <div className="grid grid-cols-3 gap-4">
            {payCards.map((c) => (
              <button key={c.v} disabled={c.dis} onClick={() => setPay(c.v)} title={c.dis ? c.hint : ""}
                className={cn("min-h-24 rounded-2xl border-2 p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  pay === c.v ? "border-primary bg-tint" : "border-input hover:border-primary")}>
                <div className="text-lg font-bold">{c.t}</div>
                <div className="text-sm text-muted-foreground">{c.dis ? c.hint : c.s}</div>
              </button>
            ))}
          </div>
          {advLow && <Warn>Advance kam hai, baqi udhar ban jayega</Warn>}
          {overLimit && <Warn>Udhar limit se zyada ho jayega (limit {rs(customer!.creditLimit!)})</Warn>}
          <div className="mt-5 grid grid-cols-[2fr_1fr] gap-4">
            <Field label="Note" hint="Koi baat (optional)"><input className="field" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            <Field label="Date / time"><input type="datetime-local" className="field" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          </div>
        </Card>
      </div>

      <Card className="sticky top-24 flex flex-col gap-4">
        <Bi l={labels.sale.summary} className="text-[1.2rem] font-bold text-deep" sub="text-muted-foreground" />
        <div className="flex flex-col gap-2">
          {items.length === 0 && <p className="text-muted-foreground">Koi bottle nahi chuni</p>}
          {items.map((i) => (
            <div key={i.p.id} className="flex justify-between"><span>{i.p.name} x {i.qty}</span><span className="tabular">{rs(i.qty * i.price)}</span></div>
          ))}
          {delivery && <div className="flex justify-between"><span>Delivery</span><span className="tabular">{rs(deliveryFee)}</span></div>}
        </div>
        <div className="border-t pt-4">
          <div className="text-muted-foreground">TOTAL</div>
          <div className="text-[2.45rem] font-bold tabular text-deep">{rs(total)}</div>
        </div>
        {customer && (
          <div className="rounded-xl bg-muted p-3">
            <div className="text-sm text-muted-foreground">Is sale ke baad balance:</div>
            <BalanceBadge balance={after} size="lg" />
          </div>
        )}
        <Button size="lg" className="min-h-16 w-full text-xl" disabled={!items.length} onClick={() => save("plain")}>SAVE SALE</Button>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="whatsapp" disabled={!items.length || !customer?.phone} onClick={() => save("wa")}>Save + WhatsApp</Button>
          <Button variant="outline" disabled={!items.length} onClick={() => save("print")}><Printer /> Save + Print</Button>
        </div>
      </Card>

      <ConfirmDialog open={!!limitAsk} title="Udhar limit se zyada" message="Is sale ke baad udhar limit se zyada ho jayega. Phir bhi save karein?" confirmLabel="Continue"
        onClose={() => setLimitAsk(null)} onConfirm={() => { const t = limitAsk!; setLimitAsk(null); save(t, true); }} />

      <Dialog open={!!done} onOpenChange={(o) => !o && setDone(null)}>
        <DialogContent className="max-w-md rounded-2xl p-8 text-center">
          <DialogTitle className="sr-only">Sale saved</DialogTitle>
          {done && (
            <div className="flex flex-col items-center gap-3">
              <CheckCircle2 className="size-20 text-wa" />
              <div className="text-xl font-bold">Sale save ho gayi</div>
              <div className="text-muted-foreground">Bill {done.sale.billNo}</div>
              <div className="text-[2.2rem] font-bold tabular">{rs(done.sale.total)}</div>
              <div className="flex w-full flex-col gap-3">
                {customer?.phone && <WhatsAppButton phone={customer.phone} label="WhatsApp bhejo" onClick={() => sendWa(done.sale, done.balance)} />}
                <Button variant="outline" onClick={() => window.print()}><Printer /> Print</Button>
                <Button onClick={() => { setDone(null); choose(null); }}>Nayi Sale</Button>
              </div>
              <Receipt sale={done.sale} businessName={settings?.businessName ?? "IQ Waterland"} balance={done.balance} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Step({ n, l }: { n: number; l: { en: string; ro: string } }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="grid size-9 place-items-center rounded-full bg-primary font-bold text-primary-foreground">{n}</span>
      <Bi l={l} className="text-[1.2rem] font-bold text-deep" sub="text-muted-foreground" />
    </div>
  );
}
function Warn({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 flex items-center gap-3 rounded-xl bg-warning-bg p-4 font-semibold text-warning-text"><AlertTriangle className="size-6 text-warning" />{children}</div>;
}

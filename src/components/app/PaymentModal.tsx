import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import * as api from "@/api";
import type { Customer } from "@/api";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toLocalInput } from "@/lib/format";
import { AmountInput, BalanceBadge, Field } from "./bits";
import { CustomerSearch } from "./CustomerSearch";
import { WhatsAppButton } from "./WhatsAppButton";
import { useApp } from "./AppContext";

const METHODS = ["Cash", "JazzCash", "Easypaisa", "Bank"];

export function PaymentModal({ customer: initial, mode, onClose, onSaved }: { customer: Customer | null; mode: "payment" | "advance"; onClose: () => void; onSaved: () => void }) {
  const { wa } = useApp();
  const [customer, setCustomer] = useState<Customer | null>(initial);
  const [amount, setAmount] = useState<number | null>(null);
  const [method, setMethod] = useState("Cash");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(toLocalInput(new Date().toISOString()));
  const [done, setDone] = useState<{ amount: number; balance: number; at: string } | null>(null);
  const isAdv = mode === "advance";
  const after = (customer?.balance ?? 0) - (amount ?? 0);

  const save = async () => {
    if (!customer || !amount || amount <= 0) return;
    const at = new Date(date).toISOString();
    try {
      const e = isAdv
        ? await api.addAdvance({ customerId: customer.id, amount, method, note, createdAt: at })
        : await api.addPayment({ customerId: customer.id, amount, method, note, createdAt: at });
      toast.success(isAdv ? "Advance jama ho gaya" : "Payment mil gayi");
      setDone({ amount, balance: e.runningBalance, at });
      onSaved();
    } catch (err) { toast.error(String(err)); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl rounded-2xl p-8">
        <DialogTitle className="text-2xl text-deep">{isAdv ? "Add Advance / Advance Jama" : "Receive Payment / Payment Lo"}</DialogTitle>
        {done ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <CheckCircle2 className="size-16 text-wa" />
            <p className="text-xl font-semibold">Rs {done.amount.toLocaleString("en-US")} {isAdv ? "advance jama" : "wasool"} — {customer!.name}</p>
            <BalanceBadge balance={done.balance} size="lg" />
            <div className="flex w-full gap-3">
              <WhatsAppButton phone={customer!.phone} label="WhatsApp rasid bhejo" className="flex-1"
                onClick={() => wa(customer!.phone, isAdv ? "advance" : "payment", { customerName: customer!.name, amount: done.amount, balance: done.balance, date: done.at })} />
              <Button className="flex-1" onClick={onClose}>Theek hai</Button>
            </div>
          </div>
        ) : !customer ? (
          <Field label="Customer" hint="Pehle member chuno">
            <CustomerSearch autoFocus onSelect={setCustomer} allowCreate={false} />
          </Field>
        ) : (
          <div className="grid gap-5">
            <div className="flex items-center justify-between rounded-xl bg-tint px-4 py-3">
              <span className="font-semibold">{customer.name}</span>
              {!initial && <button className="text-sm font-semibold text-primary underline" onClick={() => setCustomer(null)}>Change</button>}
            </div>
            <Field label="Amount (Rs)" hint="Kitne paise mile">
              <AmountInput value={amount} onChange={setAmount} autoFocus className="min-h-20 text-[2.2rem] font-bold" />
            </Field>
            <div className="flex flex-wrap gap-2">
              {METHODS.map((m) => (
                <button key={m} type="button" onClick={() => setMethod(m)}
                  className={cn("min-h-12 rounded-full border-2 px-5 font-semibold", method === m ? "border-primary bg-tint text-deep" : "border-input")}>{m}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 rounded-xl border p-4">
              <div><div className="text-sm text-muted-foreground">Balance before / Pehle</div><BalanceBadge balance={customer.balance} size="lg" /></div>
              <div><div className="text-sm text-muted-foreground">Balance after / Baad mein</div><BalanceBadge balance={after} size="lg" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Note"><input className="field" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
              <Field label="Date"><input type="datetime-local" className="field" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            </div>
            <Button size="lg" disabled={!amount} onClick={save}>{isAdv ? "Advance jama karo" : "Payment save karo"}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

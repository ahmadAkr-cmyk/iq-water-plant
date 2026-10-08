import { useEffect, useState } from "react";
import { toast } from "sonner";
import * as api from "@/api";
import type { Customer, CustomerType, Cycle } from "@/api";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AmountInput, Field, Segmented } from "./bits";
import { ConfirmDialog } from "./ConfirmDialog";

const phoneOk = (p: string) => /^(03\d{2}-?\d{7}|\+?92\s?3\d{2}\s?\d{7})$/.test(p.trim());

export function MemberFormModal({ member, initialName, onSaved, onClose }: { member: Customer | null; initialName?: string; onSaved: (c: Customer) => void; onClose: () => void }) {
  const edit = !!member;
  const [name, setName] = useState(member?.name ?? initialName ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [address, setAddress] = useState(member?.address ?? "");
  const [type, setType] = useState<CustomerType>(member?.type ?? "udhar");
  const [cycle, setCycle] = useState<NonNullable<Cycle>>(member?.cycle ?? "monthly");
  const [limit, setLimit] = useState<number | null>(member?.creditLimit ?? null);
  const [openAmt, setOpenAmt] = useState<number | null>(null);
  const [openAdv, setOpenAdv] = useState(false);
  const [advAmt, setAdvAmt] = useState<number | null>(null);
  const [delivery, setDelivery] = useState(member?.usuallyDelivery ?? false);
  const [notes, setNotes] = useState(member?.notes ?? "");
  const [tried, setTried] = useState(false);
  const [dupe, setDupe] = useState(false);
  const [confirmDeact, setConfirmDeact] = useState(false);

  useEffect(() => {
    const p = phone.replace(/\D/g, "");
    if (p.length < 10) return setDupe(false);
    api.listCustomers({ includeInactive: true }).then((all) => setDupe(all.some((c) => c.id !== member?.id && c.phone.replace(/\D/g, "").endsWith(p.slice(-10)))));
  }, [phone, member?.id]);

  const errName = name.trim().length < 2 ? "Naam kam az kam 2 harf ka ho" : "";
  const needPhone = type !== "cash";
  const errPhone = needPhone && !phone.trim() ? "Udhar/Advance ke liye phone zaroori hai" : phone.trim() && !phoneOk(phone) ? "Number aisa likho: 0300-1234567" : "";

  const save = async () => {
    setTried(true);
    if (errName || errPhone) return;
    const base = { name: name.trim(), phone: phone.trim(), address, type, cycle: type === "cash" ? null : cycle, creditLimit: type === "udhar" ? limit : null, usuallyDelivery: delivery, notes };
    try {
      const c = edit
        ? await api.updateCustomer(member!.id, base)
        : await api.createCustomer({ ...base, openingBalance: openAmt ? { amount: openAmt, kind: openAdv ? "advance" : "udhar" } : null, advanceAmount: type === "advance" ? advAmt : null });
      toast.success(edit ? "Member update ho gaya" : "Naya member ban gaya");
      onSaved(c);
    } catch (e) { toast.error(String(e)); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-2xl p-8">
        <DialogTitle className="text-2xl text-deep">{edit ? "Edit Member / Member tabdeel karo" : "New Member / Naya Member"}</DialogTitle>
        <div className="grid gap-5">
          <Field label="Full name *" hint="Poora naam" error={tried ? errName : ""}>
            <input className="field" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={`Phone (WhatsApp)${needPhone ? " *" : ""}`} hint={dupe ? "⚠ Ye number pehle se kisi member ka hai" : "03XX-XXXXXXX ya +92 3XX XXXXXXX"} error={tried ? errPhone : ""}>
            <input className="field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0300-1234567" />
          </Field>
          <Field label="Area / Address" hint="Ilaqa ya pata (optional)">
            <input className="field" value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
          <Field label="Type *" hint="Grahak ki qisam">
            <Segmented value={type} onChange={setType} options={[{ v: "cash", l: "Cash" }, { v: "udhar", l: "Udhar" }, { v: "advance", l: "Advance" }]} />
          </Field>
          {type !== "cash" && (
            <Field label="Cycle" hint="Hisaab kab hota hai">
              <Segmented value={cycle} onChange={setCycle} options={[{ v: "daily", l: "Daily" }, { v: "weekly", l: "Weekly" }, { v: "monthly", l: "Monthly" }]} />
            </Field>
          )}
          {type === "udhar" && (
            <Field label="Credit limit (Rs)" hint="Zyada se zyada udhar (optional)">
              <AmountInput value={limit} onChange={setLimit} />
            </Field>
          )}
          {!edit && (
            <Field label="Opening balance" hint="Pehle ka hisaab (optional)">
              <div className="flex items-center gap-4">
                <AmountInput value={openAmt} onChange={setOpenAmt} className="flex-1" />
                <span className="flex items-center gap-2 font-semibold"><span className="text-udhar">Udhar</span><Switch checked={openAdv} onCheckedChange={setOpenAdv} /><span className="text-advance">Advance</span></span>
              </div>
            </Field>
          )}
          {!edit && type === "advance" && (
            <Field label="Advance amount (Rs)" hint="Abhi kitna advance diya">
              <AmountInput value={advAmt} onChange={setAdvAmt} />
            </Field>
          )}
          <label className="flex min-h-14 items-center gap-3 font-semibold">
            <input type="checkbox" className="size-6 accent-primary" checked={delivery} onChange={(e) => setDelivery(e.target.checked)} />
            Usually needs delivery <span className="font-normal text-muted-foreground">/ Aksar delivery chahiye</span>
          </label>
          <Field label="Notes" hint="Koi baat yaad rakhni ho">
            <textarea className="field min-h-24 py-3" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button className="flex-1" size="lg" onClick={save}>Save / Mehfooz karo</Button>
          <Button variant="outline" size="lg" onClick={onClose}>Cancel</Button>
        </div>
        {edit && member.active && (
          <Button variant="ghost" className="text-udhar" onClick={() => setConfirmDeact(true)}>Deactivate member</Button>
        )}
        <ConfirmDialog open={confirmDeact} destructive title="Member band karein?" message={`${member?.name} list se hat jayega, lekin hisaab mehfooz rahega.`}
          onClose={() => setConfirmDeact(false)}
          onConfirm={async () => { const c = await api.setCustomerActive(member!.id, false); toast.success("Member band ho gaya"); setConfirmDeact(false); onSaved(c); }} />
      </DialogContent>
    </Dialog>
  );
}

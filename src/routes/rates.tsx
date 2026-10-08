import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Plus, Star } from "lucide-react";
import * as api from "@/api";
import type { Product } from "@/api";
import { labels } from "@/labels";
import { rs } from "@/lib/format";
import { AmountInput, Bi, Card, Field, Loading, PageHeader, useApi } from "@/components/app/bits";
import { useApp } from "@/components/app/AppContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/rates")({
  head: () => ({
    meta: [
      { title: "Rates — IQ Waterland" },
      { name: "description", content: "Bottle sizes ke rate aur delivery fee." },
      { property: "og:title", content: "Rates — IQ Waterland" },
      { property: "og:description", content: "Bottle prices and delivery fee." },
    ],
  }),
  component: Rates,
});

function Rates() {
  const { settings, refreshSettings } = useApp();
  const { data, reload } = useApi(() => api.listProducts({ includeInactive: true }), []);
  const [fee, setFee] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [np, setNp] = useState({ name: "", sizeLabel: "", price: null as number | null });
  useEffect(() => { if (settings && fee == null) setFee(settings.deliveryFee); }, [settings, fee]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={labels.rates.title} actions={<Button size="lg" onClick={() => setAdding(true)}><Plus /> New Size</Button>} />
      <Card className="p-0">
        {!data ? <div className="p-6"><Loading /></div> : (
          <table className="w-full">
            <thead className="border-b text-left text-sm text-muted-foreground"><tr><th className="p-4">Name</th><th>Size</th><th>Price</th><th>Active</th></tr></thead>
            <tbody className="divide-y">
              {data.map((p) => <Row key={p.id} p={p} onSaved={reload} />)}
              {adding && (
                <tr>
                  <td className="p-4"><input className="field" placeholder="e.g. 6 Litre" autoFocus value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} /></td>
                  <td><input className="field w-28" placeholder="6L" value={np.sizeLabel} onChange={(e) => setNp({ ...np, sizeLabel: e.target.value })} /></td>
                  <td><div className="w-36"><AmountInput value={np.price} onChange={(v) => setNp({ ...np, price: v })} /></div></td>
                  <td className="pr-4"><div className="flex gap-2">
                    <Button disabled={!np.name || !np.price} onClick={async () => { await api.createProduct({ name: np.name, sizeLabel: np.sizeLabel || np.name, price: np.price!, active: true, isDefault: false }); toast.success("Naya size add ho gaya"); setAdding(false); setNp({ name: "", sizeLabel: "", price: null }); reload(); }}><Check /> Save</Button>
                    <Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
                  </div></td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Card>
      <Card className="max-w-xl">
        <Bi l={labels.rates.deliveryFee} className="mb-4 text-[1.2rem] font-bold text-deep" sub="text-muted-foreground" />
        <div className="flex items-end gap-3">
          <div className="flex-1"><Field label="Default delivery fee (Rs)" hint="Nayi sale mein ye fee lagegi"><AmountInput value={fee} onChange={setFee} /></Field></div>
          <Button size="lg" disabled={!fee} onClick={async () => { await api.saveSettings({ deliveryFee: fee! }); refreshSettings(); toast.success("Delivery fee save ho gayi"); }}>Save</Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Rate badalne se purani sales par asar nahi hota.</p>
      </Card>
    </div>
  );
}

function Row({ p, onSaved }: { p: Product; onSaved: () => void }) {
  const [edit, setEdit] = useState(false);
  const [price, setPrice] = useState<number | null>(p.price);
  return (
    <tr>
      <td className="p-4 font-semibold"><span className="flex items-center gap-2">{p.isDefault && <Star className="size-5 fill-current text-warning" />}{p.name}</span></td>
      <td>{p.sizeLabel}</td>
      <td>
        {edit ? (
          <div className="flex items-center gap-2"><div className="w-32"><AmountInput value={price} autoFocus onChange={setPrice} /></div>
            <Button size="icon" className="size-14" aria-label="Save" disabled={!price} onClick={async () => { await api.updateProduct(p.id, { price: price! }); toast.success(`${p.name} ka rate ${rs(price!)}`); setEdit(false); onSaved(); }}><Check /></Button></div>
        ) : <button className="min-h-12 rounded-xl px-3 text-lg font-bold tabular hover:bg-tint" onClick={() => setEdit(true)}>{rs(p.price)}</button>}
      </td>
      <td><Switch checked={p.active} disabled={p.isDefault} onCheckedChange={async (v) => { await api.updateProduct(p.id, { active: v }); onSaved(); }} /></td>
    </tr>
  );
}

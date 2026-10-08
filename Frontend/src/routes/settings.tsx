import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DatabaseBackup } from "lucide-react";
import * as api from "@/api";
import type { Settings } from "@/api";
import { labels } from "@/labels";
import { cn } from "@/lib/utils";
import { fmtDateTime } from "@/lib/format";
import { AmountInput, Card, Field, Loading, PageHeader, useApi } from "@/components/app/bits";
import { useApp } from "@/components/app/AppContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — IQ Waterland" },
      { name: "description", content: "Business info, WhatsApp messages, text size aur backup." },
      { property: "og:title", content: "Settings — IQ Waterland" },
      { property: "og:description", content: "Business info, WhatsApp templates, text size and backup." },
    ],
  }),
  component: SettingsPage,
});

const TPL: { k: keyof Settings["templates"]; l: string }[] = [
  { k: "sale", l: "Sale entry" }, { k: "payment", l: "Payment received" }, { k: "reminder", l: "Reminder" }, { k: "advance", l: "Advance received" },
];

function SettingsPage() {
  const { settings, refreshSettings } = useApp();
  const [s, setS] = useState<Settings | null>(null);
  const { data: products } = useApi(() => api.listProducts(), []);
  useEffect(() => { if (settings && !s) setS(settings); }, [settings, s]);
  if (!s) return <Loading rows={6} />;

  const save = async (patch: Partial<Settings>, msg = "Settings save ho gayi") => {
    const n = await api.saveSettings(patch);
    setS(n); refreshSettings(); toast.success(msg);
  };
  const preview = (k: keyof Settings["templates"]) => api.buildMessage(k, {
    customerName: "Haji Rashid", items: [{ name: "19 Litre", qty: 3 }], deliveryFee: 30, total: 240, amount: 500, balance: k === "advance" ? -1200 : 750,
    businessName: s.businessName, templates: s.templates,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={labels.settings.title} />
      <div className="grid grid-cols-2 gap-6">
        <Card className="flex flex-col gap-4">
          <h3 className="text-[1.2rem] font-bold text-deep">Business</h3>
          <Field label="Name"><input className="field" value={s.businessName} onChange={(e) => setS({ ...s, businessName: e.target.value })} /></Field>
          <Field label="Phone"><input className="field" value={s.phone} onChange={(e) => setS({ ...s, phone: e.target.value })} /></Field>
          <Field label="Address"><input className="field" value={s.address} onChange={(e) => setS({ ...s, address: e.target.value })} /></Field>
          <Button onClick={() => save({ businessName: s.businessName, phone: s.phone, address: s.address })}>Save</Button>
        </Card>
        <Card className="flex flex-col gap-4">
          <h3 className="text-[1.2rem] font-bold text-deep">Sale defaults</h3>
          <Field label="Default delivery fee (Rs)"><AmountInput value={s.deliveryFee} onChange={(v) => setS({ ...s, deliveryFee: v ?? 0 })} /></Field>
          <Field label="Default product">
            <select className="field" value={s.defaultProductId} onChange={(e) => setS({ ...s, defaultProductId: e.target.value })}>
              {products?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Button onClick={() => save({ deliveryFee: s.deliveryFee, defaultProductId: s.defaultProductId })}>Save</Button>
          <h3 className="mt-4 text-[1.2rem] font-bold text-deep">Display / Text size</h3>
          <div className="grid grid-cols-3 gap-3">
            {[{ v: 100, l: "Normal" }, { v: 115, l: "Bara" }, { v: 130, l: "Sab se bara" }].map((o) => (
              <button key={o.v} onClick={() => save({ fontScale: o.v }, "Text size badal gaya")}
                className={cn("min-h-16 rounded-xl border-2 font-bold", s.fontScale === o.v ? "border-primary bg-tint text-deep" : "border-input")}
                style={{ fontSize: `${o.v / 100}rem` }}>{o.l}</button>
            ))}
          </div>
        </Card>
      </div>
      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[1.2rem] font-bold text-deep">WhatsApp message templates</h3>
          <label className="flex items-center gap-3 font-semibold"><Switch checked={s.autoOpenWhatsApp} onCheckedChange={(v) => save({ autoOpenWhatsApp: v })} />Sale save hone par WhatsApp khud kholo</label>
        </div>
        <p className="text-sm text-muted-foreground">Placeholders: {"{customer_name} {date} {items} {delivery_line} {total} {amount} {balance} {balance_line} {business_name}"}</p>
        {TPL.map((t) => (
          <div key={t.k} className="grid grid-cols-2 gap-4">
            <Field label={t.l}><textarea className="field min-h-32 py-3" value={s.templates[t.k]} onChange={(e) => setS({ ...s, templates: { ...s.templates, [t.k]: e.target.value } })} /></Field>
            <div className="flex flex-col gap-1"><span className="text-[0.9rem] font-semibold">Preview</span>
              <div className="min-h-32 whitespace-pre-wrap rounded-xl bg-tint p-4">{preview(t.k)}</div></div>
          </div>
        ))}
        <Button className="self-start" onClick={() => save({ templates: s.templates })}>Save templates</Button>
      </Card>
      <Card className="flex items-center justify-between">
        <div><h3 className="text-[1.2rem] font-bold text-deep">Backup</h3>
          <p className="text-muted-foreground">Last backup: {s.lastBackupAt ? fmtDateTime(s.lastBackupAt) : "Abhi tak nahi"}</p></div>
        <div className="flex items-center gap-3">
          {typeof window !== "undefined" && !!(window as any).electronAPI && (
            <Button variant="outline" size="lg" onClick={async () => {
              const r = await (window as any).electronAPI.invoke("pickBackupFolder", {});
              if (r?.data?.ok) toast.success(`Extra backup folder: ${r.data.path}`);
            }}><DatabaseBackup /> USB/Drive folder</Button>
          )}
          <Button size="lg" onClick={async () => { const r = await api.createBackup(); setS({ ...s, lastBackupAt: r.at }); refreshSettings(); toast.success("Backup ban gaya"); }}><DatabaseBackup /> Backup abhi lo</Button>
        </div>
      </Card>
    </div>
  );
}

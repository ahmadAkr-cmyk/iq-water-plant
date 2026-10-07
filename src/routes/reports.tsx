import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileSpreadsheet, Printer } from "lucide-react";
import * as api from "@/api";
import { labels } from "@/labels";
import { cn } from "@/lib/utils";
import { fmtDate, presetRange, rs, type Preset } from "@/lib/format";
import { Bi, Card, Loading, PageHeader, useApi } from "@/components/app/bits";
import { WhatsAppButton } from "@/components/app/WhatsAppButton";
import { useApp } from "@/components/app/AppContext";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — IQ Waterland" },
      { name: "description", content: "Roz ka hisaab, mahine ki sale aur kis se kitna lena hai." },
      { property: "og:title", content: "Reports — IQ Waterland" },
      { property: "og:description", content: "Daily close, monthly sales and receivables." },
    ],
  }),
  component: Reports,
});

function Reports() {
  const { version, wa } = useApp();
  const [tab, setTab] = useState<Preset>("today");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const r = presetRange(tab, custom);
  const { data } = useApi(() => api.getReport(r), [tab, custom.from, custom.to, version]);
  const { data: today } = useApi(() => api.getReport(presetRange("today")), [version]);
  const { data: rec } = useApi(() => api.getReceivables(), [version]);

  return (
    <div className="print-area flex flex-col gap-6">
      <PageHeader title={labels.reports.title} actions={<>
        <Button variant="outline" onClick={async () => { await api.exportReport(r); toast.success("Excel file ban gayi (demo)"); }}><FileSpreadsheet /> Export to Excel</Button>
        <Button variant="outline" onClick={() => window.print()}><Printer /> Print</Button>
      </>} />
      <div className="no-print flex flex-wrap items-center gap-2">
        {(["today", "month", "custom"] as Preset[]).map((p) => (
          <button key={p} onClick={() => setTab(p)} className={cn("min-h-14 rounded-xl border-2 px-6 text-lg font-semibold", tab === p ? "border-primary bg-tint text-deep" : "border-input bg-card")}>
            {{ today: "Today", month: "This Month", custom: "Custom range" }[p as "today"]}
          </button>
        ))}
        {tab === "custom" && <>
          <input type="date" className="field w-44" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
          <input type="date" className="field w-44" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
        </>}
      </div>
      {today && (
        <Card className="bg-tint">
          <Bi l={labels.reports.dayClose} className="mb-3 text-[1.2rem] font-bold text-deep" sub="text-muted-foreground" />
          <div className="flex flex-wrap items-center gap-4 text-lg">
            <span>Cash sales <b className="tabular">{rs(today.cashReceived)}</b></span><span>+</span>
            <span>Payments <b className="tabular">{rs(today.paymentsCollected)}</b></span><span>=</span>
            <span className="text-2xl">Cash in hand today: <b className="tabular text-deep">{rs(today.cashInHand)}</b></span>
          </div>
        </Card>
      )}
      {!data ? <Loading rows={4} /> : (
        <>
          <div className="grid grid-cols-4 gap-4">
            <K l="Total Sale" v={rs(data.totalSale)} />
            <K l="Cash Received" v={rs(data.cashReceived)} />
            <K l="Udhar Given" v={rs(data.udharGiven)} tone="text-udhar" />
            <K l="Payments Collected" v={rs(data.paymentsCollected)} tone="text-advance" />
            <K l="Advance Received" v={rs(data.advanceReceived)} tone="text-advance" />
            <K l="Cancelled sales" v={data.cancelledCount} />
            <K l="Deliveries" v={data.deliveries} />
          </div>
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <h3 className="mb-3 text-[1.2rem] font-bold text-deep">Bottles sold by size</h3>
              <table className="w-full"><thead className="text-left text-sm text-muted-foreground"><tr><th className="py-2">Size</th><th className="text-right">Qty</th><th className="text-right">Amount</th></tr></thead>
                <tbody className="divide-y">{data.bySize.map((b) => <tr key={b.size}><td className="py-3">{b.size}</td><td className="text-right tabular">{b.qty}</td><td className="text-right font-semibold tabular">{rs(b.amount)}</td></tr>)}</tbody></table>
            </Card>
            <Card>
              <h3 className="mb-3 text-[1.2rem] font-bold text-deep">Daily sales</h3>
              <div className="h-56"><ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.daily.map((d) => ({ ...d, day: fmtDate(d.date).slice(0, 6) }))}>
                  <XAxis dataKey="day" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} width={60} />
                  <Tooltip formatter={(v: number) => rs(v)} cursor={{ fill: "var(--tint)" }} />
                  <Bar dataKey="total" fill="var(--chart-1)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer></div>
            </Card>
          </div>
        </>
      )}
      <Card>
        <h3 className="mb-3 text-[1.2rem] font-bold text-deep">Kis se kitna lena hai</h3>
        {!rec ? <Loading /> : (
          <table className="w-full"><tbody className="divide-y">
            {rec.rows.map(({ customer: c, balance }) => (
              <tr key={c.id}><td className="py-3 font-semibold">{c.name}<div className="text-sm font-normal text-muted-foreground">{c.phone}</div></td>
                <td className="text-right font-bold text-udhar tabular">{rs(balance)}</td>
                <td className="no-print w-16 text-right"><WhatsAppButton icon phone={c.phone} onClick={() => wa(c.phone, "reminder", { customerName: c.name, balance })} /></td></tr>
            ))}
            <tr className="text-lg"><td className="py-3 font-bold">Total</td><td className="text-right font-bold text-udhar tabular">{rs(rec.total)}</td><td /></tr>
          </tbody></table>
        )}
      </Card>
    </div>
  );
}

function K({ l, v, tone }: { l: string; v: React.ReactNode; tone?: string }) {
  return <Card><div className="text-muted-foreground">{l}</div><div className={cn("text-[1.6rem] font-bold tabular", tone)}>{v}</div></Card>;
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BookOpen, HandCoins, Pencil, UserPlus } from "lucide-react";
import * as api from "@/api";
import { labels } from "@/labels";
import { cn } from "@/lib/utils";
import { fmtDate, rs } from "@/lib/format";
import { BalanceBadge, Card, EmptyState, Highlight, Loading, PageHeader, Pill, useApi } from "@/components/app/bits";
import { CustomerSearch } from "@/components/app/CustomerSearch";
import { WhatsAppButton } from "@/components/app/WhatsAppButton";
import { useApp } from "@/components/app/AppContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/khata/")({
  head: () => ({
    meta: [
      { title: "Udhar Khata — IQ Waterland" },
      { name: "description", content: "Sab members ka udhar aur advance hisaab." },
      { property: "og:title", content: "Udhar Khata — IQ Waterland" },
      { property: "og:description", content: "All members with their udhar and advance balances." },
    ],
  }),
  component: Khata,
});

type F = "all" | "udhar" | "advance" | "cash";

function Khata() {
  const { version, openMemberForm, openPayment, wa } = useApp();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [f, setF] = useState<F>("all");
  const [cycle, setCycle] = useState<"all" | "daily" | "weekly" | "monthly">("all");
  const [inactive, setInactive] = useState(false);
  const [sort, setSort] = useState<"name" | "balance">("name");
  const { data } = useApi(() => api.listCustomers({ search: q, type: f, cycle, includeInactive: inactive }), [q, f, cycle, inactive, version]);
  const { data: all } = useApi(() => api.listCustomers({}), [version]);

  const rows = useMemo(() => [...(data ?? [])].sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : b.balance - a.balance)), [data, sort]);
  const totU = (all ?? []).filter((c) => c.balance > 0).reduce((a, c) => a + c.balance, 0);
  const totA = (all ?? []).filter((c) => c.balance < 0).reduce((a, c) => a - c.balance, 0);

  return (
    <div>
      <PageHeader title={labels.khata.title} actions={<Button size="lg" onClick={() => openMemberForm({})}><UserPlus /> New Member / Naya Member</Button>} />
      <div className="mb-6"><CustomerSearch limit={6} allowCreate={false} onQueryChange={setQ} onSelect={(c) => nav({ to: "/khata/$id", params: { id: c.id } })} placeholder="Member ka naam ya phone likho..." /></div>
      <div className="mb-6 grid grid-cols-3 gap-6">
        <Card><div className="text-muted-foreground">Total Udhar Baqi</div><div className="text-[1.8rem] font-bold text-udhar tabular">{rs(totU)}</div></Card>
        <Card><div className="text-muted-foreground">Total Advance Jama</div><div className="text-[1.8rem] font-bold text-advance tabular">{rs(totA)}</div></Card>
        <Card><div className="text-muted-foreground">Members</div><div className="text-[1.8rem] font-bold tabular">{all?.length ?? "–"}</div></Card>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {(["all", "udhar", "advance", "cash"] as F[]).map((x) => (
          <button key={x} onClick={() => setF(x)} className={cn("min-h-12 rounded-full border-2 px-5 font-semibold capitalize", f === x ? "border-primary bg-tint text-deep" : "border-input bg-card")}>{x}</button>
        ))}
        <select className="field w-44" value={cycle} onChange={(e) => setCycle(e.target.value as typeof cycle)}>
          <option value="all">All cycles</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
        </select>
        <select className="field w-48" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="name">Sort: Name</option><option value="balance">Sort: Balance</option>
        </select>
        <label className="ml-auto flex items-center gap-3 font-semibold"><Switch checked={inactive} onCheckedChange={setInactive} />Show inactive</label>
      </div>
      <Card className="p-0">
        {!data ? <div className="p-6"><Loading /></div> : rows.length === 0 ? (
          <EmptyState text="Koi member nahi mila" action={<Button onClick={() => openMemberForm({ initialName: q })}>Naya Member banao</Button>} />
        ) : (
          <table className="w-full">
            <thead className="border-b text-left text-sm text-muted-foreground">
              <tr><th className="p-4">Name</th><th>Type</th><th>Cycle</th><th>Balance</th><th>Last activity</th><th className="pr-4 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((c) => (
                <tr key={c.id} className={cn("cursor-pointer hover:bg-tint/50", !c.active && "opacity-50")} onClick={() => nav({ to: "/khata/$id", params: { id: c.id } })}>
                  <td className="p-4"><div className="font-semibold"><Highlight text={c.name} q={q} /></div><div className="text-sm text-muted-foreground"><Highlight text={c.phone} q={q} /></div></td>
                  <td><Pill kind={c.type}>{c.type}</Pill></td>
                  <td>{c.cycle ? <Pill kind="neutral">{c.cycle}</Pill> : "—"}</td>
                  <td><BalanceBadge balance={c.balance} /></td>
                  <td className="text-muted-foreground">{c.lastActivityAt ? fmtDate(c.lastActivityAt) : "—"}</td>
                  <td className="pr-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Ledger" onClick={() => nav({ to: "/khata/$id", params: { id: c.id } })}><BookOpen /></Button>
                      <Button variant="ghost" size="icon" title="Payment" onClick={() => openPayment({ customer: c })}><HandCoins /></Button>
                      <Button variant="ghost" size="icon" title="Edit" onClick={() => openMemberForm({ member: c })}><Pencil /></Button>
                      <WhatsAppButton icon phone={c.phone} onClick={() => wa(c.phone, "reminder", { customerName: c.name, balance: c.balance })} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

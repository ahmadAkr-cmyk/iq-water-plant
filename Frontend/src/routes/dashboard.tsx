import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BookUser, Droplets, HandCoins, ShoppingCart, Truck, UserPlus, Wallet } from "lucide-react";
import * as api from "@/api";
import { labels } from "@/labels";
import { fmtLong, fmtTime, itemsShort, rs } from "@/lib/format";
import { BalanceBadge, Bi, Card, Loading, Pill, StatCard, useApi } from "@/components/app/bits";
import { useApp } from "@/components/app/AppContext";
import { WhatsAppButton } from "@/components/app/WhatsAppButton";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — IQ Waterland" },
      { name: "description", content: "Aaj ki sale, bottlein, delivery aur udhar ek nazar mein." },
      { property: "og:title", content: "Dashboard — IQ Waterland" },
      { property: "og:description", content: "Today's sales, bottles, deliveries and udhar at a glance." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { version, openPayment, openMemberForm, wa } = useApp();
  const nav = useNavigate();
  const { data } = useApi(() => api.getDashboard(), [version]);
  const d = labels.dashboard;
  const chart = data?.last7Days.map((x, i) => ({ ...x, day: new Date(x.date).toLocaleDateString("en-GB", { weekday: "short" }), today: i === 6 })) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-[1.55rem] font-bold text-deep">{d.greeting}</h2>
        <p className="text-muted-foreground">{fmtLong()}</p>
      </div>
      <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-6">
        <Link to="/sale/new" className="flex min-h-24 items-center gap-4 rounded-2xl bg-primary px-6 text-xl font-bold text-primary-foreground shadow-sm hover:bg-primary-hover">
          <ShoppingCart className="size-9" /><Bi l={labels.actions.newSale} />
        </Link>
        <Button variant="outline" className="min-h-24 justify-start rounded-2xl text-lg" onClick={() => openPayment({ mode: "payment" })}>
          <HandCoins className="!size-8 text-primary" /><Bi l={labels.actions.receivePayment} />
        </Button>
        <Button variant="outline" className="min-h-24 justify-start rounded-2xl text-lg" onClick={() => openMemberForm({})}>
          <UserPlus className="!size-8 text-primary" /><Bi l={labels.actions.newMember} />
        </Button>
      </div>
      {!data ? <Loading rows={4} /> : (
        <>
          <div className="grid grid-cols-5 gap-6">
            <StatCard icon={<Wallet />} label={d.todaySale} value={rs(data.todaySales)} />
            <StatCard icon={<Droplets />} label={d.todayBottles} value={data.todayBottles} sub={`19L: ${data.today19L}`} />
            <StatCard icon={<Truck />} label={d.deliveries} value={data.todayDeliveries} />
            <StatCard icon={<BookUser />} label={d.totalUdhar} value={rs(data.totalUdhar)} tone="udhar" />
            <StatCard icon={<HandCoins />} label={d.totalAdvance} value={rs(data.totalAdvance)} tone="advance" />
          </div>
          <Card>
            <Bi l={d.chart} className="mb-4 text-[1.2rem] font-bold text-deep" sub="text-muted-foreground" />
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart}>
                  <XAxis dataKey="day" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} width={60} />
                  <Tooltip formatter={(v: number) => rs(v)} cursor={{ fill: "var(--tint)" }} />
                  <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                    {chart.map((c) => <Cell key={c.date} fill={c.today ? "var(--chart-2)" : "var(--chart-1)"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <Bi l={d.recent} className="mb-3 text-[1.2rem] font-bold text-deep" sub="text-muted-foreground" />
              <ul className="divide-y">
                {data.recentSales.map((s) => (
                  <li key={s.id}>
                    <button onClick={() => nav({ to: "/sales", search: { bill: s.billNo } })} className="flex w-full items-center gap-3 py-3 text-left hover:bg-muted/50">
                      <span className="w-20 text-sm text-muted-foreground">{fmtTime(s.createdAt)}</span>
                      <span className={`flex-1 ${s.status === "cancelled" ? "line-through opacity-60" : ""}`}>
                        <span className="font-semibold">{s.customerName}</span>
                        <span className="block text-sm text-muted-foreground">{itemsShort(s.items)}</span>
                      </span>
                      <span className="font-bold tabular">{rs(s.total)}</span>
                      <Pill kind={s.status === "cancelled" ? "cancelled" : s.paymentType}>{s.status === "cancelled" ? "Cancelled" : s.paymentType}</Pill>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <Bi l={d.topUdhar} className="mb-3 text-[1.2rem] font-bold text-deep" sub="text-muted-foreground" />
              <ul className="divide-y">
                {data.topUdhar.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-2">
                    <Link to="/khata/$id" params={{ id: c.id }} className="flex-1 py-2 font-semibold hover:text-primary">{c.name}</Link>
                    <BalanceBadge balance={c.balance} />
                    <WhatsAppButton icon phone={c.phone} onClick={() => wa(c.phone, "reminder", { customerName: c.name, balance: c.balance })} />
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

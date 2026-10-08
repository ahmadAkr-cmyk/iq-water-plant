import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, BookUser, History, LayoutDashboard, Settings, ShoppingCart, Tag } from "lucide-react";
import { labels } from "@/labels";
import { fmtLong } from "@/lib/format";
import { Drop } from "./bits";

const NAV = [
  { to: "/dashboard", l: labels.nav.dashboard, icon: LayoutDashboard },
  { to: "/sale/new", l: labels.nav.newSale, icon: ShoppingCart },
  { to: "/khata", l: labels.nav.khata, icon: BookUser },
  { to: "/sales", l: labels.nav.sales, icon: History },
  { to: "/rates", l: labels.nav.rates, icon: Tag },
  { to: "/reports", l: labels.nav.reports, icon: BarChart3 },
  { to: "/settings", l: labels.nav.settings, icon: Settings },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const current = NAV.find((n) => path === n.to || (n.to !== "/dashboard" && path.startsWith(n.to))) ?? NAV[0];
  const [online, setOnline] = useState(true);
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(fmtLong());
    const u = () => setOnline(navigator.onLine);
    u();
    window.addEventListener("online", u);
    window.addEventListener("offline", u);
    return () => { window.removeEventListener("online", u); window.removeEventListener("offline", u); };
  }, []);

  return (
    <div className="flex min-h-screen">
      <aside className="no-print sticky top-0 flex h-screen w-[250px] shrink-0 flex-col border-r bg-card">
        <div className="flex h-[72px] items-center gap-3 border-b px-5">
          <span className="grid size-10 place-items-center rounded-full bg-tint"><Drop className="size-6 text-primary" /></span>
          <span className="text-lg font-bold text-deep">IQ Waterland</span>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {NAV.map((n) => {
            const active = n === current;
            return (
              <Link key={n.to} to={n.to}
                className={`relative flex min-h-14 items-center gap-3 rounded-xl px-4 py-2 transition-colors ${active ? "bg-tint text-deep font-semibold" : "hover:bg-muted"}`}>
                {active && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-wa" />}
                <n.icon className="size-6 shrink-0" />
                <span className="flex flex-col leading-tight"><span>{n.l.en}</span><span className="text-sm font-normal text-muted-foreground">{n.l.ro}</span></span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex h-[72px] items-center justify-between border-b bg-card px-8">
          <div className="leading-tight">
            <div className="text-lg font-bold text-deep">{current.l.en}</div>
            <div className="text-sm text-muted-foreground">{current.l.ro}</div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground">{today}</span>
            <span className="flex items-center gap-2 rounded-full bg-tint px-3 py-1 text-sm font-semibold text-deep">
              <span className={`size-2.5 rounded-full ${online ? "bg-wa" : "bg-warning"}`} />
              {online ? "Online" : "Offline mode - data laptop mein hai"}
            </span>
            <span className="grid size-10 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">IQ</span>
          </div>
        </header>
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}

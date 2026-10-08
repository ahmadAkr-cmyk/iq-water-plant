import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Drop } from "@/components/app/bits";

let shown = false;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IQ Waterland" },
      { name: "description", content: "IQ Waterland billing and khata system — starting up." },
      { property: "og:title", content: "IQ Waterland" },
      { property: "og:description", content: "Billing and khata system for IQ Waterland." },
    ],
  }),
  component: Splash,
});

function Splash() {
  const nav = useNavigate();
  const [fade, setFade] = useState(false);
  useEffect(() => {
    if (shown || sessionStorage.getItem("iqw-splash")) {
      nav({ to: "/dashboard", replace: true });
      return;
    }
    shown = true;
    sessionStorage.setItem("iqw-splash", "1");
    const a = setTimeout(() => setFade(true), 2600);
    const b = setTimeout(() => nav({ to: "/dashboard", replace: true }), 3000);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [nav]);

  return (
    <div className={`bg-splash fixed inset-0 flex flex-col items-center justify-center text-primary-foreground transition-opacity duration-400 ${fade ? "opacity-0" : "opacity-100"}`}>
      <span className="grid size-32 place-items-center rounded-full bg-card shadow-lg"><Drop className="size-16 text-primary" /></span>
      <h1 className="mt-8 text-[3.1rem] font-bold">IQ Waterland</h1>
      <p className="text-[1.1rem] opacity-85">Billing and Khata System</p>
      <div className="mt-10 h-1.5 w-72 overflow-hidden rounded-full bg-card/30">
        <div className="animate-splash-fill h-full bg-card" />
      </div>
    </div>
  );
}

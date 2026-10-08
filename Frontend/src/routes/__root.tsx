import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppProvider } from "@/components/app/AppContext";
import { Shell } from "@/components/app/Shell";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page nahi mila</h2>
        <div className="mt-6">
          <Link to="/dashboard" className="inline-flex min-h-14 items-center rounded-xl bg-primary px-6 font-semibold text-primary-foreground">
            Dashboard par jao
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Kuch ghalat ho gaya</h1>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 inline-flex min-h-14 items-center rounded-xl bg-primary px-6 font-semibold text-primary-foreground"
        >
          Dobara koshish karo
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "IQ Waterland — Billing and Khata" },
      { name: "description", content: "IQ Waterland billing and udhar khata system for water bottle sales." },
      { property: "og:title", content: "IQ Waterland — Billing and Khata" },
      { property: "og:description", content: "Billing and udhar khata system for water bottle sales." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  // In Electron SPA mode (hash routing or no SSR environment), we don't need the HTML shell
  // because electron-index.html already provides it.
  const isElectronSPA =
    typeof window !== "undefined" &&
    (window.location.protocol === "app:" || window.location.hash.startsWith("#"));
  if (isElectronSPA) {
    return <>{children}</>;
  }
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        {path === "/" ? <Outlet /> : <Shell><Outlet /></Shell>}
        <Toaster position="bottom-right" richColors toastOptions={{ style: { fontSize: "1rem" } }} />
      </AppProvider>
    </QueryClientProvider>
  );
}

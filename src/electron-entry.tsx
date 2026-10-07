import React from "react";
import ReactDOM from "react-dom/client";
import { createRouter, RouterProvider, createHashHistory } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProvider } from "@/components/app/AppContext";
import { Toaster } from "@/components/ui/sonner";
import { Shell } from "@/components/app/Shell";
import { routeTree } from "./routeTree.electron.gen";
import "./styles.css";

const queryClient = new QueryClient();
const hashHistory = createHashHistory();

const router = createRouter({
  routeTree,
  context: { queryClient },
  history: hashHistory,
  defaultPreloadStaleTime: 0,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// We wrap with AppProvider, Toaster, and conditionally Shell inside an inner component
function InnerApp() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="bottom-right" richColors toastOptions={{ style: { fontSize: "1rem" } }} />
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <InnerApp />
      </AppProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

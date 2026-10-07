import React from "react";
import ReactDOM from "react-dom/client";
import { createRouter, RouterProvider, createHashHistory } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { routeTree } from "./routeTree.electron.gen";
import "./styles.css";

// QueryClient is passed as router context (same pattern as src/router.tsx).
// RootComponent in __root.tsx renders QueryClientProvider + AppProvider internally.
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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);

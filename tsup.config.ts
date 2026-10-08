import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    main: "backend/main.ts",
    preload: "backend/preload.ts",
    database: "backend/database.ts",
    handlers: "backend/handlers.ts",
  },
  outDir: "dist-electron",
  format: ["cjs"],
  target: "node22",
  platform: "node",
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ["electron", "better-sqlite3"],
  // Don't bundle native modules
  noExternal: [],
});

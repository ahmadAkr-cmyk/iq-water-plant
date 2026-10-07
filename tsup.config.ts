import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    main: "electron/main.ts",
    preload: "electron/preload.ts",
    database: "electron/database.ts",
    handlers: "electron/handlers.ts",
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

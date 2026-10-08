import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    main: "../Backend/main.ts",
    preload: "../Backend/preload.ts",
    database: "../Backend/database.ts",
    handlers: "../Backend/handlers.ts",
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

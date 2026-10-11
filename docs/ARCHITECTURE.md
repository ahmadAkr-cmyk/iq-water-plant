# IQ Waterland Architecture

## Structure

- `backend/`
  - Electron main-process code.
  - `main.ts` boots the app and creates the browser window.
  - `preload.ts` exposes the safe bridge on `window.electronAPI`.
  - `handlers.ts` registers IPC handlers with `ipcMain.handle`.
  - `database.ts` owns SQLite access and persistence to `billing.db`.
- `src/`
  - Frontend-only React application.
  - `api.ts` is the single frontend access layer for app data.
  - Routes, components, labels, and browser/demo helpers live here.
- `public/`
  - Static frontend assets.
- `docs/`
  - Project notes and architecture references.
- Root config files
  - Build, test, packaging, and TypeScript config live at the git root.

## Data Flow

1. `src/api.ts` is called by the React UI.
2. The frontend calls `window.electronAPI`.
3. `backend/preload.ts` exposes the whitelisted Electron bridge.
4. `backend/handlers.ts` registers `ipcMain.handle(...)` handlers.
5. `backend/database.ts` executes SQLite operations.
6. Data is stored in `billing.db` inside Electron `userData`.

## Commands

- `npm run dev`
  - Starts the browser frontend dev server from the root project.
- `npm run typecheck`
  - Checks frontend and backend TypeScript projects from the root.
- `npm test`
  - Runs Vitest from the root project.
- `npm run electron:build`
  - Builds the renderer and Electron main process, then packages the app.

## Notes

- The git root is the canonical project.
- `backend/` is the only backend folder that root tooling should reference.
- `Frontend/` is a duplicate copy kept only until root-based gates pass and it can be removed safely.
- `better-sqlite3` ships a native `.node` binary that must be compiled for the ABI of whichever runtime loads it — Node.js for tests, Electron for the app.
- `pretest` rebuilds for Node (so `npm test` always works); `electron:dev` runs `electron-builder install-app-deps` first to rebuild for Electron.
- Never run `npm test` and any `electron:` command in parallel; they would race to overwrite each other's binary.

## Warning

**Never rename `package.json` name `iq-waterland`. It defines the Electron `userData` folder that holds `billing.db`.**

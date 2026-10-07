import {
  app,
  BrowserWindow,
  protocol,
  net,
  ipcMain,
  session,
  shell,
  dialog,
} from "electron";
import * as path from "node:path";
import * as url from "node:url";
import * as fs from "node:fs";

// ─── Single instance lock ───────────────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// ─── DB lazy-init (imported after app ready) ───────────────────────────────
let db: ReturnType<typeof import("./database").initDatabase> | null = null;
function getDb() {
  if (!db) db = require("./database").initDatabase(app.getPath("userData"));
  return db;
}

// ─── Backup helpers ────────────────────────────────────────────────────────
async function runAutoBackup() {
  try {
    const { autoBackup } = require("./database");
    await autoBackup(getDb(), app.getPath("userData"));
  } catch (e) {
    console.error("Auto backup failed:", e);
  }
}

// ─── Window ────────────────────────────────────────────────────────────────
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 700,
    title: "IQ Waterland",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  // Block all navigation away from app:// and deny window.open
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (e, navUrl) => {
    if (!navUrl.startsWith("app://")) e.preventDefault();
  });

  mainWindow.loadURL("app://-/electron-index.html");
  return mainWindow;
}

// ─── App lifecycle ─────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // Register custom app:// protocol for SPA serving
  protocol.handle("app", (request) => {
    // Strip app://-/ prefix
    const rawPath = request.url.slice("app://-/".length).split("?")[0]!;
    const filePath = path.join(app.getAppPath(), "dist-renderer", rawPath);

    // Serve the file if it exists, otherwise fall back to shell HTML (SPA fallback)
    return net
      .fetch(url.pathToFileURL(filePath).toString())
      .catch(() =>
        net.fetch(
          url.pathToFileURL(
            path.join(app.getAppPath(), "dist-renderer", "electron-index.html")
          ).toString()
        )
      );
  });

  // Set strict CSP — no remote origins
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'none'",
        ],
      },
    });
  });

  // Register IPC handlers (database-backed)
  const handlers = require("./handlers");
  handlers.registerHandlers(ipcMain, getDb, app, shell, dialog);

  createWindow();
  await runAutoBackup();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("second-instance", () => {
  const windows = BrowserWindow.getAllWindows();
  if (windows.length > 0) {
    const win = windows[0]!;
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

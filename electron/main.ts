import { app, BrowserWindow, protocol, net } from "electron";
import * as path from "node:path";
import * as url from "node:url";

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

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

  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: "deny" };
  });

  mainWindow.loadURL("app://-/electron-index.html");
}

app.whenReady().then(() => {
  protocol.handle("app", (request) => {
    const requestUrl = request.url.replace("app://-/", "");
    // Fallback to electron-index.html if there's no extension
    let filePath = path.join(app.getAppPath(), "dist-renderer", requestUrl);
    
    return net.fetch(url.pathToFileURL(filePath).toString()).catch(() => {
        return net.fetch(url.pathToFileURL(path.join(app.getAppPath(), "dist-renderer", "electron-index.html")).toString());
    });
  });

  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

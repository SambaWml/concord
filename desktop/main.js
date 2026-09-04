const { app, BrowserWindow, session, desktopCapturer, Menu, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

// Endereço do Concord que o app abre. Edite config.json (ou defina a
// variável de ambiente CONCORD_URL) pra apontar pro servidor publicado no
// Render — não precisa gerar o .exe de novo, só reabrir o app.
const configPath = path.join(__dirname, "config.json");
let config = { url: "http://localhost:5000" };
try {
  config = { ...config, ...JSON.parse(fs.readFileSync(configPath, "utf-8")) };
} catch {
  // sem config.json ainda? usa o padrão local acima.
}
const CONCORD_URL = process.env.CONCORD_URL || config.url;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 860,
    minHeight: 560,
    backgroundColor: "#14131a",
    title: "Concord",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL(CONCORD_URL);

  // qualquer link que tente abrir uma janela nova (ex: window.open) vai pro
  // navegador padrão em vez de abrir uma segunda janela do Concord
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null); // é um app, não um navegador — sem barra de menu

  // libera microfone/câmera direto, sem ficar perguntando toda hora — é
  // sempre o nosso próprio site carregado aqui dentro.
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(["media", "microphone", "camera", "notifications"].includes(permission));
  });

  // O Electron não tem o seletor nativo de "compartilhar tela" do Chrome —
  // isso aciona o seletor do próprio Windows/macOS quando o sistema suporta,
  // e cai pra tela principal automaticamente quando não suporta.
  session.defaultSession.setDisplayMediaRequestHandler(
    async (_request, callback) => {
      const sources = await desktopCapturer.getSources({ types: ["screen", "window"] });
      callback({ video: sources[0] });
    },
    { useSystemPicker: true }
  );

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { initDb } from "./db.js";
import { attachSocket } from "./socket.js";
import { createWebhookRouter } from "./webhookRoute.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5000;
// Sem CLIENT_ORIGIN definido, aceita qualquer origem — é o caso comum em
// produção, onde o front é servido por este mesmo processo (mesma origem).
// Defina CLIENT_ORIGIN só se quiser travar pra um domínio específico.
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || true;
const webDist = path.join(__dirname, "../../web/dist");

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.get("/health", (_req, res) => res.json({ ok: true }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN },
});

attachSocket(io);

// precisa do io pra avisar o chat em tempo real quando alguém de fora posta
app.use("/api/webhooks", createWebhookRouter(io));

// Em produção o próprio servidor serve o front (build do Vite) — assim dá
// pra hospedar tudo num único serviço gratuito, sem precisar de dois deploys.
// Fica por último: é um catch-all, tudo que é rota de API vem antes.
app.use(express.static(webDist));
app.get("*", (_req, res) => res.sendFile(path.join(webDist, "index.html")));

initDb()
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`Concord server ouvindo na porta ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Não foi possível iniciar o banco de dados:", err);
    process.exit(1);
  });

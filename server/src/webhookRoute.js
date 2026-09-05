import express from "express";
import { getWebhook, insertMessage } from "./db.js";

const MAX_MESSAGE_LEN = 2000;

// Um jeito de qualquer serviço externo (CI, um site, um script seu) postar
// mensagem num canal sem precisar de WebSocket nem login — igual webhook do
// Discord: POST { content } pra essa URL e a mensagem aparece no chat.
export function createWebhookRouter(io) {
  const router = express.Router();
  router.use(express.json({ limit: "64kb" }));

  router.post("/:id/:token", async (req, res) => {
    try {
      const webhook = await getWebhook(req.params.id, req.params.token);
      if (!webhook) {
        res.status(404).json({ error: "Webhook não encontrado." });
        return;
      }

      const content = String(req.body?.content || "").trim().slice(0, MAX_MESSAGE_LEN);
      if (!content) {
        res.status(400).json({ error: "content é obrigatório." });
        return;
      }
      const username = String(req.body?.username || webhook.name).trim().slice(0, 40) || webhook.name;

      const msg = await insertMessage(webhook.guild_id, webhook.channel_id, null, username, content, true);
      io.to(`c:${webhook.channel_id}`).emit("chat:message", msg);
      res.status(204).end();
    } catch (err) {
      console.error("webhook post failed", err);
      res.status(500).json({ error: "Falha ao processar o webhook." });
    }
  });

  return router;
}

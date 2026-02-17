import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/permissions.js";
import * as notificationService from "../services/notifications.js";
import { config } from "../config.js";

export default async function notificationRoutes(app: FastifyInstance) {
  // POST /users/@me/push-subscription — Subscribe to push notifications
  app.post<{
    Body: { endpoint: string; keys: { p256dh: string; auth: string } };
  }>(
    "/users/@me/push-subscription",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { endpoint, keys } = request.body;
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return reply.code(400).send({
          error: { code: "BAD_REQUEST", message: "Invalid push subscription", status: 400 },
        });
      }
      const result = await notificationService.subscribe(request.userId, { endpoint, keys });
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }
      return reply.code(201).send(result.data);
    },
  );

  // DELETE /users/@me/push-subscription — Unsubscribe
  app.delete<{ Body: { endpoint: string } }>(
    "/users/@me/push-subscription",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { endpoint } = request.body;
      if (!endpoint) {
        return reply.code(400).send({
          error: { code: "BAD_REQUEST", message: "Endpoint required", status: 400 },
        });
      }
      const result = await notificationService.unsubscribe(request.userId, endpoint);
      if (result.error) {
        return reply.code(result.error.statusCode).send({ error: result.error });
      }
      return reply.code(200).send(result.data);
    },
  );

  // GET /config/vapid-key — Public VAPID key for frontend
  app.get("/config/vapid-key", async (_request, reply) => {
    return reply.send({ vapidPublicKey: config.vapid.publicKey || null });
  });
}

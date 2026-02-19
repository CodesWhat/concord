import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import Redis from "ioredis";
import { config } from "./config.js";
import { auth } from "./services/auth.js";
import serverRoutes from "./routes/servers.js";
import channelRoutes from "./routes/channels.js";
import messageRoutes from "./routes/messages.js";
import attachmentRoutes from "./routes/attachments.js";
import inviteRoutes from "./routes/invites.js";
import userRoutes from "./routes/users.js";
import threadRoutes from "./routes/threads.js";
import readStateRoutes from "./routes/readState.js";
import notificationRoutes from "./routes/notifications.js";
import roleRoutes from "./routes/roles.js";
import forumRoutes from "./routes/forum.js";
import banRoutes from "./routes/bans.js";
import { initGateway } from "./gateway/index.js";
import { initBucket } from "./services/s3.js";

const server = Fastify({
  logger: true,
});

await server.register(cors, {
  origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  credentials: true,
  allowedHeaders: ["content-type", "authorization"],
});

await server.register(multipart, {
  limits: { fileSize: 25 * 1024 * 1024 },
});

// Global rate limiting
const rateLimitRedis = new Redis(config.redisUrl, { maxRetriesPerRequest: 1 });
await server.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
  redis: rateLimitRedis,
  keyGenerator: (request) => {
    return request.userId || request.ip;
  },
  errorResponseBuilder: (_request, context) => ({
    error: {
      code: "RATE_LIMITED",
      message: `Too many requests. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
      statusCode: 429,
    },
  }),
});

// Better Auth catch-all route
server.route({
  method: ["GET", "POST"],
  url: "/api/auth/*",
  config: {
    rateLimit: {
      max: 10,
      timeWindow: "1 minute",
      keyGenerator: (request) => request.ip,
    },
  },
  async handler(request, reply) {
    try {
      const url = new URL(
        request.url,
        `http://${request.headers.host}`,
      );

      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (value) headers.append(key, String(value));
      }

      const req = new Request(url.toString(), {
        method: request.method,
        headers,
        ...(request.body ? { body: JSON.stringify(request.body) } : {}),
      });

      const response = await auth.handler(req);

      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));

      const text = await response.text();
      reply.send(text || null);
    } catch (error) {
      server.log.error(error, "Authentication error");
      reply.status(500).send({ error: "Internal authentication error" });
    }
  },
});

// Register REST API routes
await server.register(serverRoutes, { prefix: "/api/v1/servers" });
await server.register(roleRoutes, { prefix: "/api/v1/servers" });
await server.register(channelRoutes, { prefix: "/api/v1" });
await server.register(messageRoutes, { prefix: "/api/v1" });
await server.register(attachmentRoutes, { prefix: "/api/v1" });
await server.register(inviteRoutes, { prefix: "/api/v1" });
await server.register(userRoutes, { prefix: "/api/v1/users" });
await server.register(threadRoutes, { prefix: "/api/v1" });
await server.register(readStateRoutes, { prefix: "/api/v1" });
await server.register(notificationRoutes, { prefix: "/api/v1" });
await server.register(forumRoutes, { prefix: "/api/v1" });
await server.register(banRoutes, { prefix: "/api/v1" });

server.get("/", async () => {
  return { status: "ok", name: "concord-api" };
});

server.get("/health", async () => {
  return { status: "ok" };
});

try {
  await server.listen({ port: config.port, host: config.host });

  // Initialize WebSocket gateway on the same HTTP server
  const httpServer = server.server;
  initGateway(httpServer);

  // Initialize S3 bucket (non-fatal if S3 not configured)
  try {
    await initBucket();
  } catch (err) {
    server.log.warn(err, "S3 bucket init failed — file uploads may be unavailable");
  }
} catch (err) {
  server.log.error(err);
  process.exit(1);
}

import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { auth } from "./services/auth.js";
import serverRoutes from "./routes/servers.js";
import channelRoutes from "./routes/channels.js";
import messageRoutes from "./routes/messages.js";
import inviteRoutes from "./routes/invites.js";
import userRoutes from "./routes/users.js";
import { initGateway } from "./gateway/index.js";

const server = Fastify({
  logger: true,
});

await server.register(cors, {
  origin: "http://localhost:5173",
  credentials: true,
  allowedHeaders: ["content-type", "authorization"],
});

// Better Auth catch-all route
server.route({
  method: ["GET", "POST"],
  url: "/api/auth/*",
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
await server.register(channelRoutes, { prefix: "/api/v1" });
await server.register(messageRoutes, { prefix: "/api/v1" });
await server.register(inviteRoutes, { prefix: "/api/v1" });
await server.register(userRoutes, { prefix: "/api/v1/users" });

server.get("/", async () => {
  return { status: "ok", name: "concord-api" };
});

server.get("/health", async () => {
  return { status: "ok" };
});

try {
  await server.listen({ port: 3000, host: "0.0.0.0" });

  // Initialize WebSocket gateway on the same HTTP server
  const httpServer = server.server;
  initGateway(httpServer);
} catch (err) {
  server.log.error(err);
  process.exit(1);
}

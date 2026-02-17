import Fastify from "fastify";
import cors from "@fastify/cors";

const server = Fastify({
  logger: true,
});

await server.register(cors, {
  origin: true,
});

server.get("/", async () => {
  return { status: "ok", name: "concord-api" };
});

server.get("/health", async () => {
  return { status: "ok" };
});

try {
  await server.listen({ port: 3000, host: "0.0.0.0" });
} catch (err) {
  server.log.error(err);
  process.exit(1);
}

import type { FastifyRequest, FastifyReply } from "fastify";
import { auth } from "../services/auth.js";

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value) headers.append(key, String(value));
  }

  const session = await auth.api.getSession({ headers });

  if (!session) {
    reply.status(401).send({ error: "Unauthorized" });
    return;
  }

  (request as FastifyRequest & { session: typeof session }).session = session;
}

export function getSession(request: FastifyRequest) {
  return (request as FastifyRequest & { session: { user: { id: string; email: string; name: string }; session: { token: string } } }).session;
}

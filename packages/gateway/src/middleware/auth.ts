import type { FastifyRequest, FastifyReply } from "fastify";

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const secret = request.headers["x-admin-secret"];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    reply.status(401).send({ error: "No autorizado" });
  }
}

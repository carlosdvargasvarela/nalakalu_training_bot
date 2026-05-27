import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../middleware/auth.js";
import { getAdminClient } from "../mcp-client.js";
import { ingestDocument } from "@nalakalu/mcp-documents/ingest";

type McpTextContent = { type: string; text: string };
type McpResult = { content: McpTextContent[] };

function parseToolResult(result: unknown): string {
  return ((result as McpResult).content[0] as McpTextContent).text;
}

export async function adminRoutes(app: FastifyInstance) {
  app.get("/documents", { preHandler: requireAdmin }, async (request, reply) => {
    const adminClient = await getAdminClient();
    const result = await adminClient.callTool({ name: "list_documents", arguments: {} });
    const docs = JSON.parse(parseToolResult(result)) as unknown;
    reply.send(docs);
  });

  app.delete<{ Params: { id: string } }>(
    "/documents/:id",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const adminClient = await getAdminClient();
      await adminClient.callTool({ name: "delete_document", arguments: { id: request.params.id } });
      reply.send({ ok: true });
    }
  );

  app.post("/documents", { preHandler: requireAdmin }, async (request, reply) => {
    const data = await request.file({ limits: { fileSize: 20 * 1024 * 1024 } });
    if (!data) return reply.status(400).send({ error: "Archivo requerido" });

    const buffer = await data.toBuffer();
    const result = await ingestDocument({
      filename: data.filename,
      buffer,
      contentType: data.mimetype,
      category: (request.query as Record<string, string>).category,
      uploadedBy: request.headers["x-user"] as string | undefined,
    });

    reply.status(201).send(result);
  });
}

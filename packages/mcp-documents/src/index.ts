import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  searchProcedures,
  getDocument,
  listCategories,
  listTags,
  getRecentUpdates,
  recordFeedback,
} from "./tools.js";

const server = new Server(
  { name: "nalakalu-documents-mcp", version: "0.2.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_procedures",
      description: "Busca en los procedimientos de la empresa y responde preguntas",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Pregunta del trabajador" },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Filtrar por tags (opcional)",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "get_document",
      description: "Obtiene URL de descarga de un procedimiento por ID",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
    {
      name: "list_categories",
      description: "Lista las categorías de procedimientos disponibles",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "list_tags",
      description: "Lista todos los tags únicos de procedimientos activos",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_recent_updates",
      description: "Retorna procedimientos actualizados recientemente",
      inputSchema: {
        type: "object",
        properties: {
          since_hours: {
            type: "number",
            description: "Cuántas horas hacia atrás revisar (default 24)",
          },
        },
      },
    },
    {
      name: "record_feedback",
      description: "Guarda el feedback (👍/👎) de una respuesta del asistente",
      inputSchema: {
        type: "object",
        properties: {
          session_id: { type: "string" },
          question: { type: "string" },
          answer: { type: "string" },
          rating: { type: "string", enum: ["up", "down"] },
          document_ids: { type: "array", items: { type: "string" } },
        },
        required: ["session_id", "question", "answer", "rating", "document_ids"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "search_procedures") {
    const result = await searchProcedures(
      args!.query as string,
      args?.tags as string[] | undefined
    );
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }

  if (name === "get_document") {
    const doc = await getDocument(args!.id as string);
    return { content: [{ type: "text", text: JSON.stringify(doc) }] };
  }

  if (name === "list_categories") {
    const categories = await listCategories();
    return { content: [{ type: "text", text: JSON.stringify(categories) }] };
  }

  if (name === "list_tags") {
    const tags = await listTags();
    return { content: [{ type: "text", text: JSON.stringify(tags) }] };
  }

  if (name === "get_recent_updates") {
    const docs = await getRecentUpdates(args?.since_hours as number | undefined);
    return { content: [{ type: "text", text: JSON.stringify(docs) }] };
  }

  if (name === "record_feedback") {
    await recordFeedback({
      sessionId: args!.session_id as string,
      question: args!.question as string,
      answer: args!.answer as string,
      rating: args!.rating as "up" | "down",
      documentIds: args!.document_ids as string[],
    });
    return { content: [{ type: "text", text: JSON.stringify({ ok: true }) }] };
  }

  throw new Error(`Tool desconocida: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);

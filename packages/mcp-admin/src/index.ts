import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { listDocuments, deleteDocument } from "./tools.js";

const server = new Server(
  { name: "nalakalu-admin-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_documents",
      description: "Lista todos los procedimientos activos",
      inputSchema: {
        type: "object",
        properties: { category: { type: "string", description: "Filtrar por categoría (opcional)" } },
      },
    },
    {
      name: "delete_document",
      description: "Desactiva un procedimiento (soft delete)",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "list_documents") {
    const docs = await listDocuments(args?.category as string | undefined);
    return { content: [{ type: "text", text: JSON.stringify(docs) }] };
  }
  if (name === "delete_document") {
    await deleteDocument(args!.id as string);
    return { content: [{ type: "text", text: JSON.stringify({ ok: true }) }] };
  }
  throw new Error(`Tool desconocida: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);

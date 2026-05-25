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
import { searchProcedures, getDocument, listCategories } from "./tools.js";

const server = new Server(
  { name: "nalakalu-documents-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_procedures",
      description: "Busca en los procedimientos de la empresa y responde preguntas",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string", description: "Pregunta del trabajador" } },
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
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "search_procedures") {
    const result = await searchProcedures(args!.query as string);
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

  throw new Error(`Tool desconocida: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);

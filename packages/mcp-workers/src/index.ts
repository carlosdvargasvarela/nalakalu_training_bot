import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { getSession, identifyWorker, saveMessage, getHistory } from "./tools.js";

const server = new Server(
  { name: "nalakalu-workers-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_session",
      description: "Crea una sesión anónima para el trabajador",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "identify_worker",
      description: "Asocia un número de empleado a la sesión activa",
      inputSchema: {
        type: "object",
        properties: {
          session_id: { type: "string" },
          worker_number: { type: "string" },
        },
        required: ["session_id", "worker_number"],
      },
    },
    {
      name: "save_message",
      description: "Guarda un mensaje del historial de la conversación",
      inputSchema: {
        type: "object",
        properties: {
          session_id: { type: "string" },
          role: { type: "string", enum: ["user", "assistant"] },
          content: { type: "string" },
        },
        required: ["session_id", "role", "content"],
      },
    },
    {
      name: "get_history",
      description: "Obtiene los últimos mensajes de la conversación de una sesión",
      inputSchema: {
        type: "object",
        properties: {
          session_id: { type: "string" },
          limit: { type: "number", description: "Cantidad máxima de mensajes (default 6)" },
        },
        required: ["session_id"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "get_session") {
    return { content: [{ type: "text", text: JSON.stringify(await getSession()) }] };
  }
  if (name === "identify_worker") {
    const session = await identifyWorker(args!.session_id as string, args!.worker_number as string);
    return { content: [{ type: "text", text: JSON.stringify(session) }] };
  }
  if (name === "save_message") {
    await saveMessage(
      args!.session_id as string,
      args!.role as "user" | "assistant",
      args!.content as string
    );
    return { content: [{ type: "text", text: JSON.stringify({ ok: true }) }] };
  }
  if (name === "get_history") {
    const history = await getHistory(args!.session_id as string, args?.limit as number | undefined);
    return { content: [{ type: "text", text: JSON.stringify(history) }] };
  }
  throw new Error(`Tool desconocida: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);

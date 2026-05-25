import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { getSession, identifyWorker } from "./tools.js";

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
  throw new Error(`Tool desconocida: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);

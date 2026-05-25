import type { FastifyInstance } from "fastify";
import { getDocumentsClient, getWorkersClient } from "../mcp-client.js";

interface ChatBody {
  message: string;
  sessionId?: string;
}

type McpTextContent = { type: string; text: string };
type McpResult = { content: McpTextContent[] };

function parseToolResult(result: unknown): string {
  return ((result as McpResult).content[0] as McpTextContent).text;
}

export async function chatRoutes(app: FastifyInstance) {
  app.post<{ Body: ChatBody }>("/chat", async (request, reply) => {
    const { message, sessionId } = request.body;

    const workersClient = await getWorkersClient();
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const sessionResult = await workersClient.callTool({ name: "get_session", arguments: {} });
      const session = JSON.parse(parseToolResult(sessionResult));
      currentSessionId = session.id as string;
    }

    const docsClient = await getDocumentsClient();
    const searchResult = await docsClient.callTool({
      name: "search_procedures",
      arguments: { query: message },
    });
    const { answer, references } = JSON.parse(parseToolResult(searchResult)) as {
      answer: string;
      references: unknown[];
    };

    reply.send({ answer, references, sessionId: currentSessionId });
  });

  app.get<{ Params: { id: string } }>("/chat/document/:id", async (request, reply) => {
    const docsClient = await getDocumentsClient();
    const result = await docsClient.callTool({
      name: "get_document",
      arguments: { id: request.params.id },
    });
    const doc = JSON.parse(parseToolResult(result)) as unknown;
    reply.send(doc);
  });
}

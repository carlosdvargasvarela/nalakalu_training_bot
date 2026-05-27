import type { FastifyInstance } from "fastify";
import { getDocumentsClient, getWorkersClient } from "../mcp-client.js";

interface ChatBody {
  message: string;
  sessionId?: string;
  tag_context?: string[];
}

type McpTextContent = { type: string; text: string };
type McpResult = { content: McpTextContent[] };

function parseToolResult(result: unknown): string {
  return ((result as McpResult).content[0] as McpTextContent).text;
}

export async function chatRoutes(app: FastifyInstance) {
  app.post<{ Body: ChatBody }>("/chat", async (request, reply) => {
    const { message, sessionId, tag_context } = request.body;

    const workersClient = await getWorkersClient();
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const sessionResult = await workersClient.callTool({ name: "get_session", arguments: {} });
      const session = JSON.parse(parseToolResult(sessionResult));
      currentSessionId = session.id as string;
    }

    const docsClient = await getDocumentsClient();
    const searchArgs: Record<string, unknown> = { query: message };
    if (tag_context && tag_context.length > 0) {
      searchArgs.tags = tag_context;
    }

    const searchResult = await docsClient.callTool({
      name: "search_procedures",
      arguments: searchArgs,
    });
    const parsed = JSON.parse(parseToolResult(searchResult)) as {
      answer: string;
      references: unknown[];
      tagFallback?: boolean;
    };

    reply.send({
      answer: parsed.answer,
      references: parsed.references,
      sessionId: currentSessionId,
      tagFallback: parsed.tagFallback ?? false,
    });
  });

  app.get("/chat/tags", async (_request, reply) => {
    const docsClient = await getDocumentsClient();
    const result = await docsClient.callTool({ name: "list_tags", arguments: {} });
    const tags = JSON.parse(parseToolResult(result)) as string[];
    reply.send(tags);
  });

  app.get("/chat/recent-updates", async (_request, reply) => {
    const docsClient = await getDocumentsClient();
    const result = await docsClient.callTool({ name: "get_recent_updates", arguments: {} });
    const updates = JSON.parse(parseToolResult(result)) as unknown[];
    reply.send(updates);
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

import { describe, it, expect, vi } from "vitest";

const { mockDocsCallTool, mockWorkersCallTool } = vi.hoisted(() => ({
  mockDocsCallTool: vi.fn().mockResolvedValue({
    content: [
      {
        type: "text",
        text: JSON.stringify({
          answer: "El ensamble del cajón tipo B requiere 3 pasos...",
          references: [{ documentId: "doc-1", section: "P-047" }],
        }),
      },
    ],
  }),
  mockWorkersCallTool: vi.fn().mockResolvedValue({
    content: [{ type: "text", text: JSON.stringify({ id: "sess-1", workerId: null }) }],
  }),
}));

vi.mock("../mcp-client.js", () => ({
  getDocumentsClient: vi.fn().mockResolvedValue({ callTool: mockDocsCallTool }),
  getWorkersClient: vi.fn().mockResolvedValue({ callTool: mockWorkersCallTool }),
}));

import Fastify from "fastify";
import { chatRoutes } from "../routes/chat.js";

const app = Fastify({ logger: false });
app.register(chatRoutes, { prefix: "/api" });
await app.ready();

describe("POST /api/chat", () => {
  it("retorna respuesta y referencias del documento", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "¿Cómo ensamblo el cajón tipo B?", sessionId: "sess-1" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.answer).toContain("cajón tipo B");
    expect(body.references).toHaveLength(1);
    expect(body.sessionId).toBe("sess-1");
  });

  it("crea nueva sesión si no se pasa sessionId", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "Hola" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.sessionId).toBe("sess-1");
  });
});

describe("POST /api/chat/feedback", () => {
  it("reenvía el feedback al tool record_feedback", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/chat/feedback",
      payload: {
        sessionId: "sess-1",
        question: "¿Cómo ensamblo el cajón tipo B?",
        answer: "Paso 1...",
        rating: "up",
        documentIds: ["doc-1"],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(mockDocsCallTool).toHaveBeenCalledWith({
      name: "record_feedback",
      arguments: {
        session_id: "sess-1",
        question: "¿Cómo ensamblo el cajón tipo B?",
        answer: "Paso 1...",
        rating: "up",
        document_ids: ["doc-1"],
      },
    });
  });
});

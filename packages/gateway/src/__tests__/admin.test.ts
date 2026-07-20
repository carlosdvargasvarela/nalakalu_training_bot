import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCallTool = vi.hoisted(() => vi.fn());

vi.mock("../mcp-client.js", () => ({
  getAdminClient: vi.fn().mockResolvedValue({ callTool: mockCallTool }),
}));

vi.mock("@nalakalu/mcp-documents/ingest", () => ({
  ingestDocument: vi.fn(),
}));

import Fastify from "fastify";
import { adminRoutes } from "../routes/admin.js";

const app = Fastify({ logger: false });
app.register(adminRoutes, { prefix: "/api/admin" });
await app.ready();

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_SECRET = "test-secret";
});

describe("PATCH /api/admin/documents/:id", () => {
  it("reenvía la actualización de categoría/tags al tool update_document", async () => {
    mockCallTool.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify({ ok: true }) }],
    });

    const res = await app.inject({
      method: "PATCH",
      url: "/api/admin/documents/doc-1",
      headers: { "x-admin-secret": "test-secret" },
      payload: { category: "Seguridad", tags: ["epp"] },
    });

    expect(res.statusCode).toBe(200);
    expect(mockCallTool).toHaveBeenCalledWith({
      name: "update_document",
      arguments: { id: "doc-1", category: "Seguridad", tags: ["epp"] },
    });
  });

  it("rechaza sin el header x-admin-secret correcto", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/admin/documents/doc-1",
      payload: { category: "Seguridad", tags: ["epp"] },
    });

    expect(res.statusCode).toBe(401);
    expect(mockCallTool).not.toHaveBeenCalled();
  });
});

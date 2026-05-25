import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { queryAbacus, indexDocument } from "../abacus.js";

describe("abacus client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ABACUS_API_KEY = "test-key";
    process.env.ABACUS_DEPLOYMENT_ID = "test-deployment";
    process.env.ABACUS_DEPLOYMENT_TOKEN = "test-token";
  });

  it("queryAbacus calls the deployment API and returns answer + sources", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          answer: "El cajón tipo B se ensambla en 3 pasos...",
          references: [{ documentId: "doc-123", section: "Procedimiento P-047" }],
        },
      }),
    });

    const result = await queryAbacus("¿Cómo ensamblo el cajón tipo B?");

    expect(result.answer).toContain("cajón tipo B");
    expect(result.references).toHaveLength(1);
    expect(result.references[0].documentId).toBe("doc-123");
  });

  it("indexDocument returns the abacusDocId on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { docId: "abacus-doc-456" } }),
    });

    const docId = await indexDocument("proc-123", "Procedimiento de ensamble...");
    expect(docId).toBe("abacus-doc-456");
  });

  it("queryAbacus throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    await expect(queryAbacus("pregunta")).rejects.toThrow("AbacusAI error 500");
  });
});

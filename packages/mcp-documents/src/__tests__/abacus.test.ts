import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted evita el problema de hoisting con variables referenciadas en vi.mock
const mockCreate = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

import { queryAbacus } from "../abacus.js";

const mockDocs = [
  {
    id: "doc-1",
    original_name: "P-047 Ensamble cajón",
    category: "Ensamble",
    content: "El cajón tipo B se ensambla en 3 pasos: paso 1...",
    updated_at: new Date("2026-07-15T12:00:00.000Z"),
  },
];

describe("queryAbacus (Claude)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  it("llama a Claude y devuelve respuesta + referencias con updatedAt", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "El cajón tipo B se ensambla en 3 pasos..." }],
    });

    const result = await queryAbacus("¿Cómo ensamblo el cajón tipo B?", mockDocs);

    expect(result.answer).toContain("cajón tipo B");
    expect(result.references).toHaveLength(1);
    expect(result.references[0].documentId).toBe("doc-1");
    expect(result.references[0].updatedAt).toBe("2026-07-15T12:00:00.000Z");
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("devuelve mensaje de sin resultados cuando no hay documentos", async () => {
    const result = await queryAbacus("pregunta sin docs", []);

    expect(result.answer).toContain("No encontré");
    expect(result.references).toHaveLength(0);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

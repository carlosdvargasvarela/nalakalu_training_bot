import { describe, it, expect, vi } from "vitest";

vi.mock("@nalakalu/db", () => ({
  getDb: () => ({
    query: vi.fn()
      .mockResolvedValueOnce({
        rows: [
          { id: "d1", original_name: "proc-ensamble.pdf", category: "Ensamble", created_at: new Date("2026-01-01") }
        ]
      })
      .mockResolvedValueOnce({ rows: [] }),
  }),
}));

import { listDocuments, deleteDocument } from "../tools.js";

describe("admin-mcp tools", () => {
  it("listDocuments retorna array de documentos activos", async () => {
    const docs = await listDocuments();
    expect(docs).toHaveLength(1);
    expect(docs[0].originalName).toBe("proc-ensamble.pdf");
    expect(docs[0].category).toBe("Ensamble");
  });

  it("deleteDocument marca documento como inactivo sin lanzar error", async () => {
    await expect(deleteDocument("d1")).resolves.not.toThrow();
  });
});

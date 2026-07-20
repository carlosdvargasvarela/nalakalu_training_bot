import { describe, it, expect, vi, beforeEach } from "vitest";

const mockQuery = vi.fn();

vi.mock("@nalakalu/db", () => ({
  getDb: () => ({ query: mockQuery }),
}));

import { listDocuments, deleteDocument, updateDocument } from "../tools.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin-mcp tools", () => {
  it("listDocuments retorna array de documentos activos", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: "d1", original_name: "proc-ensamble.pdf", category: "Ensamble", tags: [], created_at: new Date("2026-01-01") },
      ],
    });

    const docs = await listDocuments();
    expect(docs).toHaveLength(1);
    expect(docs[0].originalName).toBe("proc-ensamble.pdf");
    expect(docs[0].category).toBe("Ensamble");
  });

  it("deleteDocument marca documento como inactivo sin lanzar error", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(deleteDocument("d1")).resolves.not.toThrow();
  });

  it("updateDocument actualiza categoría y tags", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await updateDocument("d1", { category: "Seguridad", tags: ["epp", "obligatorio"] });

    expect(mockQuery).toHaveBeenCalledOnce();
    const sql: string = mockQuery.mock.calls[0][0];
    const params = mockQuery.mock.calls[0][1];
    expect(sql).toContain("UPDATE documents SET category");
    expect(params).toEqual(["Seguridad", ["epp", "obligatorio"], "d1"]);
  });
});

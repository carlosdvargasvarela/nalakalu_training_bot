import { describe, it, expect, vi } from "vitest";

vi.mock("../r2.js", () => ({ uploadToR2: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../abacus.js", () => ({ indexDocument: vi.fn().mockResolvedValue("abacus-789") }));
vi.mock("@nalakalu/db", () => ({
  getDb: () => ({
    query: vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: "doc-uuid-1" }] })  // INSERT RETURNING
      .mockResolvedValueOnce({ rows: [] }),                        // UPDATE abacus_doc_id
  }),
}));

import { ingestDocument } from "../ingest.js";
import { uploadToR2 } from "../r2.js";
import { indexDocument } from "../abacus.js";

describe("ingestDocument", () => {
  it("sube el archivo a R2 e indexa en AbacusAI", async () => {
    const buffer = Buffer.from("contenido del procedimiento");
    const result = await ingestDocument({
      filename: "procedimiento-ensamble.pdf",
      buffer,
      contentType: "application/pdf",
      category: "Ensamble",
      uploadedBy: "admin@empresa.com",
    });

    expect(uploadToR2).toHaveBeenCalledWith(
      expect.stringContaining("procedimiento-ensamble"),
      buffer,
      "application/pdf"
    );
    expect(indexDocument).toHaveBeenCalledWith("doc-uuid-1", expect.any(String));
    expect(result.id).toBe("doc-uuid-1");
    expect(result.abacusDocId).toBe("abacus-789");
  });
});

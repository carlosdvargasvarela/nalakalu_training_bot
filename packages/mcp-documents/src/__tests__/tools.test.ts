import { describe, it, expect, vi, beforeEach } from "vitest";

const mockQuery = vi.fn();

vi.mock("@nalakalu/db", () => ({
  getDb: () => ({ query: mockQuery }),
}));

vi.mock("../abacus.js", () => ({
  queryAbacus: vi.fn().mockResolvedValue({
    answer: "Respuesta de prueba",
    references: [],
  }),
}));

vi.mock("../r2.js", () => ({
  getPresignedUrl: vi.fn().mockResolvedValue("https://r2.example.com/doc"),
  getObjectBuffer: vi.fn().mockResolvedValue(Buffer.from("docx binary")),
}));

vi.mock("mammoth", () => ({
  convertToHtml: vi.fn().mockResolvedValue({ value: "<p>contenido convertido</p>" }),
}));

import { searchProcedures, listTags, getRecentUpdates, recordFeedback, getDocument } from "../tools.js";
import { queryAbacus } from "../abacus.js";
import { getObjectBuffer } from "../r2.js";
import * as mammoth from "mammoth";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("searchProcedures", () => {
  it("busca sin tags — llama queryAbacus con todos los docs relevantes", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: "d1", original_name: "proc.pdf", category: "Ensamble", content: "contenido" },
      ],
    });

    await searchProcedures("¿cómo ensamblar?");

    expect(mockQuery).toHaveBeenCalledOnce();
    const sql: string = mockQuery.mock.calls[0][0];
    expect(sql).not.toContain("tags @>");
    expect(sql).toContain("updated_at");
    expect(queryAbacus).toHaveBeenCalledWith("¿cómo ensamblar?", expect.any(Array));
  });

  it("busca con tags — incluye filtro tags @> en la query", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: "d2", original_name: "seg.pdf", category: "Seguridad", content: "epp obligatorio" },
      ],
    });

    await searchProcedures("¿qué EPP usar?", ["Seguridad"]);

    const sql: string = mockQuery.mock.calls[0][0];
    expect(sql).toContain("tags @>");
    const params = mockQuery.mock.calls[0][1];
    expect(params).toContain("¿qué EPP usar?");
    expect(params).toContainEqual(["Seguridad"]);
  });

  it("con tags pero sin docs — hace fallback sin filtro y retorna tagFallback:true", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })          // primera query con tags
      .mockResolvedValueOnce({                       // fallback sin tags
        rows: [{ id: "d3", original_name: "gen.pdf", category: null, content: "general" }],
      });

    const result = await searchProcedures("algo", ["TagInexistente"]);

    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(result.tagFallback).toBe(true);
  });
});

describe("listTags", () => {
  it("retorna array de tags únicos ordenados", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ tag: "Ensamble" }, { tag: "Seguridad" }],
    });

    const tags = await listTags();
    expect(tags).toEqual(["Ensamble", "Seguridad"]);
  });

  it("retorna array vacío si no hay tags", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const tags = await listTags();
    expect(tags).toEqual([]);
  });
});

describe("getRecentUpdates", () => {
  it("retorna documentos actualizados en las últimas N horas", async () => {
    const now = new Date();
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "d4",
          original_name: "nuevo.pdf",
          tags: ["Ensamble"],
          updated_at: now,
        },
      ],
    });

    const docs = await getRecentUpdates(24);
    expect(docs).toHaveLength(1);
    expect(docs[0].originalName).toBe("nuevo.pdf");
    expect(docs[0].tags).toEqual(["Ensamble"]);
  });
});

describe("getDocument", () => {
  it("PDF — no convierte a HTML, previewHtml es null", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "d5", original_name: "proc.pdf", category: "Ensamble", r2_key: "docs/proc.pdf" }],
    });

    const doc = await getDocument("d5");

    expect(doc.previewHtml).toBeNull();
    expect(doc.downloadUrl).toBe("https://r2.example.com/doc");
    expect(getObjectBuffer).not.toHaveBeenCalled();
  });

  it("docx — convierte el contenido a HTML con mammoth", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "d6", original_name: "proc.docx", category: null, r2_key: "docs/proc.docx" }],
    });

    const doc = await getDocument("d6");

    expect(getObjectBuffer).toHaveBeenCalledWith("docs/proc.docx");
    expect(mammoth.convertToHtml).toHaveBeenCalledWith({ buffer: Buffer.from("docx binary") });
    expect(doc.previewHtml).toBe("<p>contenido convertido</p>");
  });
});

describe("recordFeedback", () => {
  it("inserta el feedback con los campos correctos", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await recordFeedback({
      sessionId: "sess-1",
      question: "¿Cómo ensamblo el cajón tipo B?",
      answer: "Paso 1...",
      rating: "up",
      documentIds: ["doc-1"],
    });

    expect(mockQuery).toHaveBeenCalledOnce();
    const sql: string = mockQuery.mock.calls[0][0];
    const params = mockQuery.mock.calls[0][1];
    expect(sql).toContain("INSERT INTO message_feedback");
    expect(params).toEqual(["sess-1", "¿Cómo ensamblo el cajón tipo B?", "Paso 1...", "up", ["doc-1"]]);
  });
});

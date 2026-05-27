import { randomUUID } from "crypto";
import { uploadToR2 } from "./r2.js";
import { indexDocument } from "./abacus.js";
import { getDb } from "@nalakalu/db";

export interface IngestInput {
  filename: string;
  buffer: Buffer;
  contentType: string;
  category?: string;
  uploadedBy?: string;
}

export interface IngestResult {
  id: string;
  r2Key: string;
  abacusDocId: string;
}

async function extractText(buffer: Buffer, contentType: string, filename: string): Promise<string> {
  const lowerName = filename.toLowerCase();

  if (contentType === "application/pdf" || lowerName.endsWith(".pdf")) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer, verbosity: 0 });
    const result = await parser.getText({});
    return result.text;
  }

  if (
    contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx")
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (contentType === "application/msword" || lowerName.endsWith(".doc")) {
    // .doc is OLE binary — extract printable latin-1 text best-effort
    return buffer
      .toString("latin1")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ")
      .replace(/ {3,}/g, "  ")
      .trim();
  }

  // Plain text / fallback — strip null bytes for Postgres UTF8 safety
  return buffer.toString("utf-8").replace(/\0/g, "");
}

export async function ingestDocument(input: IngestInput): Promise<IngestResult> {
  const db = getDb();
  const r2Key = `docs/${randomUUID()}-${input.filename}`;

  await uploadToR2(r2Key, input.buffer, input.contentType);

  const textContent = await extractText(input.buffer, input.contentType, input.filename);

  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO documents (filename, original_name, category, r2_key, uploaded_by, content)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [r2Key, input.filename, input.category ?? null, r2Key, input.uploadedBy ?? null, textContent]
  );
  const docId = rows[0].id;

  const abacusDocId = await indexDocument(docId, textContent, input.filename);

  await db.query(
    "UPDATE documents SET abacus_doc_id = $1 WHERE id = $2",
    [abacusDocId, docId]
  );

  return { id: docId, r2Key, abacusDocId };
}

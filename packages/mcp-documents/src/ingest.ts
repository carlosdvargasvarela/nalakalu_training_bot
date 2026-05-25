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

export async function ingestDocument(input: IngestInput): Promise<IngestResult> {
  const db = getDb();
  const r2Key = `docs/${randomUUID()}-${input.filename}`;

  await uploadToR2(r2Key, input.buffer, input.contentType);

  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO documents (filename, original_name, category, r2_key, uploaded_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [r2Key, input.filename, input.category ?? null, r2Key, input.uploadedBy ?? null]
  );
  const docId = rows[0].id;

  const textContent = `[Documento: ${input.filename}]\n${input.buffer.toString("utf-8").slice(0, 10000)}`;
  const abacusDocId = await indexDocument(docId, textContent);

  await db.query(
    "UPDATE documents SET abacus_doc_id = $1 WHERE id = $2",
    [abacusDocId, docId]
  );

  return { id: docId, r2Key, abacusDocId };
}

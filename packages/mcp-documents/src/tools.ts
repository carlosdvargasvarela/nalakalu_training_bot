import { getDb } from "@nalakalu/db";
import { queryAbacus, AbacusQueryResult } from "./abacus.js";
import { getPresignedUrl } from "./r2.js";

interface DocRow {
  id: string;
  original_name: string;
  category: string | null;
  content: string;
  updated_at: Date;
}

export interface SearchResult extends AbacusQueryResult {
  tagFallback?: boolean;
}

async function fetchDocs(query: string, tags?: string[]): Promise<DocRow[]> {
  const db = getDb();
  const params: unknown[] = [query];
  let tagFilter = "";

  if (tags && tags.length > 0) {
    params.push(tags);
    tagFilter = `AND tags @> $${params.length}::text[]`;
  }

  const { rows } = await db.query<DocRow>(
    `SELECT id, original_name, category, updated_at, coalesce(content, '') AS content
     FROM documents
     WHERE active = TRUE
       AND content IS NOT NULL
       ${tagFilter}
     ORDER BY
       ts_rank(
         to_tsvector('spanish', coalesce(content, '')),
         plainto_tsquery('spanish', $1)
       ) DESC,
       created_at DESC
     LIMIT 4`,
    params
  );
  return rows;
}

export async function searchProcedures(
  query: string,
  tags?: string[]
): Promise<SearchResult> {
  let rows = await fetchDocs(query, tags);

  if (tags && tags.length > 0 && rows.length === 0) {
    rows = await fetchDocs(query);
    const result = await queryAbacus(query, rows);
    return { ...result, tagFallback: true };
  }

  return queryAbacus(query, rows);
}

export async function getDocument(id: string): Promise<{
  id: string;
  originalName: string;
  category: string | null;
  downloadUrl: string;
}> {
  const db = getDb();
  const { rows } = await db.query<{
    id: string;
    original_name: string;
    category: string | null;
    r2_key: string;
  }>(
    "SELECT id, original_name, category, r2_key FROM documents WHERE id = $1 AND active = TRUE",
    [id]
  );
  if (!rows[0]) throw new Error(`Documento ${id} no encontrado`);
  const url = await getPresignedUrl(rows[0].r2_key);
  return {
    id: rows[0].id,
    originalName: rows[0].original_name,
    category: rows[0].category,
    downloadUrl: url,
  };
}

export async function listCategories(): Promise<string[]> {
  const db = getDb();
  const { rows } = await db.query<{ category: string }>(
    "SELECT DISTINCT category FROM documents WHERE active = TRUE AND category IS NOT NULL ORDER BY category"
  );
  return rows.map((r) => r.category);
}

export async function listTags(): Promise<string[]> {
  const db = getDb();
  const { rows } = await db.query<{ tag: string }>(
    `SELECT DISTINCT unnest(tags) AS tag
     FROM documents
     WHERE active = TRUE
     ORDER BY tag`
  );
  return rows.map((r) => r.tag);
}

export interface RecentUpdate {
  id: string;
  originalName: string;
  tags: string[];
  updatedAt: string;
}

export async function getRecentUpdates(sinceHours = 24): Promise<RecentUpdate[]> {
  const db = getDb();
  const { rows } = await db.query<{
    id: string;
    original_name: string;
    tags: string[];
    updated_at: Date;
  }>(
    `SELECT id, original_name, tags, updated_at
     FROM documents
     WHERE active = TRUE
       AND updated_at >= NOW() - ($1 || ' hours')::interval
     ORDER BY updated_at DESC`,
    [sinceHours]
  );
  return rows.map((r) => ({
    id: r.id,
    originalName: r.original_name,
    tags: r.tags,
    updatedAt: r.updated_at.toISOString(),
  }));
}

export async function recordFeedback(input: {
  sessionId: string;
  question: string;
  answer: string;
  rating: "up" | "down";
  documentIds: string[];
}): Promise<void> {
  const db = getDb();
  await db.query(
    `INSERT INTO message_feedback (session_id, question, answer, rating, document_ids)
     VALUES ($1, $2, $3, $4, $5)`,
    [input.sessionId, input.question, input.answer, input.rating, input.documentIds]
  );
}

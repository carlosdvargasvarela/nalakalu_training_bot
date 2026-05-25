import { getDb } from "@nalakalu/db";
import { queryAbacus, AbacusQueryResult } from "./abacus.js";
import { getPresignedUrl } from "./r2.js";

export async function searchProcedures(query: string): Promise<AbacusQueryResult> {
  return queryAbacus(query);
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

import { getDb } from "@nalakalu/db";

export interface DocumentMeta {
  id: string;
  originalName: string;
  category: string | null;
  createdAt: Date;
}

export async function listDocuments(category?: string): Promise<DocumentMeta[]> {
  const db = getDb();
  const { rows } = await db.query<{
    id: string;
    original_name: string;
    category: string | null;
    created_at: Date;
  }>(
    category
      ? "SELECT id, original_name, category, created_at FROM documents WHERE active = TRUE AND category = $1 ORDER BY created_at DESC"
      : "SELECT id, original_name, category, created_at FROM documents WHERE active = TRUE ORDER BY created_at DESC",
    category ? [category] : []
  );
  return rows.map((r) => ({
    id: r.id,
    originalName: r.original_name,
    category: r.category,
    createdAt: r.created_at,
  }));
}

export async function deleteDocument(id: string): Promise<void> {
  const db = getDb();
  await db.query("UPDATE documents SET active = FALSE WHERE id = $1", [id]);
}

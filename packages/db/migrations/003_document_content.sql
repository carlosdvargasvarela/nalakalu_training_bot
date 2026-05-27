ALTER TABLE documents ADD COLUMN IF NOT EXISTS content TEXT;

CREATE INDEX IF NOT EXISTS documents_search_idx
  ON documents USING gin(to_tsvector('spanish', coalesce(content, '')));

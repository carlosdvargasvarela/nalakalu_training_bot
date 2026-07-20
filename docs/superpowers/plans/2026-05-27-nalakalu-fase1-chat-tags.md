# Nalakalu Fase 1 — Chat Mejorado + Sistema de Tags

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir tags a los procedimientos para filtrar búsquedas RAG, enriquecer el chat con pasos interactivos, favoritos, historial y texto grande, y mostrar un banner cuando se actualiza un documento.

**Architecture:** La búsqueda ya usa PostgreSQL FTS + Claude Haiku (no AbacusAI externo). Agregar tags es un WHERE adicional en la query FTS. Todo el estado del chat (favoritos, historial, preferencias) vive en `localStorage` — sin cambios en el schema de sesiones. El frontend usa ReactMarkdown; los pasos interactivos son un renderer `ol` customizado.

**Tech Stack:** PostgreSQL (GIN index), TypeScript ESM, `@modelcontextprotocol/sdk`, Fastify, Next.js 14, React 18, Tailwind CSS, Vitest.

---

## Mapa de archivos

| Archivo | Tipo | Qué hace |
|---------|------|----------|
| `packages/db/migrations/004_tags_and_updated_at.sql` | Nuevo | Columnas `tags` y `updated_at` en `documents` |
| `packages/mcp-documents/src/tools.ts` | Modifica | `searchProcedures` acepta `tags[]`; nuevas: `listTags`, `getRecentUpdates` |
| `packages/mcp-documents/src/ingest.ts` | Modifica | `IngestInput` incluye `tags[]`; soft-replace por `original_name` |
| `packages/mcp-documents/src/index.ts` | Modifica | Registra las 2 tools nuevas, actualiza schema de `search_procedures` |
| `packages/mcp-documents/src/__tests__/tools.test.ts` | Nuevo | Tests unitarios de `searchProcedures`, `listTags`, `getRecentUpdates` |
| `packages/gateway/src/routes/chat.ts` | Modifica | `POST /chat` acepta `tag_context[]`; nuevas `GET /chat/tags` y `GET /chat/recent-updates` |
| `packages/gateway/src/routes/admin.ts` | Modifica | `POST /documents` acepta `tags`, hace soft-replace |
| `packages/frontend/src/lib/api.ts` | Modifica | `sendMessage` acepta `tagContext`; nuevas `fetchTags`, `fetchRecentUpdates` |
| `packages/frontend/src/lib/localStorage.ts` | Nuevo | Utilidades para favoritos, historial, tamaño de texto, banner |
| `packages/frontend/src/components/TagChips.tsx` | Nuevo | Chips horizontales de tags |
| `packages/frontend/src/components/UpdateBanner.tsx` | Nuevo | Banner dismissible de procedimiento actualizado |
| `packages/frontend/src/components/StepChecklist.tsx` | Nuevo | Renderer `ol` con checkboxes para ReactMarkdown |
| `packages/frontend/src/components/FavoritesDrawer.tsx` | Nuevo | Cajón de favoritos guardados |
| `packages/frontend/src/components/HistoryDrawer.tsx` | Nuevo | Cajón de historial de preguntas |
| `packages/frontend/src/components/MessageBubble.tsx` | Modifica | Usa `StepChecklist` como renderer `ol` |
| `packages/frontend/src/components/Chat.tsx` | Modifica | Conecta todos los nuevos componentes |
| `packages/frontend/src/app/admin/page.tsx` | Modifica | Campo `tags` en formulario de subida; muestra tags en lista |

---

## Task 1: Migración 004 — tags y updated_at

**Files:**
- Create: `packages/db/migrations/004_tags_and_updated_at.sql`

- [ ] **Step 1: Escribir la migración**

`packages/db/migrations/004_tags_and_updated_at.sql`:
```sql
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING GIN (tags);
```

- [ ] **Step 2: Ejecutar la migración**

```bash
cd nalakalu && npm run db:migrate
```

Expected output:
```
Applying migration: 004_tags_and_updated_at.sql
Migrations complete.
```

- [ ] **Step 3: Commit**

```bash
git add packages/db/migrations/004_tags_and_updated_at.sql
git commit -m "feat(db): columnas tags y updated_at en documents"
```

---

## Task 2: mcp-documents — tools con filtro de tags y tools nuevas

**Files:**
- Create: `packages/mcp-documents/src/__tests__/tools.test.ts`
- Modify: `packages/mcp-documents/src/tools.ts`

- [ ] **Step 1: Escribir los tests (failing)**

`packages/mcp-documents/src/__tests__/tools.test.ts`:
```typescript
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
}));

import { searchProcedures, listTags, getRecentUpdates } from "../tools.js";
import { queryAbacus } from "../abacus.js";

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
```

- [ ] **Step 2: Ejecutar tests — verificar que fallan**

```bash
cd nalakalu/packages/mcp-documents && npx vitest run src/__tests__/tools.test.ts
```

Expected: FAIL — `Cannot find module '../tools.js'` o exports no encontrados.

- [ ] **Step 3: Implementar las modificaciones en tools.ts**

`packages/mcp-documents/src/tools.ts`:
```typescript
import { getDb } from "@nalakalu/db";
import { queryAbacus, AbacusQueryResult } from "./abacus.js";
import { getPresignedUrl } from "./r2.js";

interface DocRow {
  id: string;
  original_name: string;
  category: string | null;
  content: string;
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
    `SELECT id, original_name, category, coalesce(content, '') AS content
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
```

- [ ] **Step 4: Ejecutar tests — deben pasar**

```bash
npx vitest run src/__tests__/tools.test.ts
```

Expected: 6 PASS

- [ ] **Step 5: Commit**

```bash
cd ../..
git add packages/mcp-documents/src/tools.ts packages/mcp-documents/src/__tests__/tools.test.ts
git commit -m "feat(mcp-documents): searchProcedures con tags, listTags, getRecentUpdates"
```

---

## Task 3: mcp-documents — ingest con tags y soft-replace

**Files:**
- Modify: `packages/mcp-documents/src/ingest.ts`

- [ ] **Step 1: Modificar IngestInput y ingestDocument**

`packages/mcp-documents/src/ingest.ts` — reemplaza el archivo completo:
```typescript
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
  tags?: string[];
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
    return buffer
      .toString("latin1")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ")
      .replace(/ {3,}/g, "  ")
      .trim();
  }

  return buffer.toString("utf-8").replace(/\0/g, "");
}

export async function ingestDocument(input: IngestInput): Promise<IngestResult> {
  const db = getDb();
  const r2Key = `docs/${randomUUID()}-${input.filename}`;
  const tags = input.tags ?? [];

  await uploadToR2(r2Key, input.buffer, input.contentType);

  const textContent = await extractText(input.buffer, input.contentType, input.filename);

  // Soft-replace: desactivar versión anterior si existe
  await db.query(
    "UPDATE documents SET active = FALSE WHERE original_name = $1 AND active = TRUE",
    [input.filename]
  );

  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO documents
       (filename, original_name, category, r2_key, uploaded_by, content, tags, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     RETURNING id`,
    [r2Key, input.filename, input.category ?? null, r2Key, input.uploadedBy ?? null, textContent, tags]
  );
  const docId = rows[0].id;

  const abacusDocId = await indexDocument(docId, textContent, input.filename);

  await db.query(
    "UPDATE documents SET abacus_doc_id = $1 WHERE id = $2",
    [abacusDocId, docId]
  );

  return { id: docId, r2Key, abacusDocId };
}
```

- [ ] **Step 2: Ejecutar tests de ingest existentes**

```bash
cd nalakalu/packages/mcp-documents && npx vitest run src/__tests__/ingest.test.ts
```

Expected: los tests existentes siguen en verde (el mock de getDb acepta el nuevo parámetro tags por ser flexible).

- [ ] **Step 3: Commit**

```bash
cd ../..
git add packages/mcp-documents/src/ingest.ts
git commit -m "feat(mcp-documents): IngestInput acepta tags[], soft-replace por filename"
```

---

## Task 4: mcp-documents — registrar tools nuevas en el servidor MCP

**Files:**
- Modify: `packages/mcp-documents/src/index.ts`

- [ ] **Step 1: Actualizar index.ts**

`packages/mcp-documents/src/index.ts`:
```typescript
import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  searchProcedures,
  getDocument,
  listCategories,
  listTags,
  getRecentUpdates,
} from "./tools.js";

const server = new Server(
  { name: "nalakalu-documents-mcp", version: "0.2.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_procedures",
      description: "Busca en los procedimientos de la empresa y responde preguntas",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Pregunta del trabajador" },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Filtrar por tags (opcional)",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "get_document",
      description: "Obtiene URL de descarga de un procedimiento por ID",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
    {
      name: "list_categories",
      description: "Lista las categorías de procedimientos disponibles",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "list_tags",
      description: "Lista todos los tags únicos de procedimientos activos",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_recent_updates",
      description: "Retorna procedimientos actualizados recientemente",
      inputSchema: {
        type: "object",
        properties: {
          since_hours: {
            type: "number",
            description: "Cuántas horas hacia atrás revisar (default 24)",
          },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "search_procedures") {
    const result = await searchProcedures(
      args!.query as string,
      args?.tags as string[] | undefined
    );
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }

  if (name === "get_document") {
    const doc = await getDocument(args!.id as string);
    return { content: [{ type: "text", text: JSON.stringify(doc) }] };
  }

  if (name === "list_categories") {
    const categories = await listCategories();
    return { content: [{ type: "text", text: JSON.stringify(categories) }] };
  }

  if (name === "list_tags") {
    const tags = await listTags();
    return { content: [{ type: "text", text: JSON.stringify(tags) }] };
  }

  if (name === "get_recent_updates") {
    const docs = await getRecentUpdates(args?.since_hours as number | undefined);
    return { content: [{ type: "text", text: JSON.stringify(docs) }] };
  }

  throw new Error(`Tool desconocida: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

- [ ] **Step 2: Build para verificar tipos**

```bash
cd nalakalu && npm run build -w @nalakalu/mcp-documents
```

Expected: sin errores TypeScript.

- [ ] **Step 3: Commit**

```bash
git add packages/mcp-documents/src/index.ts
git commit -m "feat(mcp-documents): registrar list_tags y get_recent_updates en servidor MCP"
```

---

## Task 5: mcp-admin — añadir tags a listDocuments

**Files:**
- Modify: `packages/mcp-admin/src/tools.ts`

La migración 004 agrega `tags TEXT[]` a `documents`. Sin esta tarea, el panel admin no puede mostrar ni devolver los tags de cada documento.

- [ ] **Step 1: Actualizar DocumentMeta y listDocuments**

`packages/mcp-admin/src/tools.ts`:
```typescript
import { getDb } from "@nalakalu/db";

export interface DocumentMeta {
  id: string;
  originalName: string;
  category: string | null;
  tags: string[];
  createdAt: Date;
}

export async function listDocuments(category?: string): Promise<DocumentMeta[]> {
  const db = getDb();
  const { rows } = await db.query<{
    id: string;
    original_name: string;
    category: string | null;
    tags: string[];
    created_at: Date;
  }>(
    category
      ? "SELECT id, original_name, category, tags, created_at FROM documents WHERE active = TRUE AND category = $1 ORDER BY created_at DESC"
      : "SELECT id, original_name, category, tags, created_at FROM documents WHERE active = TRUE ORDER BY created_at DESC",
    category ? [category] : []
  );
  return rows.map((r) => ({
    id: r.id,
    originalName: r.original_name,
    category: r.category,
    tags: r.tags,
    createdAt: r.created_at,
  }));
}

export async function deleteDocument(id: string): Promise<void> {
  const db = getDb();
  await db.query("UPDATE documents SET active = FALSE WHERE id = $1", [id]);
}
```

- [ ] **Step 2: Build para verificar tipos**

```bash
cd nalakalu && npm run build -w @nalakalu/mcp-admin
```

Expected: sin errores TypeScript.

- [ ] **Step 3: Commit**

```bash
git add packages/mcp-admin/src/tools.ts
git commit -m "feat(mcp-admin): listDocuments incluye tags[]"
```

---

## Task 6: gateway — nuevas rutas y modificaciones

**Files:**
- Modify: `packages/gateway/src/routes/chat.ts`
- Modify: `packages/gateway/src/routes/admin.ts`

- [ ] **Step 1: Actualizar chat.ts**

`packages/gateway/src/routes/chat.ts`:
```typescript
import type { FastifyInstance } from "fastify";
import { getDocumentsClient, getWorkersClient } from "../mcp-client.js";

interface ChatBody {
  message: string;
  sessionId?: string;
  tag_context?: string[];
}

type McpTextContent = { type: string; text: string };
type McpResult = { content: McpTextContent[] };

function parseToolResult(result: unknown): string {
  return ((result as McpResult).content[0] as McpTextContent).text;
}

export async function chatRoutes(app: FastifyInstance) {
  app.post<{ Body: ChatBody }>("/chat", async (request, reply) => {
    const { message, sessionId, tag_context } = request.body;

    const workersClient = await getWorkersClient();
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const sessionResult = await workersClient.callTool({ name: "get_session", arguments: {} });
      const session = JSON.parse(parseToolResult(sessionResult));
      currentSessionId = session.id as string;
    }

    const docsClient = await getDocumentsClient();
    const searchArgs: Record<string, unknown> = { query: message };
    if (tag_context && tag_context.length > 0) {
      searchArgs.tags = tag_context;
    }

    const searchResult = await docsClient.callTool({
      name: "search_procedures",
      arguments: searchArgs,
    });
    const parsed = JSON.parse(parseToolResult(searchResult)) as {
      answer: string;
      references: unknown[];
      tagFallback?: boolean;
    };

    reply.send({
      answer: parsed.answer,
      references: parsed.references,
      sessionId: currentSessionId,
      tagFallback: parsed.tagFallback ?? false,
    });
  });

  app.get("/chat/tags", async (_request, reply) => {
    const docsClient = await getDocumentsClient();
    const result = await docsClient.callTool({ name: "list_tags", arguments: {} });
    const tags = JSON.parse(parseToolResult(result)) as string[];
    reply.send(tags);
  });

  app.get("/chat/recent-updates", async (_request, reply) => {
    const docsClient = await getDocumentsClient();
    const result = await docsClient.callTool({ name: "get_recent_updates", arguments: {} });
    const updates = JSON.parse(parseToolResult(result)) as unknown[];
    reply.send(updates);
  });

  app.get<{ Params: { id: string } }>("/chat/document/:id", async (request, reply) => {
    const docsClient = await getDocumentsClient();
    const result = await docsClient.callTool({
      name: "get_document",
      arguments: { id: request.params.id },
    });
    const doc = JSON.parse(parseToolResult(result)) as unknown;
    reply.send(doc);
  });
}
```

- [ ] **Step 2: Actualizar admin.ts para aceptar tags**

`packages/gateway/src/routes/admin.ts`:
```typescript
import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../middleware/auth.js";
import { getAdminClient } from "../mcp-client.js";
import { ingestDocument } from "@nalakalu/mcp-documents/ingest";

type McpTextContent = { type: string; text: string };
type McpResult = { content: McpTextContent[] };

function parseToolResult(result: unknown): string {
  return ((result as McpResult).content[0] as McpTextContent).text;
}

function parseTags(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

export async function adminRoutes(app: FastifyInstance) {
  app.get("/documents", { preHandler: requireAdmin }, async (request, reply) => {
    const adminClient = await getAdminClient();
    const result = await adminClient.callTool({ name: "list_documents", arguments: {} });
    const docs = JSON.parse(parseToolResult(result)) as unknown;
    reply.send(docs);
  });

  app.delete<{ Params: { id: string } }>(
    "/documents/:id",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const adminClient = await getAdminClient();
      await adminClient.callTool({ name: "delete_document", arguments: { id: request.params.id } });
      reply.send({ ok: true });
    }
  );

  app.post("/documents", { preHandler: requireAdmin }, async (request, reply) => {
    const data = await request.file({ limits: { fileSize: 20 * 1024 * 1024 } });
    if (!data) return reply.status(400).send({ error: "Archivo requerido" });

    const buffer = await data.toBuffer();
    const query = request.query as Record<string, string>;
    const result = await ingestDocument({
      filename: data.filename,
      buffer,
      contentType: data.mimetype,
      category: query.category,
      uploadedBy: request.headers["x-user"] as string | undefined,
      tags: parseTags(query.tags),
    });

    reply.status(201).send(result);
  });
}
```

- [ ] **Step 3: Build del gateway**

```bash
cd nalakalu && npm run build -w @nalakalu/gateway
```

Expected: sin errores TypeScript.

- [ ] **Step 4: Commit**

```bash
git add packages/gateway/src/routes/chat.ts packages/gateway/src/routes/admin.ts
git commit -m "feat(gateway): rutas GET /chat/tags y /chat/recent-updates; POST /chat acepta tag_context"
```

---

## Task 7: frontend — utilidades localStorage

**Files:**
- Create: `packages/frontend/src/lib/localStorage.ts`

- [ ] **Step 1: Crear localStorage.ts**

`packages/frontend/src/lib/localStorage.ts`:
```typescript
export interface Favorite {
  id: string;
  question: string;
  answer: string;
  tags: string[];
  savedAt: string;
}

export interface HistoryItem {
  question: string;
  askedAt: string;
}

const FAVORITES_KEY = "nalakalu_favorites";
const HISTORY_KEY = "nalakalu_history";
const TEXT_SIZE_KEY = "nalakalu_text_size";
const BANNER_KEY = "nalakalu_banner_dismissed";

export function getFavorites(): Favorite[] {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function addFavorite(item: Omit<Favorite, "id" | "savedAt">): void {
  const favs = getFavorites();
  favs.unshift({
    ...item,
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
  });
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs.slice(0, 50)));
}

export function removeFavorite(id: string): void {
  const favs = getFavorites().filter((f) => f.id !== id);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
}

export function getHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function addToHistory(question: string): void {
  const history = getHistory().filter((h) => h.question !== question);
  history.unshift({ question, askedAt: new Date().toISOString() });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
}

export type TextSize = "base" | "lg";

export function getTextSize(): TextSize {
  return (localStorage.getItem(TEXT_SIZE_KEY) as TextSize) ?? "base";
}

export function setTextSize(size: TextSize): void {
  localStorage.setItem(TEXT_SIZE_KEY, size);
}

export function isBannerDismissedToday(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return localStorage.getItem(BANNER_KEY) === today;
}

export function dismissBannerToday(): void {
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem(BANNER_KEY, today);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/src/lib/localStorage.ts
git commit -m "feat(frontend): utilidades localStorage para favoritos, historial y preferencias"
```

---

## Task 8: frontend — actualizar api.ts

**Files:**
- Modify: `packages/frontend/src/lib/api.ts`

- [ ] **Step 1: Actualizar api.ts**

`packages/frontend/src/lib/api.ts`:
```typescript
const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:3001";

export interface Reference {
  documentId: string;
  section: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  references?: Reference[];
}

export async function sendMessage(
  message: string,
  sessionId: string | null,
  tagContext?: string[]
): Promise<{
  answer: string;
  references: Reference[];
  sessionId: string;
  tagFallback: boolean;
}> {
  const res = await fetch(`${GATEWAY}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sessionId, tag_context: tagContext }),
  });
  if (!res.ok) throw new Error("Error al contactar el servidor");
  return res.json();
}

export async function getDocumentUrl(id: string): Promise<string> {
  const res = await fetch(`${GATEWAY}/api/chat/document/${id}`);
  if (!res.ok) throw new Error("Documento no encontrado");
  const data = await res.json();
  return data.downloadUrl;
}

export async function fetchTags(): Promise<string[]> {
  try {
    const res = await fetch(`${GATEWAY}/api/chat/tags`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export interface RecentUpdate {
  id: string;
  originalName: string;
  tags: string[];
  updatedAt: string;
}

export async function fetchRecentUpdates(): Promise<RecentUpdate[]> {
  try {
    const res = await fetch(`${GATEWAY}/api/chat/recent-updates`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/src/lib/api.ts
git commit -m "feat(frontend): api.ts con sendMessage(tagContext), fetchTags, fetchRecentUpdates"
```

---

## Task 9: frontend — componente TagChips

**Files:**
- Create: `packages/frontend/src/components/TagChips.tsx`

- [ ] **Step 1: Crear TagChips.tsx**

`packages/frontend/src/components/TagChips.tsx`:
```tsx
interface Props {
  tags: string[];
  activeTag: string | null;
  onSelect: (tag: string | null) => void;
}

export default function TagChips({ tags, activeTag, onSelect }: Props) {
  if (tags.length === 0) return null;

  return (
    <div className="flex gap-2 px-4 py-2 bg-slate-800 border-b border-slate-700 overflow-x-auto scrollbar-hide">
      {tags.map((tag) => {
        const isActive = tag === activeTag;
        return (
          <button
            key={tag}
            onClick={() => onSelect(isActive ? null : tag)}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              isActive
                ? "bg-blue-600 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/src/components/TagChips.tsx
git commit -m "feat(frontend): componente TagChips"
```

---

## Task 10: frontend — componente UpdateBanner

**Files:**
- Create: `packages/frontend/src/components/UpdateBanner.tsx`

- [ ] **Step 1: Crear UpdateBanner.tsx**

`packages/frontend/src/components/UpdateBanner.tsx`:
```tsx
"use client";

import { dismissBannerToday } from "@/lib/localStorage";
import type { RecentUpdate } from "@/lib/api";

interface Props {
  updates: RecentUpdate[];
  onDismiss: () => void;
}

export default function UpdateBanner({ updates, onDismiss }: Props) {
  if (updates.length === 0) return null;

  const names = updates.map((u) => u.originalName).join(", ");
  const label =
    updates.length === 1
      ? `El procedimiento "${names}" fue actualizado hoy`
      : `${updates.length} procedimientos fueron actualizados hoy`;

  const handleDismiss = () => {
    dismissBannerToday();
    onDismiss();
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-amber-900/40 border-b border-amber-700/50 text-amber-200 text-sm">
      <span className="flex-1">📋 {label}</span>
      <button
        onClick={handleDismiss}
        className="text-amber-400 hover:text-amber-200 font-bold text-base leading-none"
        aria-label="Cerrar aviso"
      >
        ×
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/src/components/UpdateBanner.tsx
git commit -m "feat(frontend): componente UpdateBanner"
```

---

## Task 11: frontend — StepChecklist y actualizar MessageBubble

**Files:**
- Create: `packages/frontend/src/components/StepChecklist.tsx`
- Modify: `packages/frontend/src/components/MessageBubble.tsx`

- [ ] **Step 1: Crear StepChecklist.tsx**

`packages/frontend/src/components/StepChecklist.tsx`:
```tsx
"use client";

import { useState } from "react";

interface Props {
  children: React.ReactNode;
}

export default function StepChecklist({ children }: Props) {
  const items = Array.isArray(children) ? children : [children];
  const [checked, setChecked] = useState<boolean[]>(() =>
    new Array(items.length).fill(false)
  );

  const toggle = (i: number) =>
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));

  return (
    <ol className="space-y-2 my-2">
      {items.map((child, i) => (
        <li key={i} className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={checked[i] ?? false}
            onChange={() => toggle(i)}
            className="mt-1 h-4 w-4 flex-shrink-0 rounded border-slate-500 bg-slate-800 cursor-pointer accent-blue-500"
          />
          <span
            className={`leading-relaxed ${
              checked[i] ? "line-through text-slate-500" : "text-slate-100"
            }`}
          >
            {child}
          </span>
        </li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 2: Actualizar MessageBubble para usar StepChecklist como renderer ol**

`packages/frontend/src/components/MessageBubble.tsx`:
```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import DocumentLink from "./DocumentLink";
import StepChecklist from "./StepChecklist";
import type { Reference } from "@/lib/api";

interface Props {
  role: "user" | "assistant";
  content: string;
  references?: Reference[];
  textLarge?: boolean;
}

export default function MessageBubble({ role, content, references, textLarge }: Props) {
  const isUser = role === "user";
  const textClass = textLarge ? "text-lg" : "text-base";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${textClass} leading-relaxed ${
          isUser
            ? "bg-blue-600 text-white rounded-br-sm"
            : "bg-slate-700 text-slate-100 rounded-bl-sm"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
              em: ({ children }) => <em className="italic text-slate-300">{children}</em>,
              ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
              ol: ({ children }) => <StepChecklist>{children}</StepChecklist>,
              li: ({ children }) => <>{children}</>,
              h1: ({ children }) => <h1 className="text-lg font-bold text-white mb-2 mt-3 first:mt-0">{children}</h1>,
              h2: ({ children }) => <h2 className="text-base font-bold text-white mb-1 mt-3 first:mt-0">{children}</h2>,
              h3: ({ children }) => <h3 className="text-sm font-semibold text-slate-200 mb-1 mt-2 first:mt-0">{children}</h3>,
              code: ({ children }) => <code className="bg-slate-800 text-slate-200 rounded px-1 py-0.5 text-sm font-mono">{children}</code>,
              blockquote: ({ children }) => <blockquote className="border-l-2 border-slate-400 pl-3 italic text-slate-300 mb-2">{children}</blockquote>,
            }}
          >
            {content}
          </ReactMarkdown>
        )}
        {references && references.length > 0 && (
          <div className="mt-2 border-t border-slate-500 pt-2 space-y-1">
            {references.map((ref) => (
              <DocumentLink key={ref.documentId} documentId={ref.documentId} section={ref.section} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/components/StepChecklist.tsx packages/frontend/src/components/MessageBubble.tsx
git commit -m "feat(frontend): StepChecklist con checkboxes; MessageBubble usa ol interactivo y prop textLarge"
```

---

## Task 12: frontend — FavoritesDrawer

**Files:**
- Create: `packages/frontend/src/components/FavoritesDrawer.tsx`

- [ ] **Step 1: Crear FavoritesDrawer.tsx**

`packages/frontend/src/components/FavoritesDrawer.tsx`:
```tsx
"use client";

import { useState, useEffect } from "react";
import { getFavorites, removeFavorite, type Favorite } from "@/lib/localStorage";

interface Props {
  open: boolean;
  onClose: () => void;
  onReask: (question: string) => void;
}

export default function FavoritesDrawer({ open, onClose, onReask }: Props) {
  const [favs, setFavs] = useState<Favorite[]>([]);

  useEffect(() => {
    if (open) setFavs(getFavorites());
  }, [open]);

  const handleRemove = (id: string) => {
    removeFavorite(id);
    setFavs((prev) => prev.filter((f) => f.id !== id));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-80 max-w-full bg-slate-800 h-full flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h2 className="text-white font-semibold">Favoritos</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {favs.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-8">
              Aún no tienes favoritos. Toca ★ en una respuesta para guardarla.
            </p>
          )}
          {favs.map((f) => (
            <div key={f.id} className="bg-slate-700 rounded-xl p-3">
              <p className="text-slate-300 text-xs mb-1">
                {new Date(f.savedAt).toLocaleDateString("es", {
                  day: "numeric",
                  month: "short",
                })}
              </p>
              <p className="text-white text-sm font-medium mb-2">{f.question}</p>
              <p className="text-slate-300 text-xs line-clamp-2 mb-3">{f.answer}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { onReask(f.question); onClose(); }}
                  className="flex-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-1.5"
                >
                  Preguntar de nuevo
                </button>
                <button
                  onClick={() => handleRemove(f.id)}
                  className="text-xs text-red-400 hover:text-red-300 border border-red-800 rounded-lg px-2"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/src/components/FavoritesDrawer.tsx
git commit -m "feat(frontend): componente FavoritesDrawer"
```

---

## Task 13: frontend — HistoryDrawer

**Files:**
- Create: `packages/frontend/src/components/HistoryDrawer.tsx`

- [ ] **Step 1: Crear HistoryDrawer.tsx**

`packages/frontend/src/components/HistoryDrawer.tsx`:
```tsx
"use client";

import { useState, useEffect } from "react";
import { getHistory, type HistoryItem } from "@/lib/localStorage";

interface Props {
  open: boolean;
  onClose: () => void;
  onReask: (question: string) => void;
}

export default function HistoryDrawer({ open, onClose, onReask }: Props) {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    if (open) setHistory(getHistory());
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-80 max-w-full bg-slate-800 h-full flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h2 className="text-white font-semibold">Historial</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {history.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-8">
              No hay preguntas recientes.
            </p>
          )}
          {history.map((item, i) => (
            <button
              key={i}
              onClick={() => { onReask(item.question); onClose(); }}
              className="w-full text-left bg-slate-700 hover:bg-slate-600 rounded-xl p-3 transition-colors"
            >
              <p className="text-white text-sm">{item.question}</p>
              <p className="text-slate-500 text-xs mt-1">
                {new Date(item.askedAt).toLocaleDateString("es", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/src/components/HistoryDrawer.tsx
git commit -m "feat(frontend): componente HistoryDrawer"
```

---

## Task 14: frontend — Chat.tsx con todo conectado

**Files:**
- Modify: `packages/frontend/src/components/Chat.tsx`

- [ ] **Step 1: Reemplazar Chat.tsx completo**

`packages/frontend/src/components/Chat.tsx`:
```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import TagChips from "./TagChips";
import UpdateBanner from "./UpdateBanner";
import FavoritesDrawer from "./FavoritesDrawer";
import HistoryDrawer from "./HistoryDrawer";
import {
  sendMessage,
  fetchTags,
  fetchRecentUpdates,
  type ChatMessage,
  type RecentUpdate,
} from "@/lib/api";
import {
  addToHistory,
  addFavorite,
  getTextSize,
  setTextSize,
  isBannerDismissedToday,
  type TextSize,
} from "@/lib/localStorage";

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hola 👋 Soy el asistente de procedimientos. ¿En qué te puedo ayudar hoy?",
    },
  ]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [tags, setTags] = useState<string[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const [recentUpdates, setRecentUpdates] = useState<RecentUpdate[]>([]);
  const [showBanner, setShowBanner] = useState(false);

  const [textSize, setTextSizeState] = useState<TextSize>("base");
  const [showFavorites, setShowFavorites] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  // Track last assistant message index for favorite star
  const lastAssistantIdx = messages.map((m) => m.role).lastIndexOf("assistant");

  useEffect(() => {
    setTextSizeState(getTextSize());
    fetchTags().then(setTags);
    fetchRecentUpdates().then((updates) => {
      if (updates.length > 0 && !isBannerDismissedToday()) {
        setRecentUpdates(updates);
        setShowBanner(true);
      }
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleToggleTextSize = () => {
    const next: TextSize = textSize === "base" ? "lg" : "base";
    setTextSizeState(next);
    setTextSize(next);
  };

  const handleSend = async (message: string) => {
    addToHistory(message);
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setLoading(true);
    try {
      const res = await sendMessage(message, sessionId, activeTag ? [activeTag] : undefined);
      if (!sessionId) setSessionId(res.sessionId);

      let answer = res.answer;
      if (res.tagFallback && activeTag) {
        answer += `\n\n*No encontré procedimientos con la etiqueta "${activeTag}"; busqué en todos los documentos.*`;
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: answer, references: res.references },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Ocurrió un error. Por favor intenta de nuevo." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleFavoriteStar = () => {
    const lastAssistant = messages[lastAssistantIdx];
    const lastUser = [...messages].slice(0, lastAssistantIdx).reverse().find((m) => m.role === "user");
    if (!lastAssistant || !lastUser) return;
    addFavorite({
      question: lastUser.content,
      answer: lastAssistant.content,
      tags: activeTag ? [activeTag] : [],
    });
  };

  return (
    <>
      <div className="flex flex-col h-screen bg-slate-900">
        {/* Header */}
        <div className="flex items-center px-4 py-3 bg-slate-800 border-b border-slate-700">
          <div className="flex-1 text-center">
            <h1 className="text-white font-bold text-lg leading-tight">Asistente de Procedimientos</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(true)}
              className="text-slate-400 hover:text-white text-sm px-2 py-1"
              title="Historial"
            >
              🕐
            </button>
            <button
              onClick={() => setShowFavorites(true)}
              className="text-slate-400 hover:text-white text-sm px-2 py-1"
              title="Favoritos"
            >
              ★
            </button>
            <button
              onClick={handleToggleTextSize}
              className="text-slate-400 hover:text-white text-sm px-2 py-1"
              title="Tamaño de texto"
            >
              {textSize === "base" ? "A+" : "A-"}
            </button>
          </div>
        </div>

        {/* Banner de actualización */}
        {showBanner && (
          <UpdateBanner
            updates={recentUpdates}
            onDismiss={() => setShowBanner(false)}
          />
        )}

        {/* Chips de tags */}
        <TagChips tags={tags} activeTag={activeTag} onSelect={setActiveTag} />

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.map((msg, i) => (
            <MessageBubble
              key={i}
              role={msg.role}
              content={msg.content}
              references={msg.references}
              textLarge={textSize === "lg"}
            />
          ))}
          {loading && (
            <div className="flex justify-start mb-3">
              <div className="bg-slate-700 text-slate-400 rounded-2xl rounded-bl-sm px-4 py-3 text-base">
                Buscando en procedimientos...
              </div>
            </div>
          )}
          {/* Botón de favorito para última respuesta del bot */}
          {!loading && lastAssistantIdx > 0 && (
            <div className="flex justify-start px-1 -mt-2 mb-2">
              <button
                onClick={handleFavoriteStar}
                className="text-slate-500 hover:text-yellow-400 text-sm transition-colors"
                title="Guardar en favoritos"
              >
                ☆ Guardar respuesta
              </button>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <ChatInput onSend={handleSend} disabled={loading} />
      </div>

      <FavoritesDrawer
        open={showFavorites}
        onClose={() => setShowFavorites(false)}
        onReask={handleSend}
      />
      <HistoryDrawer
        open={showHistory}
        onClose={() => setShowHistory(false)}
        onReask={handleSend}
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/src/components/Chat.tsx
git commit -m "feat(frontend): Chat.tsx con tags, banner, favoritos, historial, texto grande"
```

---

## Task 15: frontend — Admin con campo tags

**Files:**
- Modify: `packages/frontend/src/app/admin/page.tsx`

- [ ] **Step 1: Actualizar admin/page.tsx para incluir campo tags**

En `packages/frontend/src/app/admin/page.tsx`, hacer los siguientes cambios:

**a) Agregar estado para tags** — añadir junto al estado de `category`:
```tsx
const [tags, setTags] = useState("");
```

**b) Actualizar `handleUpload`** — cambiar la URL de upload para incluir `tags`:
```tsx
const handleUpload = async () => {
  const file = fileRef.current?.files?.[0];
  if (!file) return;
  setUploading(true);
  const form = new FormData();
  form.append("file", file);
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (tags) params.set("tags", tags);
  const url = `${GATEWAY}/api/admin/documents${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  setUploading(false);
  if (res.ok) {
    await loadDocs();
    if (fileRef.current) fileRef.current.value = "";
    setCategory("");
    setTags("");
  } else {
    alert("Error al subir archivo");
  }
};
```

**c) Agregar input de tags** — añadir debajo del input de categoría y antes del input de archivo:
```tsx
<input
  type="text"
  placeholder="Etiquetas: ensamble, seguridad, cajón (separadas por coma)"
  value={tags}
  onChange={(e) => setTags(e.target.value)}
  className="w-full bg-slate-700 text-white rounded-xl px-4 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
/>
```

**d) Actualizar interfaz DocMeta** — agregar campo `tags`:
```tsx
interface DocMeta {
  id: string;
  originalName: string;
  category: string | null;
  tags: string[];
  createdAt: string;
}
```

**e) Mostrar tags en la lista de documentos** — añadir debajo de la línea de categoría:
```tsx
{doc.tags && doc.tags.length > 0 && (
  <div className="flex flex-wrap gap-1 mt-1">
    {doc.tags.map((t) => (
      <span
        key={t}
        className="text-xs bg-slate-700 text-slate-400 rounded-full px-2 py-0.5"
      >
        {t}
      </span>
    ))}
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/src/app/admin/page.tsx
git commit -m "feat(frontend): panel admin con campo tags y visualización de etiquetas"
```

---

## Task 16: Verificación end-to-end

- [ ] **Step 1: Build completo**

```bash
cd nalakalu && npm run build --workspaces --if-present
```

Expected: sin errores TypeScript en ningún paquete.

- [ ] **Step 2: Ejecutar todos los tests**

```bash
npm test
```

Expected: todos en verde.

- [ ] **Step 3: Levantar el stack**

Terminal 1:
```bash
cd packages/gateway && npm run dev
```

Terminal 2:
```bash
cd packages/frontend && npm run dev
```

- [ ] **Step 4: Verificar tags en admin**

Abrir `http://localhost:3000/admin`.
1. Subir un procedimiento con tags `ensamble, cajón`.
2. Verificar que aparece en la lista con las etiquetas visibles.

- [ ] **Step 5: Verificar chips en el chat**

Abrir `http://localhost:3000`.
1. Los chips de tags deben aparecer debajo del header.
2. Tocar "ensamble" — el chip se activa (azul).
3. Enviar una pregunta — la búsqueda debe estar filtrada por ese tag.

- [ ] **Step 6: Verificar pasos interactivos**

Hacer una pregunta que devuelva pasos numerados (ej: "¿cómo ensamblar el cajón tipo B?").
Expected: los pasos aparecen con checkboxes. Al marcarlos se tachan.

- [ ] **Step 7: Verificar favoritos e historial**

1. Tocar "☆ Guardar respuesta" bajo una respuesta del bot.
2. Abrir el cajón de favoritos (★ en el header) — debe aparecer la pregunta guardada.
3. Tocar "Preguntar de nuevo" — debe re-ejecutar la pregunta.
4. Abrir historial (🕐) — deben aparecer las preguntas recientes.

- [ ] **Step 8: Verificar texto grande**

Tocar "A+" en el header — el texto del chat debe agrandarse. Recargar la página — debe persistir.

- [ ] **Step 9: Verificar banner de actualización**

Subir una nueva versión de un documento desde admin (mismo nombre de archivo).
Recargar el chat — debe aparecer el banner amarillo con el nombre del documento.
Cerrarlo — no debe volver a aparecer durante el mismo día.

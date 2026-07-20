# Nalakalu — Bot de Consulta de Procedimientos v1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir una web app responsive con chat de IA que permite a trabajadores de planta consultar procedimientos de la empresa en lenguaje natural, con panel de administración para subir documentos.

**Architecture:** Monorepo con tres servicios: frontend Next.js (chat + admin), API Gateway Node.js que orquesta llamadas MCP, y tres servidores MCP independientes (documents, workers, admin). AbacusAI provee RAG sobre los PDFs/Word; Cloudflare R2 almacena los archivos originales; PostgreSQL guarda sesiones y metadatos.

**Tech Stack:** Next.js 14, Node.js/Fastify, `@modelcontextprotocol/sdk`, AbacusAI REST API, `@aws-sdk/client-s3` (compatible R2), PostgreSQL, Vitest, Tailwind CSS.

---

## Estructura de archivos

```
nalakalu/
├── package.json                         # npm workspaces root
├── docker-compose.yml                   # PostgreSQL local
├── .env.example
│
├── packages/
│   ├── db/                              # Migraciones y cliente compartido
│   │   ├── src/
│   │   │   └── client.ts               # Postgres client singleton
│   │   ├── migrations/
│   │   │   ├── 001_sessions.sql
│   │   │   └── 002_documents.sql
│   │   └── package.json
│   │
│   ├── mcp-documents/                   # documents-mcp server
│   │   ├── src/
│   │   │   ├── index.ts                # Entrada MCP, registra tools
│   │   │   ├── tools.ts                # search_procedures, get_document, list_categories
│   │   │   ├── ingest.ts               # Pipeline: archivo → R2 → AbacusAI
│   │   │   ├── abacus.ts               # Cliente AbacusAI REST
│   │   │   └── r2.ts                   # Cliente Cloudflare R2
│   │   ├── src/__tests__/
│   │   │   ├── tools.test.ts
│   │   │   └── ingest.test.ts
│   │   └── package.json
│   │
│   ├── mcp-workers/                     # workers-mcp server
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── tools.ts                # get_session, identify_worker
│   │   ├── src/__tests__/
│   │   │   └── tools.test.ts
│   │   └── package.json
│   │
│   ├── mcp-admin/                       # admin-mcp server
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── tools.ts                # upload_document, delete_document, list_documents
│   │   ├── src/__tests__/
│   │   │   └── tools.test.ts
│   │   └── package.json
│   │
│   ├── gateway/                         # API Gateway Fastify
│   │   ├── src/
│   │   │   ├── index.ts                # Servidor Fastify + arranque
│   │   │   ├── mcp-client.ts           # Orquestador de clientes MCP
│   │   │   ├── routes/
│   │   │   │   ├── chat.ts             # POST /api/chat
│   │   │   │   └── admin.ts            # POST/GET /api/admin/*
│   │   │   └── middleware/
│   │   │       └── auth.ts             # Verificación rol admin
│   │   ├── src/__tests__/
│   │   │   └── chat.test.ts
│   │   └── package.json
│   │
│   └── frontend/                        # Next.js app
│       ├── src/
│       │   ├── app/
│       │   │   ├── page.tsx            # Chat del trabajador (/)
│       │   │   ├── admin/
│       │   │   │   └── page.tsx        # Panel admin (/admin)
│       │   │   └── layout.tsx
│       │   ├── components/
│       │   │   ├── Chat.tsx            # Contenedor del chat
│       │   │   ├── MessageBubble.tsx   # Burbuja de mensaje individual
│       │   │   ├── ChatInput.tsx       # Input + botón enviar
│       │   │   └── DocumentLink.tsx    # Link "ver procedimiento completo"
│       │   └── lib/
│       │       └── api.ts              # Fetch wrapper al gateway
│       └── package.json
```

---

## Task 1: Scaffolding del monorepo

**Files:**
- Create: `package.json` (root)
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `packages/db/package.json`
- Create: `packages/mcp-documents/package.json`
- Create: `packages/mcp-workers/package.json`
- Create: `packages/mcp-admin/package.json`
- Create: `packages/gateway/package.json`
- Create: `packages/frontend/package.json`

- [ ] **Step 1: Crear estructura de directorios**

```bash
mkdir -p nalakalu/packages/{db/src,db/migrations,mcp-documents/src/__tests__,mcp-workers/src/__tests__,mcp-admin/src/__tests__,gateway/src/{routes,middleware},gateway/src/__tests__,frontend/src/{app/admin,components,lib}}
cd nalakalu
```

- [ ] **Step 2: Escribir package.json raíz con workspaces**

```json
{
  "name": "nalakalu",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev": "concurrently \"npm run dev -w gateway\" \"npm run dev -w frontend\"",
    "test": "npm run test --workspaces --if-present",
    "db:migrate": "npm run migrate -w @nalakalu/db"
  },
  "devDependencies": {
    "concurrently": "^8.2.0",
    "typescript": "^5.3.0"
  }
}
```

- [ ] **Step 3: Escribir docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: nalakalu
      POSTGRES_USER: nalakalu
      POSTGRES_PASSWORD: nalakalu_dev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

- [ ] **Step 4: Escribir .env.example**

```bash
# PostgreSQL
DATABASE_URL=postgresql://nalakalu:nalakalu_dev@localhost:5432/nalakalu

# Cloudflare R2
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=nalakalu-docs
R2_PUBLIC_URL=https://your-bucket.r2.dev

# AbacusAI
ABACUS_API_KEY=your_api_key
ABACUS_DEPLOYMENT_ID=your_deployment_id
ABACUS_DEPLOYMENT_TOKEN=your_deployment_token

# Gateway
GATEWAY_PORT=3001
ADMIN_SECRET=change_me_in_production

# Frontend
NEXT_PUBLIC_GATEWAY_URL=http://localhost:3001
```

- [ ] **Step 5: Escribir package.json para cada paquete**

`packages/db/package.json`:
```json
{
  "name": "@nalakalu/db",
  "version": "0.1.0",
  "main": "dist/client.js",
  "scripts": {
    "build": "tsc",
    "migrate": "node -e \"require('./src/migrate.js')\""
  },
  "dependencies": {
    "pg": "^8.11.0"
  },
  "devDependencies": {
    "@types/pg": "^8.10.0",
    "typescript": "^5.3.0"
  }
}
```

`packages/mcp-documents/package.json`:
```json
{
  "name": "@nalakalu/mcp-documents",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "exports": {
    ".": "./dist/index.js",
    "./ingest": "./dist/ingest.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "@aws-sdk/client-s3": "^3.500.0",
    "@aws-sdk/s3-request-presigner": "^3.500.0",
    "@nalakalu/db": "*"
  },
  "devDependencies": {
    "vitest": "^1.0.0",
    "typescript": "^5.3.0"
  }
}
```

`packages/mcp-workers/package.json`:
```json
{
  "name": "@nalakalu/mcp-workers",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "@nalakalu/db": "*"
  },
  "devDependencies": {
    "vitest": "^1.0.0",
    "typescript": "^5.3.0"
  }
}
```

`packages/mcp-admin/package.json`:
```json
{
  "name": "@nalakalu/mcp-admin",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "@nalakalu/db": "*"
  },
  "devDependencies": {
    "vitest": "^1.0.0",
    "typescript": "^5.3.0"
  }
}
```

`packages/gateway/package.json`:
```json
{
  "name": "@nalakalu/gateway",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "fastify": "^4.25.0",
    "@fastify/multipart": "^8.1.0",
    "@nalakalu/db": "*"
  },
  "devDependencies": {
    "tsx": "^4.7.0",
    "vitest": "^1.0.0",
    "typescript": "^5.3.0"
  }
}
```

`packages/frontend/package.json`:
```json
{
  "name": "@nalakalu/frontend",
  "version": "0.1.0",
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^14.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0",
    "typescript": "^5.3.0"
  }
}
```

- [ ] **Step 6: Instalar dependencias**

```bash
npm install
```

- [ ] **Step 7: Levantar PostgreSQL local**

```bash
docker compose up -d
```

Expected: contenedor `nalakalu-postgres-1` en estado `Up`.

- [ ] **Step 8: Copiar .env**

```bash
cp .env.example .env
# Editar .env con tus credenciales reales de R2, AbacusAI
```

- [ ] **Step 9: Commit inicial**

```bash
git init
echo "node_modules/\ndist/\n.env\n.superpowers/" > .gitignore
git add .
git commit -m "chore: scaffolding monorepo nalakalu"
```

---

## Task 2: Schema de base de datos

**Files:**
- Create: `packages/db/migrations/001_sessions.sql`
- Create: `packages/db/migrations/002_documents.sql`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/migrate.ts`

- [ ] **Step 1: Escribir migración de sesiones**

`packages/db/migrations/001_sessions.sql`:
```sql
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id VARCHAR(50),          -- NULL = anónimo; número de empleado si se identifica
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 2: Escribir migración de documentos**

`packages/db/migrations/002_documents.sql`:
```sql
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  r2_key VARCHAR(500) NOT NULL,
  abacus_doc_id VARCHAR(255),     -- ID retornado por AbacusAI al indexar
  uploaded_by VARCHAR(100),
  version INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 3: Escribir cliente PostgreSQL**

`packages/db/src/client.ts`:
```typescript
import { Pool } from "pg";

let pool: Pool | null = null;

export function getDb(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
```

- [ ] **Step 4: Escribir runner de migraciones**

`packages/db/src/migrate.ts`:
```typescript
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { getDb } from "./client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const db = getDb();
  await db.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const { rows: applied } = await db.query<{ filename: string }>(
    "SELECT filename FROM _migrations ORDER BY filename"
  );
  const appliedSet = new Set(applied.map((r) => r.filename));

  const migrationsDir = join(__dirname, "../migrations");
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    if (appliedSet.has(file)) continue;
    const sql = readFileSync(join(migrationsDir, file), "utf-8");
    console.log(`Applying migration: ${file}`);
    await db.query(sql);
    await db.query("INSERT INTO _migrations (filename) VALUES ($1)", [file]);
  }

  console.log("Migrations complete.");
  await db.end();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 5: Ejecutar migraciones**

```bash
npm run db:migrate
```

Expected output:
```
Applying migration: 001_sessions.sql
Applying migration: 002_documents.sql
Migrations complete.
```

- [ ] **Step 6: Commit**

```bash
git add packages/db/
git commit -m "feat(db): schema inicial — sessions, chat_messages, documents"
```

---

## Task 3: Cliente R2 y cliente AbacusAI

**Files:**
- Create: `packages/mcp-documents/src/r2.ts`
- Create: `packages/mcp-documents/src/abacus.ts`
- Create: `packages/mcp-documents/src/__tests__/abacus.test.ts`

- [ ] **Step 1: Escribir cliente R2**

`packages/mcp-documents/src/r2.ts`:
```typescript
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;

export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await client.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType })
  );
}

export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn }
  );
}

export async function deleteFromR2(key: string): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
```

- [ ] **Step 2: Escribir test del cliente AbacusAI (failing)**

`packages/mcp-documents/src/__tests__/abacus.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { queryAbacus, indexDocument } from "../abacus.js";

describe("abacus client", () => {
  it("queryAbacus calls the deployment API and returns answer + sources", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          answer: "El cajón tipo B se ensambla en 3 pasos...",
          references: [{ documentId: "doc-123", section: "Procedimiento P-047" }],
        },
      }),
    });

    const result = await queryAbacus("¿Cómo ensamblo el cajón tipo B?");

    expect(result.answer).toContain("cajón tipo B");
    expect(result.references).toHaveLength(1);
    expect(result.references[0].documentId).toBe("doc-123");
  });

  it("indexDocument returns the abacusDocId on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { docId: "abacus-doc-456" } }),
    });

    const docId = await indexDocument("proc-123", "Procedimiento de ensamble...");
    expect(docId).toBe("abacus-doc-456");
  });

  it("queryAbacus throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    await expect(queryAbacus("pregunta")).rejects.toThrow("AbacusAI error 500");
  });
});
```

- [ ] **Step 3: Ejecutar test para verificar que falla**

```bash
cd packages/mcp-documents && npx vitest run src/__tests__/abacus.test.ts
```

Expected: FAIL — `Cannot find module '../abacus.js'`

- [ ] **Step 4: Implementar cliente AbacusAI**

`packages/mcp-documents/src/abacus.ts`:
```typescript
const BASE_URL = "https://api.abacus.ai/api/v0";

export interface AbacusQueryResult {
  answer: string;
  references: { documentId: string; section: string }[];
}

export async function queryAbacus(question: string): Promise<AbacusQueryResult> {
  const res = await fetch(`${BASE_URL}/callDeploymentApi`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apiKey": process.env.ABACUS_API_KEY!,
    },
    body: JSON.stringify({
      deploymentToken: process.env.ABACUS_DEPLOYMENT_TOKEN,
      deploymentId: process.env.ABACUS_DEPLOYMENT_ID,
      queryData: { question },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AbacusAI error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return {
    answer: data.result.answer ?? data.result.response ?? "",
    references: data.result.references ?? [],
  };
}

export async function indexDocument(docId: string, text: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/upsertDocumentData`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apiKey": process.env.ABACUS_API_KEY!,
    },
    body: JSON.stringify({
      deploymentId: process.env.ABACUS_DEPLOYMENT_ID,
      documentId: docId,
      documentData: { text },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AbacusAI index error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.result.docId as string;
}
```

> **Nota:** Los endpoints exactos de AbacusAI dependen del tipo de deployment configurado en tu cuenta. Si los endpoints difieren, ajusta las rutas en `queryAbacus` e `indexDocument` según la documentación de tu deployment. La interfaz (`AbacusQueryResult`) no cambia.

- [ ] **Step 5: Ejecutar tests**

```bash
npx vitest run src/__tests__/abacus.test.ts
```

Expected: 3 PASS

- [ ] **Step 6: Commit**

```bash
cd ../..
git add packages/mcp-documents/src/r2.ts packages/mcp-documents/src/abacus.ts packages/mcp-documents/src/__tests__/abacus.test.ts
git commit -m "feat(mcp-documents): clientes R2 y AbacusAI con tests"
```

---

## Task 4: Pipeline de ingestión y servidor documents-mcp

**Files:**
- Create: `packages/mcp-documents/src/ingest.ts`
- Create: `packages/mcp-documents/src/tools.ts`
- Create: `packages/mcp-documents/src/index.ts`
- Create: `packages/mcp-documents/src/__tests__/ingest.test.ts`

- [ ] **Step 1: Escribir test de ingestión (failing)**

`packages/mcp-documents/src/__tests__/ingest.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../r2.js", () => ({ uploadToR2: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../abacus.js", () => ({ indexDocument: vi.fn().mockResolvedValue("abacus-789") }));
vi.mock("@nalakalu/db", () => ({
  getDb: () => ({
    query: vi.fn().mockResolvedValue({ rows: [{ id: "doc-uuid-1" }] }),
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
```

- [ ] **Step 2: Ejecutar test — verificar falla**

```bash
cd packages/mcp-documents && npx vitest run src/__tests__/ingest.test.ts
```

Expected: FAIL — `Cannot find module '../ingest.js'`

- [ ] **Step 3: Implementar ingest.ts**

`packages/mcp-documents/src/ingest.ts`:
```typescript
import { randomUUID } from "crypto";
import { uploadToR2 } from "./r2.js";
import { indexDocument } from "./abacus.js";
import { getDb } from "@nalakalu/db";

interface IngestInput {
  filename: string;
  buffer: Buffer;
  contentType: string;
  category?: string;
  uploadedBy?: string;
}

interface IngestResult {
  id: string;
  r2Key: string;
  abacusDocId: string;
}

export async function ingestDocument(input: IngestInput): Promise<IngestResult> {
  const db = getDb();
  const r2Key = `docs/${randomUUID()}-${input.filename}`;

  // 1. Guardar en R2
  await uploadToR2(r2Key, input.buffer, input.contentType);

  // 2. Insertar registro en DB (obtenemos el UUID generado)
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO documents (filename, original_name, category, r2_key, uploaded_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [r2Key, input.filename, input.category ?? null, r2Key, input.uploadedBy ?? null]
  );
  const docId = rows[0].id;

  // 3. Indexar en AbacusAI (el texto real vendría de un extractor de PDF/Word)
  const textContent = `[Documento: ${input.filename}]\n${input.buffer.toString("utf-8").slice(0, 10000)}`;
  const abacusDocId = await indexDocument(docId, textContent);

  // 4. Actualizar registro con abacus_doc_id
  await db.query(
    "UPDATE documents SET abacus_doc_id = $1 WHERE id = $2",
    [abacusDocId, docId]
  );

  return { id: docId, r2Key, abacusDocId };
}
```

> **Nota:** Para extracción real de texto de PDF usa `pdf-parse` (`npm i pdf-parse`). Para `.docx` usa `mammoth` (`npm i mammoth`). Sustituye la línea `textContent` por el resultado del extractor según `contentType`.

- [ ] **Step 4: Ejecutar test**

```bash
npx vitest run src/__tests__/ingest.test.ts
```

Expected: 1 PASS

- [ ] **Step 5: Implementar tools.ts**

`packages/mcp-documents/src/tools.ts`:
```typescript
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
```

- [ ] **Step 6: Implementar el servidor MCP**

`packages/mcp-documents/src/index.ts`:
```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { searchProcedures, getDocument, listCategories } from "./tools.js";

const server = new Server(
  { name: "nalakalu-documents-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_procedures",
      description: "Busca en los procedimientos de la empresa y responde preguntas",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string", description: "Pregunta del trabajador" } },
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
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "search_procedures") {
    const result = await searchProcedures(args!.query as string);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  }

  if (name === "get_document") {
    const doc = await getDocument(args!.id as string);
    return {
      content: [{ type: "text", text: JSON.stringify(doc) }],
    };
  }

  if (name === "list_categories") {
    const categories = await listCategories();
    return {
      content: [{ type: "text", text: JSON.stringify(categories) }],
    };
  }

  throw new Error(`Tool desconocida: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

- [ ] **Step 7: Commit**

```bash
cd ../..
git add packages/mcp-documents/
git commit -m "feat(mcp-documents): servidor MCP completo — ingest, search, get, categories"
```

---

## Task 5: Servidor workers-mcp

**Files:**
- Create: `packages/mcp-workers/src/tools.ts`
- Create: `packages/mcp-workers/src/index.ts`
- Create: `packages/mcp-workers/src/__tests__/tools.test.ts`

- [ ] **Step 1: Escribir tests (failing)**

`packages/mcp-workers/src/__tests__/tools.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("@nalakalu/db", () => ({
  getDb: () => ({
    query: vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: "session-abc", worker_id: null }] }) // getSession
      .mockResolvedValueOnce({ rows: [{ id: "session-abc", worker_id: "EMP-042" }] }) // identifyWorker
  }),
}));

import { getSession, identifyWorker } from "../tools.js";

describe("workers-mcp tools", () => {
  it("getSession crea sesión anónima y retorna id", async () => {
    const session = await getSession();
    expect(session.id).toBe("session-abc");
    expect(session.workerId).toBeNull();
  });

  it("identifyWorker asigna número de empleado a la sesión", async () => {
    const session = await identifyWorker("session-abc", "EMP-042");
    expect(session.workerId).toBe("EMP-042");
  });
});
```

- [ ] **Step 2: Ejecutar test — verificar falla**

```bash
cd packages/mcp-workers && npx vitest run src/__tests__/tools.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implementar tools.ts**

`packages/mcp-workers/src/tools.ts`:
```typescript
import { getDb } from "@nalakalu/db";

export interface WorkerSession {
  id: string;
  workerId: string | null;
}

export async function getSession(): Promise<WorkerSession> {
  const db = getDb();
  const { rows } = await db.query<{ id: string; worker_id: string | null }>(
    "INSERT INTO sessions DEFAULT VALUES RETURNING id, worker_id"
  );
  return { id: rows[0].id, workerId: rows[0].worker_id };
}

export async function identifyWorker(
  sessionId: string,
  workerNumber: string
): Promise<WorkerSession> {
  const db = getDb();
  const { rows } = await db.query<{ id: string; worker_id: string }>(
    "UPDATE sessions SET worker_id = $1 WHERE id = $2 RETURNING id, worker_id",
    [workerNumber, sessionId]
  );
  if (!rows[0]) throw new Error(`Sesión ${sessionId} no encontrada`);
  return { id: rows[0].id, workerId: rows[0].worker_id };
}
```

- [ ] **Step 4: Ejecutar tests**

```bash
npx vitest run src/__tests__/tools.test.ts
```

Expected: 2 PASS

- [ ] **Step 5: Implementar servidor MCP**

`packages/mcp-workers/src/index.ts`:
```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { getSession, identifyWorker } from "./tools.js";

const server = new Server(
  { name: "nalakalu-workers-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_session",
      description: "Crea una sesión anónima para el trabajador",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "identify_worker",
      description: "Asocia un número de empleado a la sesión activa",
      inputSchema: {
        type: "object",
        properties: {
          session_id: { type: "string" },
          worker_number: { type: "string" },
        },
        required: ["session_id", "worker_number"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "get_session") {
    return { content: [{ type: "text", text: JSON.stringify(await getSession()) }] };
  }
  if (name === "identify_worker") {
    const session = await identifyWorker(args!.session_id as string, args!.worker_number as string);
    return { content: [{ type: "text", text: JSON.stringify(session) }] };
  }
  throw new Error(`Tool desconocida: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

- [ ] **Step 6: Commit**

```bash
cd ../..
git add packages/mcp-workers/
git commit -m "feat(mcp-workers): servidor MCP de sesiones"
```

---

## Task 6: Servidor admin-mcp

**Files:**
- Create: `packages/mcp-admin/src/tools.ts`
- Create: `packages/mcp-admin/src/index.ts`
- Create: `packages/mcp-admin/src/__tests__/tools.test.ts`

- [ ] **Step 1: Escribir tests (failing)**

`packages/mcp-admin/src/__tests__/tools.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("@nalakalu/db", () => ({
  getDb: () => ({
    query: vi.fn()
      .mockResolvedValueOnce({          // listDocuments
        rows: [
          { id: "d1", original_name: "proc-ensamble.pdf", category: "Ensamble", created_at: new Date() }
        ]
      })
      .mockResolvedValueOnce({ rows: [] }) // deleteDocument
  }),
}));

import { listDocuments, deleteDocument } from "../tools.js";

describe("admin-mcp tools", () => {
  it("listDocuments retorna array de documentos activos", async () => {
    const docs = await listDocuments();
    expect(docs).toHaveLength(1);
    expect(docs[0].originalName).toBe("proc-ensamble.pdf");
  });

  it("deleteDocument marca documento como inactivo", async () => {
    await expect(deleteDocument("d1")).resolves.not.toThrow();
  });
});
```

- [ ] **Step 2: Ejecutar test — verificar falla**

```bash
cd packages/mcp-admin && npx vitest run src/__tests__/tools.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implementar tools.ts**

`packages/mcp-admin/src/tools.ts`:
```typescript
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
```

- [ ] **Step 4: Ejecutar tests**

```bash
npx vitest run src/__tests__/tools.test.ts
```

Expected: 2 PASS

- [ ] **Step 5: Implementar servidor MCP**

`packages/mcp-admin/src/index.ts`:
```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { listDocuments, deleteDocument } from "./tools.js";

const server = new Server(
  { name: "nalakalu-admin-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_documents",
      description: "Lista todos los procedimientos activos",
      inputSchema: {
        type: "object",
        properties: { category: { type: "string", description: "Filtrar por categoría (opcional)" } },
      },
    },
    {
      name: "delete_document",
      description: "Desactiva un procedimiento (soft delete)",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "list_documents") {
    const docs = await listDocuments(args?.category as string | undefined);
    return { content: [{ type: "text", text: JSON.stringify(docs) }] };
  }
  if (name === "delete_document") {
    await deleteDocument(args!.id as string);
    return { content: [{ type: "text", text: JSON.stringify({ ok: true }) }] };
  }
  throw new Error(`Tool desconocida: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

- [ ] **Step 6: Commit**

```bash
cd ../..
git add packages/mcp-admin/
git commit -m "feat(mcp-admin): servidor MCP de administración de documentos"
```

---

## Task 7: API Gateway — servidor Fastify + cliente MCP

**Files:**
- Create: `packages/gateway/src/mcp-client.ts`
- Create: `packages/gateway/src/middleware/auth.ts`
- Create: `packages/gateway/src/index.ts`

- [ ] **Step 1: Implementar cliente MCP orquestador**

`packages/gateway/src/mcp-client.ts`:
```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function createMcpClient(serverScript: string): Promise<Client> {
  const transport = new StdioClientTransport({
    command: "node",
    args: [serverScript],
    env: { ...process.env } as Record<string, string>,
  });
  const client = new Client({ name: "nalakalu-gateway", version: "0.1.0" }, { capabilities: {} });
  await client.connect(transport);
  return client;
}

let documentsClient: Client | null = null;
let workersClient: Client | null = null;
let adminClient: Client | null = null;

export async function getDocumentsClient(): Promise<Client> {
  if (!documentsClient) {
    documentsClient = await createMcpClient(
      new URL("../../mcp-documents/dist/index.js", import.meta.url).pathname
    );
  }
  return documentsClient;
}

export async function getWorkersClient(): Promise<Client> {
  if (!workersClient) {
    workersClient = await createMcpClient(
      new URL("../../mcp-workers/dist/index.js", import.meta.url).pathname
    );
  }
  return workersClient;
}

export async function getAdminClient(): Promise<Client> {
  if (!adminClient) {
    adminClient = await createMcpClient(
      new URL("../../mcp-admin/dist/index.js", import.meta.url).pathname
    );
  }
  return adminClient;
}
```

- [ ] **Step 2: Implementar middleware de auth admin**

`packages/gateway/src/middleware/auth.ts`:
```typescript
import type { FastifyRequest, FastifyReply } from "fastify";

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const secret = request.headers["x-admin-secret"];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    reply.status(401).send({ error: "No autorizado" });
  }
}
```

- [ ] **Step 3: Implementar servidor Fastify**

`packages/gateway/src/index.ts`:
```typescript
import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { chatRoutes } from "./routes/chat.js";
import { adminRoutes } from "./routes/admin.js";

const app = Fastify({ logger: true });

await app.register(multipart);

app.register(chatRoutes, { prefix: "/api" });
app.register(adminRoutes, { prefix: "/api/admin" });

app.get("/health", async () => ({ ok: true }));

const port = Number(process.env.GATEWAY_PORT ?? 3001);
await app.listen({ port, host: "0.0.0.0" });
console.log(`Gateway corriendo en http://localhost:${port}`);
```

- [ ] **Step 4: Commit parcial**

```bash
git add packages/gateway/src/mcp-client.ts packages/gateway/src/middleware/ packages/gateway/src/index.ts
git commit -m "feat(gateway): cliente MCP, auth middleware y servidor Fastify"
```

---

## Task 8: Rutas del Gateway — chat y admin

**Files:**
- Create: `packages/gateway/src/routes/chat.ts`
- Create: `packages/gateway/src/routes/admin.ts`
- Create: `packages/gateway/src/__tests__/chat.test.ts`

- [ ] **Step 1: Escribir test de ruta chat (failing)**

`packages/gateway/src/__tests__/chat.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("../mcp-client.js", () => ({
  getDocumentsClient: vi.fn().mockResolvedValue({
    callTool: vi.fn().mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            answer: "El ensamble del cajón tipo B requiere 3 pasos...",
            references: [{ documentId: "doc-1", section: "P-047" }],
          }),
        },
      ],
    }),
  }),
  getWorkersClient: vi.fn().mockResolvedValue({
    callTool: vi.fn().mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ id: "sess-1", workerId: null }) }],
    }),
  }),
}));

import Fastify from "fastify";
import { chatRoutes } from "../routes/chat.js";

const app = Fastify();
app.register(chatRoutes, { prefix: "/api" });
await app.ready();

describe("POST /api/chat", () => {
  it("retorna respuesta y referencias del documento", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "¿Cómo ensamblo el cajón tipo B?", sessionId: "sess-1" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.answer).toContain("cajón tipo B");
    expect(body.references).toHaveLength(1);
    expect(body.sessionId).toBe("sess-1");
  });
});
```

- [ ] **Step 2: Ejecutar test — verificar falla**

```bash
cd packages/gateway && npx vitest run src/__tests__/chat.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implementar ruta chat**

`packages/gateway/src/routes/chat.ts`:
```typescript
import type { FastifyInstance } from "fastify";
import { getDocumentsClient, getWorkersClient } from "../mcp-client.js";

interface ChatBody {
  message: string;
  sessionId?: string;
}

export async function chatRoutes(app: FastifyInstance) {
  app.post<{ Body: ChatBody }>("/chat", async (request, reply) => {
    const { message, sessionId } = request.body;

    // 1. Obtener o crear sesión
    const workersClient = await getWorkersClient();
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const sessionResult = await workersClient.callTool({ name: "get_session", arguments: {} });
      const session = JSON.parse((sessionResult.content[0] as { text: string }).text);
      currentSessionId = session.id;
    }

    // 2. Buscar en procedimientos
    const docsClient = await getDocumentsClient();
    const searchResult = await docsClient.callTool({
      name: "search_procedures",
      arguments: { query: message },
    });
    const { answer, references } = JSON.parse(
      (searchResult.content[0] as { text: string }).text
    );

    reply.send({ answer, references, sessionId: currentSessionId });
  });
}
```

- [ ] **Step 4: Ejecutar test**

```bash
npx vitest run src/__tests__/chat.test.ts
```

Expected: 1 PASS

- [ ] **Step 5: Implementar ruta admin**

`packages/gateway/src/routes/admin.ts`:
```typescript
import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../middleware/auth.js";
import { getAdminClient, getDocumentsClient } from "../mcp-client.js";
import { ingestDocument } from "@nalakalu/mcp-documents/ingest";

export async function adminRoutes(app: FastifyInstance) {
  // GET /api/admin/documents
  app.get("/documents", { preHandler: requireAdmin }, async (request, reply) => {
    const adminClient = await getAdminClient();
    const result = await adminClient.callTool({ name: "list_documents", arguments: {} });
    const docs = JSON.parse((result.content[0] as { text: string }).text);
    reply.send(docs);
  });

  // DELETE /api/admin/documents/:id
  app.delete<{ Params: { id: string } }>(
    "/documents/:id",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const adminClient = await getAdminClient();
      await adminClient.callTool({ name: "delete_document", arguments: { id: request.params.id } });
      reply.send({ ok: true });
    }
  );

  // POST /api/admin/documents  (multipart/form-data)
  app.post("/documents", { preHandler: requireAdmin }, async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.status(400).send({ error: "Archivo requerido" });

    const buffer = await data.toBuffer();
    const result = await ingestDocument({
      filename: data.filename,
      buffer,
      contentType: data.mimetype,
      category: (request.query as Record<string, string>).category,
      uploadedBy: request.headers["x-user"] as string | undefined,
    });

    reply.status(201).send(result);
  });
}
```

> El import `from "@nalakalu/mcp-documents/ingest"` funciona porque el `exports` del package.json de mcp-documents expone `"./ingest": "./dist/ingest.js"`. Asegúrate de hacer `npm run build -w @nalakalu/mcp-documents` antes de levantar el gateway.

- [ ] **Step 6: Commit**

```bash
cd ../..
git add packages/gateway/
git commit -m "feat(gateway): rutas /chat y /admin con tests"
```

---

## Task 9: Frontend — Chat UI

**Files:**
- Create: `packages/frontend/src/lib/api.ts`
- Create: `packages/frontend/src/components/MessageBubble.tsx`
- Create: `packages/frontend/src/components/ChatInput.tsx`
- Create: `packages/frontend/src/components/DocumentLink.tsx`
- Create: `packages/frontend/src/components/Chat.tsx`
- Create: `packages/frontend/src/app/layout.tsx`
- Create: `packages/frontend/src/app/page.tsx`
- Create: `packages/frontend/tailwind.config.ts`
- Create: `packages/frontend/next.config.js`

- [ ] **Step 1: Configurar Next.js y Tailwind**

`packages/frontend/next.config.js`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
```

`packages/frontend/tailwind.config.ts`:
```typescript
import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 2: Escribir cliente API**

`packages/frontend/src/lib/api.ts`:
```typescript
const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:3001";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  references?: { documentId: string; section: string }[];
}

export async function sendMessage(
  message: string,
  sessionId: string | null
): Promise<{ answer: string; references: { documentId: string; section: string }[]; sessionId: string }> {
  const res = await fetch(`${GATEWAY}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sessionId }),
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
```

- [ ] **Step 3: Componente MessageBubble**

`packages/frontend/src/components/MessageBubble.tsx`:
```tsx
import DocumentLink from "./DocumentLink";

interface Reference {
  documentId: string;
  section: string;
}

interface Props {
  role: "user" | "assistant";
  content: string;
  references?: Reference[];
}

export default function MessageBubble({ role, content, references }: Props) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-base leading-relaxed ${
          isUser
            ? "bg-blue-600 text-white rounded-br-sm"
            : "bg-slate-700 text-slate-100 rounded-bl-sm"
        }`}
      >
        <p className="whitespace-pre-wrap">{content}</p>
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

- [ ] **Step 4: Componente DocumentLink**

`packages/frontend/src/components/DocumentLink.tsx`:
```tsx
"use client";

interface Props {
  documentId: string;
  section: string;
}

export default function DocumentLink({ documentId, section }: Props) {
  const handleOpen = async () => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_GATEWAY_URL}/api/chat/document/${documentId}`
    );
    const data = await res.json();
    window.open(data.downloadUrl, "_blank");
  };

  return (
    <button
      onClick={handleOpen}
      className="text-xs text-blue-300 underline hover:text-blue-200 text-left"
    >
      📄 {section}
    </button>
  );
}
```

- [ ] **Step 5: Componente ChatInput**

`packages/frontend/src/components/ChatInput.tsx`:
```tsx
"use client";

import { useState, KeyboardEvent } from "react";

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState("");

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex gap-2 p-4 bg-slate-800 border-t border-slate-700">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKey}
        disabled={disabled}
        placeholder="Escribe tu pregunta sobre los procedimientos..."
        rows={2}
        className="flex-1 resize-none rounded-xl bg-slate-700 text-slate-100 placeholder-slate-400 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="px-5 py-3 bg-blue-600 text-white rounded-xl font-semibold text-lg hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed active:bg-blue-700"
      >
        ▶
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Componente Chat principal**

`packages/frontend/src/components/Chat.tsx`:
```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import { sendMessage, ChatMessage } from "@/lib/api";

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hola 👋 Soy el asistente de procedimientos. ¿En qué te puedo ayudar hoy?",
    },
  ]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (message: string) => {
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setLoading(true);
    try {
      const res = await sendMessage(message, sessionId);
      if (!sessionId) setSessionId(res.sessionId);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.answer, references: res.references },
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

  return (
    <div className="flex flex-col h-screen bg-slate-900">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-800 border-b border-slate-700 text-center">
        <h1 className="text-white font-bold text-lg">Asistente de Procedimientos</h1>
        <p className="text-slate-400 text-sm">Consulta cualquier procedimiento de la empresa</p>
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.map((msg, i) => (
          <MessageBubble key={i} role={msg.role} content={msg.content} references={msg.references} />
        ))}
        {loading && (
          <div className="flex justify-start mb-3">
            <div className="bg-slate-700 text-slate-400 rounded-2xl rounded-bl-sm px-4 py-3 text-base">
              Buscando en procedimientos...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={loading} />
    </div>
  );
}
```

- [ ] **Step 7: Layout y página principal**

`packages/frontend/src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nalakalu — Asistente de Procedimientos",
  viewport: "width=device-width, initial-scale=1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-slate-900 antialiased">{children}</body>
    </html>
  );
}
```

Crear `packages/frontend/src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`packages/frontend/src/app/page.tsx`:
```tsx
import Chat from "@/components/Chat";

export default function Home() {
  return <Chat />;
}
```

- [ ] **Step 8: Commit**

```bash
git add packages/frontend/src/
git commit -m "feat(frontend): chat UI responsive con burbujas y referencias a documentos"
```

---

## Task 10: Frontend — Panel de administración

**Files:**
- Create: `packages/frontend/src/app/admin/page.tsx`

- [ ] **Step 1: Implementar panel admin**

`packages/frontend/src/app/admin/page.tsx`:
```tsx
"use client";

import { useState, useEffect, useRef } from "react";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:3001";

interface DocMeta {
  id: string;
  originalName: string;
  category: string | null;
  createdAt: string;
}

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [authed, setAuthed] = useState(false);
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const headers = () => ({ "x-admin-secret": secret });

  const loadDocs = async () => {
    const res = await fetch(`${GATEWAY}/api/admin/documents`, { headers: headers() });
    if (res.ok) setDocs(await res.json());
  };

  const login = async () => {
    const res = await fetch(`${GATEWAY}/api/admin/documents`, { headers: headers() });
    if (res.ok) { setAuthed(true); setDocs(await res.json()); }
    else alert("Clave incorrecta");
  };

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${GATEWAY}/api/admin/documents?category=${encodeURIComponent(category)}`, {
      method: "POST",
      headers: headers(),
      body: form,
    });
    setUploading(false);
    if (res.ok) { await loadDocs(); fileRef.current!.value = ""; setCategory(""); }
    else alert("Error al subir archivo");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Desactivar este procedimiento?")) return;
    await fetch(`${GATEWAY}/api/admin/documents/${id}`, { method: "DELETE", headers: headers() });
    setDocs((prev) => prev.filter((d) => d.id !== id));
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 p-6 rounded-2xl w-full max-w-sm">
          <h1 className="text-white text-xl font-bold mb-4 text-center">Panel Admin</h1>
          <input
            type="password"
            placeholder="Clave de acceso"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            className="w-full bg-slate-700 text-white rounded-xl px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button onClick={login} className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold hover:bg-blue-500">
            Entrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-4 max-w-2xl mx-auto">
      <h1 className="text-white text-2xl font-bold mb-6">Gestión de Procedimientos</h1>

      {/* Upload */}
      <div className="bg-slate-800 rounded-2xl p-4 mb-6">
        <h2 className="text-white font-semibold mb-3">Subir nuevo procedimiento</h2>
        <input
          type="text"
          placeholder="Categoría (ej: Ensamble, Seguridad)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full bg-slate-700 text-white rounded-xl px-4 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="w-full text-slate-300 mb-3" />
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="w-full bg-green-600 text-white rounded-xl py-3 font-semibold hover:bg-green-500 disabled:opacity-50"
        >
          {uploading ? "Subiendo y procesando..." : "Subir procedimiento"}
        </button>
      </div>

      {/* Doc list */}
      <div className="space-y-3">
        {docs.map((doc) => (
          <div key={doc.id} className="bg-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-white font-medium">{doc.originalName}</p>
              <p className="text-slate-400 text-sm">{doc.category ?? "Sin categoría"}</p>
            </div>
            <button
              onClick={() => handleDelete(doc.id)}
              className="text-red-400 hover:text-red-300 text-sm px-3 py-1 border border-red-800 rounded-lg"
            >
              Desactivar
            </button>
          </div>
        ))}
        {docs.length === 0 && (
          <p className="text-slate-500 text-center py-8">No hay procedimientos cargados aún.</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/src/app/admin/
git commit -m "feat(frontend): panel de administración de documentos"
```

---

## Task 11: Ruta gateway para obtener URL de documento

**Files:**
- Modify: `packages/gateway/src/routes/chat.ts`

- [ ] **Step 1: Agregar ruta GET /api/chat/document/:id**

Añadir al final de la función `chatRoutes` en `packages/gateway/src/routes/chat.ts`:
```typescript
  // GET /api/chat/document/:id  — URL de descarga del PDF original
  app.get<{ Params: { id: string } }>("/chat/document/:id", async (request, reply) => {
    const docsClient = await getDocumentsClient();
    const result = await docsClient.callTool({
      name: "get_document",
      arguments: { id: request.params.id },
    });
    const doc = JSON.parse((result.content[0] as { text: string }).text);
    reply.send(doc);
  });
```

- [ ] **Step 2: Commit**

```bash
git add packages/gateway/src/routes/chat.ts
git commit -m "feat(gateway): ruta GET /api/chat/document/:id para abrir PDFs"
```

---

## Task 12: Verificación end-to-end

- [ ] **Step 1: Buildear todos los paquetes**

```bash
npm run build --workspaces --if-present
```

Expected: cada paquete compila sin errores TypeScript.

- [ ] **Step 2: Ejecutar todos los tests**

```bash
npm test
```

Expected: todos los tests en verde.

- [ ] **Step 3: Levantar el stack completo en local**

Terminal 1 — Gateway:
```bash
cd packages/gateway && npm run dev
```
Expected: `Gateway corriendo en http://localhost:3001`

Terminal 2 — Frontend:
```bash
cd packages/frontend && npm run dev
```
Expected: `ready - started server on http://localhost:3000`

- [ ] **Step 4: Subir un procedimiento de prueba**

```bash
# Crear un PDF de prueba mínimo
echo "Procedimiento P-001: Ensamble de cajón tipo B. Paso 1: verificar dimensiones. Paso 2: aplicar cola. Paso 3: ensamblar." > /tmp/proc-test.txt
# Subir vía admin panel en http://localhost:3000/admin (clave: valor de ADMIN_SECRET en .env)
```

Abrir `http://localhost:3000/admin` → ingresar clave → subir el archivo.

- [ ] **Step 5: Probar el chat**

Abrir `http://localhost:3000` y enviar: `¿Cómo ensamblo el cajón tipo B?`

Expected:
- El bot responde con información del procedimiento
- Aparece link "📄 P-001" debajo de la respuesta
- Al hacer clic abre el archivo desde R2

- [ ] **Step 6: Verificar responsive**

En DevTools del navegador, probar:
- 375px (iPhone SE) — el chat debe ser usable
- 768px (tablet) — debe verse bien en kiosko

- [ ] **Step 7: Commit final**

```bash
git add .
git commit -m "chore: verificación e2e completa — v1 lista"
```

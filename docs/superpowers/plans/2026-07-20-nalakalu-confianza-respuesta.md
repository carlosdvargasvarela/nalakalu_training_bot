# Nalakalu — Confianza en la Respuesta (Fase 1 GUI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada respuesta del asistente muestra de qué documento sale y cuándo se actualizó, y el usuario puede marcar 👍/👎/☆ en cualquier respuesta (no solo la última), persistiendo el feedback en base de datos.

**Architecture:** `updated_at` ya existe en `documents`; se propaga por la cadena existente (`searchProcedures` → `queryAbacus` → gateway → frontend) sin tabla nueva. El feedback es una tabla nueva (`message_feedback`) escrita a través de un tool MCP nuevo (`record_feedback`) en `mcp-documents`, expuesto por una ruta proxy nueva en `gateway`, siguiendo el mismo patrón que toda ruta existente en este monorepo (gateway nunca toca la DB directo).

**Tech Stack:** TypeScript, Fastify, PostgreSQL (`pg`), Model Context Protocol SDK, Next.js/React, Tailwind, lucide-react, Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-20-nalakalu-confianza-respuesta-design.md`
- Sin cambios de branding/tema visual, sin funcionalidades de chat nuevas, sin panel admin — eso es de fases siguientes.
- Sin dashboard de feedback para la empresa — solo persistir el dato.
- Sin test nuevo de frontend (no hay infraestructura de test ahí) — se verifica con `tsc --noEmit`.
- Gateway nunca accede a la DB directamente — siempre pasa por un cliente MCP (`getDocumentsClient()`), igual que toda ruta existente en `packages/gateway/src/routes/chat.ts`.

---

### Task 1: Migración de base de datos — tabla `message_feedback`

**Files:**
- Create: `packages/db/migrations/005_feedback.sql`

**Interfaces:**
- Produces: tabla `message_feedback(id, session_id, question, answer, rating, document_ids, created_at)` — consumida por `recordFeedback()` en Task 3.

- [ ] **Step 1: Crear el archivo de migración**

```sql
CREATE TABLE IF NOT EXISTS message_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('up', 'down')),
  document_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 2: Verificar que el runner de migraciones la recoja**

Run: `ls packages/db/migrations/`
Expected: `005_feedback.sql` listado junto a `001_sessions.sql` … `004_tags_and_updated_at.sql` (el runner en `packages/db/src/migrate.ts` ordena por nombre de archivo y aplica las que falten — no requiere registro manual).

- [ ] **Step 3: Commit**

```bash
git add packages/db/migrations/005_feedback.sql
git commit -m "feat(db): add message_feedback table"
```

---

### Task 2: Propagar `updatedAt` en las referencias de respuesta

**Files:**
- Modify: `packages/mcp-documents/src/tools.ts:5-10,27` (interface `DocRow`, SELECT de `fetchDocs`)
- Modify: `packages/mcp-documents/src/abacus.ts:5-15,69-72` (`AbacusQueryResult`, `DocContext`, mapeo de `references`)
- Modify: `packages/mcp-documents/src/__tests__/abacus.test.ts` (agregar `updated_at` a `mockDocs` + assertion)
- Modify: `packages/mcp-documents/src/__tests__/tools.test.ts` (assertion de que el SELECT incluye `updated_at`)

**Interfaces:**
- Consumes: `documents.updated_at` (columna ya existente, migración 004).
- Produces: `AbacusQueryResult.references[].updatedAt: string` (ISO) — consumido por `packages/gateway/src/routes/chat.ts` (passthrough, sin cambios) y por el frontend en Task 5.

- [ ] **Step 1: Actualizar el test de `abacus.test.ts` para exigir `updatedAt`**

Reemplazar el archivo completo:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted evita el problema de hoisting con variables referenciadas en vi.mock
const mockCreate = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

import { queryAbacus } from "../abacus.js";

const mockDocs = [
  {
    id: "doc-1",
    original_name: "P-047 Ensamble cajón",
    category: "Ensamble",
    content: "El cajón tipo B se ensambla en 3 pasos: paso 1...",
    updated_at: new Date("2026-07-15T12:00:00.000Z"),
  },
];

describe("queryAbacus (Claude)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  it("llama a Claude y devuelve respuesta + referencias con updatedAt", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "El cajón tipo B se ensambla en 3 pasos..." }],
    });

    const result = await queryAbacus("¿Cómo ensamblo el cajón tipo B?", mockDocs);

    expect(result.answer).toContain("cajón tipo B");
    expect(result.references).toHaveLength(1);
    expect(result.references[0].documentId).toBe("doc-1");
    expect(result.references[0].updatedAt).toBe("2026-07-15T12:00:00.000Z");
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("devuelve mensaje de sin resultados cuando no hay documentos", async () => {
    const result = await queryAbacus("pregunta sin docs", []);

    expect(result.answer).toContain("No encontré");
    expect(result.references).toHaveLength(0);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd packages/mcp-documents && npx vitest run src/__tests__/abacus.test.ts`
Expected: FAIL — `result.references[0].updatedAt` es `undefined` (todavía no existe el campo).

- [ ] **Step 3: Implementar en `abacus.ts`**

Modificar la interfaz `AbacusQueryResult` y `DocContext`, y el mapeo de `references`:

```ts
export interface AbacusQueryResult {
  answer: string;
  references: { documentId: string; section: string; updatedAt: string }[];
}

interface DocContext {
  id: string;
  original_name: string;
  category: string | null;
  content: string;
  updated_at: Date;
}
```

Y el `return` final de `queryAbacus`:

```ts
  return {
    answer,
    references: docs.map((d) => ({
      documentId: d.id,
      section: d.original_name,
      updatedAt: d.updated_at.toISOString(),
    })),
  };
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd packages/mcp-documents && npx vitest run src/__tests__/abacus.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Propagar `updated_at` desde la query SQL en `tools.ts`**

Modificar `DocRow` y el SELECT de `fetchDocs`:

```ts
interface DocRow {
  id: string;
  original_name: string;
  category: string | null;
  content: string;
  updated_at: Date;
}
```

```ts
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
```

- [ ] **Step 6: Agregar assertion en `tools.test.ts`**

En el test `"busca sin tags — llama queryAbacus con todos los docs relevantes"` de `packages/mcp-documents/src/__tests__/tools.test.ts`, agregar tras la línea `expect(sql).not.toContain("tags @>");`:

```ts
    expect(sql).toContain("updated_at");
```

- [ ] **Step 7: Correr toda la suite de `mcp-documents` y verificar que pasa**

Run: `cd packages/mcp-documents && npm test`
Expected: PASS (todos los tests, incluyendo `ingest.test.ts`, `abacus.test.ts`, `tools.test.ts`)

- [ ] **Step 8: Commit**

```bash
git add packages/mcp-documents/src/tools.ts packages/mcp-documents/src/abacus.ts packages/mcp-documents/src/__tests__/abacus.test.ts packages/mcp-documents/src/__tests__/tools.test.ts
git commit -m "feat(mcp-documents): propagate updatedAt into search references"
```

---

### Task 3: Tool `record_feedback` en `mcp-documents`

**Files:**
- Modify: `packages/mcp-documents/src/tools.ts` (agregar función `recordFeedback`)
- Modify: `packages/mcp-documents/src/index.ts:11-17,61-75,102-108` (registrar tool)
- Modify: `packages/mcp-documents/src/__tests__/tools.test.ts` (test de `recordFeedback`)

**Interfaces:**
- Consumes: tabla `message_feedback` (Task 1).
- Produces: `recordFeedback(input: { sessionId: string; question: string; answer: string; rating: "up" | "down"; documentIds: string[] }): Promise<void>` — consumida por la ruta gateway en Task 4. Tool MCP `record_feedback` con args `{ session_id, question, answer, rating, document_ids }`.

- [ ] **Step 1: Escribir el test de `recordFeedback` (falla primero)**

Agregar al final de `packages/mcp-documents/src/__tests__/tools.test.ts`, actualizando el import de la línea 20:

```ts
import { searchProcedures, listTags, getRecentUpdates, recordFeedback } from "../tools.js";
```

Y agregar antes del cierre del archivo:

```ts
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
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd packages/mcp-documents && npx vitest run src/__tests__/tools.test.ts`
Expected: FAIL — `recordFeedback` no está exportada de `../tools.js`.

- [ ] **Step 3: Implementar `recordFeedback` en `tools.ts`**

Agregar al final de `packages/mcp-documents/src/tools.ts`:

```ts
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
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd packages/mcp-documents && npx vitest run src/__tests__/tools.test.ts`
Expected: PASS (todos los `describe` de este archivo)

- [ ] **Step 5: Registrar el tool en `index.ts`**

Modificar el import (línea 11-17):

```ts
import {
  searchProcedures,
  getDocument,
  listCategories,
  listTags,
  getRecentUpdates,
  recordFeedback,
} from "./tools.js";
```

Agregar a la lista de `tools` en `ListToolsRequestSchema` (después de `get_recent_updates`, antes del cierre `],`):

```ts
    {
      name: "record_feedback",
      description: "Guarda el feedback (👍/👎) de una respuesta del asistente",
      inputSchema: {
        type: "object",
        properties: {
          session_id: { type: "string" },
          question: { type: "string" },
          answer: { type: "string" },
          rating: { type: "string", enum: ["up", "down"] },
          document_ids: { type: "array", items: { type: "string" } },
        },
        required: ["session_id", "question", "answer", "rating", "document_ids"],
      },
    },
```

Agregar al handler de `CallToolRequestSchema` (después del bloque `get_recent_updates`, antes del `throw new Error`):

```ts
  if (name === "record_feedback") {
    await recordFeedback({
      sessionId: args!.session_id as string,
      question: args!.question as string,
      answer: args!.answer as string,
      rating: args!.rating as "up" | "down",
      documentIds: args!.document_ids as string[],
    });
    return { content: [{ type: "text", text: JSON.stringify({ ok: true }) }] };
  }
```

- [ ] **Step 6: Build y correr toda la suite**

Run: `cd packages/mcp-documents && npm run build && npm test`
Expected: build sin errores de TypeScript, todos los tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/mcp-documents/src/tools.ts packages/mcp-documents/src/index.ts packages/mcp-documents/src/__tests__/tools.test.ts
git commit -m "feat(mcp-documents): add record_feedback tool"
```

---

### Task 4: Ruta `POST /chat/feedback` en gateway

**Files:**
- Modify: `packages/gateway/src/routes/chat.ts`
- Modify: `packages/gateway/src/__tests__/chat.test.ts`

**Interfaces:**
- Consumes: tool MCP `record_feedback` (Task 3) vía `getDocumentsClient()`.
- Produces: `POST /api/chat/feedback` con body `{ sessionId, question, answer, rating, documentIds }` → `{ ok: true }` — consumida por `sendFeedback()` en el frontend (Task 5).

- [ ] **Step 1: Escribir el test (falla primero)**

Agregar al final de `packages/gateway/src/__tests__/chat.test.ts`:

```ts
describe("POST /api/chat/feedback", () => {
  it("reenvía el feedback al tool record_feedback", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/chat/feedback",
      payload: {
        sessionId: "sess-1",
        question: "¿Cómo ensamblo el cajón tipo B?",
        answer: "Paso 1...",
        rating: "up",
        documentIds: ["doc-1"],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd packages/gateway && npx vitest run src/__tests__/chat.test.ts`
Expected: FAIL — 404, la ruta `/api/chat/feedback` no existe todavía.

- [ ] **Step 3: Implementar la ruta en `chat.ts`**

Agregar dentro de `chatRoutes`, después del handler de `/chat/document/:id` y antes del `}` de cierre de la función:

```ts
  app.post<{
    Body: {
      sessionId: string;
      question: string;
      answer: string;
      rating: "up" | "down";
      documentIds: string[];
    };
  }>("/chat/feedback", async (request, reply) => {
    const { sessionId, question, answer, rating, documentIds } = request.body;
    const docsClient = await getDocumentsClient();
    await docsClient.callTool({
      name: "record_feedback",
      arguments: {
        session_id: sessionId,
        question,
        answer,
        rating,
        document_ids: documentIds,
      },
    });
    reply.send({ ok: true });
  });
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd packages/gateway && npx vitest run src/__tests__/chat.test.ts`
Expected: PASS (todos los `describe` del archivo)

- [ ] **Step 5: Build y correr toda la suite**

Run: `cd packages/gateway && npm run build && npm test`
Expected: build sin errores, todos los tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/gateway/src/routes/chat.ts packages/gateway/src/__tests__/chat.test.ts
git commit -m "feat(gateway): add POST /chat/feedback route"
```

---

### Task 5: `lib/api.ts` — `Reference.updatedAt` y `sendFeedback()`

**Files:**
- Modify: `packages/frontend/src/lib/api.ts:3-6`

**Interfaces:**
- Consumes: `POST /api/chat/feedback` (Task 4), `GET/POST /api/chat` (ya existente, ahora con `updatedAt` en cada referencia).
- Produces: `Reference.updatedAt: string`, `sendFeedback(sessionId: string, question: string, answer: string, rating: "up" | "down", documentIds: string[]): Promise<void>` — consumidos por `DocumentLink.tsx` y `Chat.tsx` en Tasks 6-8.

- [ ] **Step 1: Agregar `updatedAt` a `Reference`**

Modificar `packages/frontend/src/lib/api.ts` líneas 3-6:

```ts
export interface Reference {
  documentId: string;
  section: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Agregar `sendFeedback` al final del archivo**

```ts
export async function sendFeedback(
  sessionId: string,
  question: string,
  answer: string,
  rating: "up" | "down",
  documentIds: string[]
): Promise<void> {
  try {
    await fetch(`${GATEWAY}/api/chat/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, question, answer, rating, documentIds }),
    });
  } catch {
    // señal opcional — no bloquea la UI si falla la red
  }
}
```

- [ ] **Step 3: Verificar tipos**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: sin errores nuevos (los que existan deben ser preexistentes de `Chat.tsx`/`MessageBubble.tsx`/`DocumentLink.tsx`, que se resuelven en los próximos tasks).

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/lib/api.ts
git commit -m "feat(frontend): add Reference.updatedAt and sendFeedback"
```

---

### Task 6: `DocumentLink.tsx` — tarjeta de fuente con fecha relativa

**Files:**
- Modify: `packages/frontend/src/components/DocumentLink.tsx` (reemplazo completo)

**Interfaces:**
- Consumes: `Reference.updatedAt` (Task 5).
- Produces: prop `updatedAt: string` requerida — consumida por `MessageBubble.tsx` en Task 7.

- [ ] **Step 1: Reemplazar el archivo completo**

```tsx
"use client";

import { getDocumentUrl } from "@/lib/api";

interface Props {
  documentId: string;
  section: string;
  updatedAt: string;
}

function relativeDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "Actualizado hoy";
  if (days === 1) return "Actualizado hace 1 día";
  return `Actualizado hace ${days} días`;
}

export default function DocumentLink({ documentId, section, updatedAt }: Props) {
  const handleOpen = async () => {
    const url = await getDocumentUrl(documentId);
    window.open(url, "_blank");
  };

  return (
    <button
      onClick={handleOpen}
      className="flex flex-col items-start w-full text-left px-2 py-1.5 rounded-lg hover:bg-app/50 transition-colors"
    >
      <span className="text-xs text-blue-300 underline">📄 {section}</span>
      <span className="text-[11px] text-muted">{relativeDate(updatedAt)}</span>
    </button>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: el único error restante debe ser en `MessageBubble.tsx` (falta pasar `updatedAt` a `DocumentLink`) — se resuelve en Task 7.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/components/DocumentLink.tsx
git commit -m "feat(frontend): show document name + relative update date in source card"
```

---

### Task 7: `MessageBubble.tsx` — fila de acciones (👍👎☆) por mensaje

**Files:**
- Modify: `packages/frontend/src/components/MessageBubble.tsx` (reemplazo completo)

**Interfaces:**
- Consumes: `DocumentLink` con prop `updatedAt` (Task 6).
- Produces: props `onFeedback?: (rating: "up" | "down") => void` y `onFavorite?: () => void` en `MessageBubble` — consumidas por `Chat.tsx` en Task 8. Si ambas son `undefined`, no se renderiza la fila de acciones.

- [ ] **Step 1: Reemplazar el archivo completo**

```tsx
"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ThumbsUp, ThumbsDown, Star } from "lucide-react";
import DocumentLink from "./DocumentLink";
import StepChecklist from "./StepChecklist";
import type { Reference } from "@/lib/api";

interface Props {
  role: "user" | "assistant";
  content: string;
  references?: Reference[];
  textLarge?: boolean;
  onFeedback?: (rating: "up" | "down") => void;
  onFavorite?: () => void;
}

export function LoadingBubble() {
  return (
    <div className="flex justify-start mb-3 items-end gap-2">
      <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
        A
      </div>
      <div className="bg-elevated border border-nk-border/50 shadow-sm text-muted rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex gap-1 items-center h-5">
          <span className="w-2 h-2 rounded-full bg-muted animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 rounded-full bg-muted animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-muted animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

export default function MessageBubble({
  role,
  content,
  references,
  textLarge,
  onFeedback,
  onFavorite,
}: Props) {
  const isUser = role === "user";
  const textClass = textLarge ? "text-lg" : "text-base";
  const [rated, setRated] = useState<"up" | "down" | null>(null);
  const [favorited, setFavorited] = useState(false);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start items-end gap-2"} mb-3`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mb-0.5">
          A
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${textClass} leading-relaxed ${
          isUser
            ? "bg-user-bubble text-white rounded-br-sm"
            : "bg-elevated border border-nk-border/50 shadow-sm text-primary rounded-bl-sm"
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
              em: ({ children }) => <em className="italic text-muted">{children}</em>,
              ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
              ol: ({ children }) => <StepChecklist>{children}</StepChecklist>,
              li: ({ children }) => <>{children}</>,
              h1: ({ children }) => <h1 className="text-lg font-bold text-white mb-2 mt-3 first:mt-0">{children}</h1>,
              h2: ({ children }) => <h2 className="text-base font-bold text-white mb-1 mt-3 first:mt-0">{children}</h2>,
              h3: ({ children }) => <h3 className="text-sm font-semibold text-primary mb-1 mt-2 first:mt-0">{children}</h3>,
              code: ({ children }) => <code className="bg-app text-primary rounded px-1 py-0.5 text-sm font-mono">{children}</code>,
              blockquote: ({ children }) => <blockquote className="border-l-2 border-nk-border pl-3 italic text-muted mb-2">{children}</blockquote>,
            }}
          >
            {content}
          </ReactMarkdown>
        )}
        {references && references.length > 0 && (
          <div className="mt-2 border-t border-nk-border pt-2 space-y-1">
            {references.map((ref) => (
              <DocumentLink
                key={ref.documentId}
                documentId={ref.documentId}
                section={ref.section}
                updatedAt={ref.updatedAt}
              />
            ))}
          </div>
        )}
        {!isUser && (onFeedback || onFavorite) && (
          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-nk-border/50">
            {onFeedback && (
              <>
                <button
                  onClick={() => {
                    setRated("up");
                    onFeedback("up");
                  }}
                  disabled={rated !== null}
                  className={`p-1 rounded transition-colors ${
                    rated === "up" ? "text-accent" : "text-muted hover:text-primary"
                  }`}
                  aria-label="Respuesta útil"
                >
                  <ThumbsUp size={14} />
                </button>
                <button
                  onClick={() => {
                    setRated("down");
                    onFeedback("down");
                  }}
                  disabled={rated !== null}
                  className={`p-1 rounded transition-colors ${
                    rated === "down" ? "text-accent" : "text-muted hover:text-primary"
                  }`}
                  aria-label="Respuesta no útil"
                >
                  <ThumbsDown size={14} />
                </button>
              </>
            )}
            {onFavorite && (
              <button
                onClick={() => {
                  setFavorited(true);
                  onFavorite();
                }}
                disabled={favorited}
                className={`flex items-center gap-1 text-xs ml-1 transition-colors ${
                  favorited ? "text-yellow-400" : "text-muted hover:text-yellow-400"
                }`}
              >
                <Star size={14} /> {favorited ? "Guardado" : "Guardar"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: el único error restante debe ser en `Chat.tsx` (todavía usa `handleFavoriteStar`/`lastAssistantIdx`, sin pasar `onFeedback`/`onFavorite`) — se resuelve en Task 8.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/components/MessageBubble.tsx
git commit -m "feat(frontend): add per-message thumbs up/down and favorite actions"
```

---

### Task 8: `Chat.tsx` — wiring de feedback y favorito por mensaje

**Files:**
- Modify: `packages/frontend/src/components/Chat.tsx` (reemplazo completo)

**Interfaces:**
- Consumes: `MessageBubble` con props `onFeedback`/`onFavorite` (Task 7), `sendFeedback` de `lib/api.ts` (Task 5).
- Produces: ninguno (último task de la fase).

- [ ] **Step 1: Reemplazar el archivo completo**

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import MessageBubble, { LoadingBubble } from "./MessageBubble";
import ChatInput from "./ChatInput";
import TagChips from "./TagChips";
import UpdateBanner from "./UpdateBanner";
import FavoritesDrawer from "./FavoritesDrawer";
import HistoryDrawer from "./HistoryDrawer";
import { Clock, Star, Type } from "lucide-react";
import {
  sendMessage,
  sendFeedback,
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

  return (
    <>
      <div className="flex flex-col h-screen bg-app">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-surface border-b border-nk-border">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h1 className="text-white font-bold text-base leading-tight whitespace-nowrap">Nalakalu</h1>
            {activeTag && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/20 border border-accent/40 text-accent text-xs font-medium">
                {activeTag}
                <button
                  onClick={() => setActiveTag(null)}
                  className="hover:text-white leading-none"
                  aria-label={`Quitar filtro ${activeTag}`}
                >
                  ×
                </button>
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowHistory(true)}
              className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-elevated transition-colors"
              aria-label="Historial"
            >
              <Clock size={18} />
            </button>
            <button
              onClick={() => setShowFavorites(true)}
              className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-elevated transition-colors"
              aria-label="Favoritos"
            >
              <Star size={18} />
            </button>
            <button
              onClick={handleToggleTextSize}
              className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-elevated transition-colors"
              aria-label="Tamaño de texto"
            >
              <Type size={18} />
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
          {messages.map((msg, i) => {
            const precedingUser =
              msg.role === "assistant" && i > 0
                ? [...messages].slice(0, i).reverse().find((m) => m.role === "user")
                : undefined;

            return (
              <MessageBubble
                key={i}
                role={msg.role}
                content={msg.content}
                references={msg.references}
                textLarge={textSize === "lg"}
                onFeedback={
                  precedingUser
                    ? (rating) =>
                        sendFeedback(
                          sessionId ?? "",
                          precedingUser.content,
                          msg.content,
                          rating,
                          (msg.references ?? []).map((r) => r.documentId)
                        )
                    : undefined
                }
                onFavorite={
                  precedingUser
                    ? () =>
                        addFavorite({
                          question: precedingUser.content,
                          answer: msg.content,
                          tags: activeTag ? [activeTag] : [],
                        })
                    : undefined
                }
              />
            );
          })}
          {loading && <LoadingBubble />}
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

- [ ] **Step 2: Verificar tipos — debe estar limpio**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Levantar el frontend y verificar manualmente**

Run: `cd packages/frontend && npm run dev`
Expected: abrir `http://localhost:3000`, mandar una pregunta, verificar que la respuesta muestre la tarjeta de fuente con nombre + fecha, y que 👍/👎/☆ aparezcan en cada respuesta del asistente (no solo la última) y se deshabiliten tras un click.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/components/Chat.tsx
git commit -m "feat(frontend): wire per-message feedback and favorite actions"
```

---

## Self-Review Notes

- **Cobertura del spec:** fuente visible con fecha (Tasks 2, 6) ✓; 👍/👎 persistido (Tasks 1, 3, 4, 5, 7, 8) ✓; favorito movido a cada respuesta (Tasks 7, 8) ✓; sin cambios de branding/funcionalidad/admin (fuera de alcance, no tocado) ✓.
- **Tipos consistentes:** `rating: "up" | "down"` idéntico en `MessageBubble`, `lib/api.ts`, `chat.ts` (gateway) y `recordFeedback` (mcp-documents). `documentIds`/`document_ids` mapeado explícitamente en el borde gateway↔MCP (camelCase en TS, snake_case en args MCP, igual que el resto del proyecto).
- **Sin placeholders:** todos los steps tienen código completo y comandos exactos.

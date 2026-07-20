# Nalakalu — Fase 1: Chat Mejorado + Sistema de Tags

**Fecha:** 2026-05-27
**Estado:** Aprobado — listo para implementación

---

## Objetivo

Mejorar la experiencia del chat para todos los perfiles de usuario (planta, conductores, gerentes) añadiendo un sistema de tags que hace la búsqueda RAG más precisa, y enriqueciendo la UI del chat con modo pasos interactivos, favoritos, historial y accesibilidad.

---

## Alcance

### Incluido en Fase 1
- Sistema de tags en documentos (DB + MCP + admin UI + chat chips)
- Filtrado RAG por tags en `search_procedures`
- Modo pasos interactivos (detección frontend de listas numeradas)
- Favoritos en localStorage
- Historial de consultas en localStorage
- Texto grande (toggle localStorage)
- Banner de procedimiento actualizado (flag en DB)

### Diferido (Fase 2 o posterior)
- Imágenes embebidas desde PDF (requiere pipeline de extracción)
- Tags auto-extraídos con LLM durante ingestión
- Dashboard de analytics para admin
- Soporte offline / PWA para conductores

---

## Arquitectura

```
DB (packages/db)
  └── Migración 003: tags TEXT[] + updated_at en documents

mcp-documents (packages/mcp-documents)
  └── search_procedures: nuevo param tags[]
  └── ingest: guarda tags[]
  └── list_tags: nueva tool
  └── get_recent_updates: nueva tool

gateway (packages/gateway)
  └── POST /api/chat: acepta tag_context[]
  └── POST /api/admin/documents: acepta tags
  └── GET /api/tags (nueva)
  └── GET /api/recent-updates (nueva)

frontend (packages/frontend)
  ├── Chat: chips, pasos, banner, favoritos, historial, texto grande
  └── Admin: campo tags en formulario de subida
```

**Flujo de búsqueda con tag activo:**
```
Usuario toca chip "Ensamble"
→ Frontend guarda tag activo en estado
→ Al enviar mensaje: POST /api/chat { message, tag_context: ["Ensamble"] }
→ Gateway llama search_procedures({ query, tags: ["Ensamble"] })
→ mcp-documents filtra DB: SELECT abacus_doc_id WHERE tags @> '{"Ensamble"}'
→ AbacusAI busca solo dentro de esos documentos
→ Respuesta más precisa
```

---

## Modelo de datos

**Migración `003_tags_and_updated_at.sql`:**

```sql
ALTER TABLE documents
  ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE documents
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX idx_documents_tags ON documents USING GIN (tags);
```

**Decisiones:**
- `TEXT[]` nativo de PostgreSQL (no tabla separada): volumen de documentos reducido, schema más simple, GIN index suficiente.
- `updated_at` se escribe al subir una nueva versión de un documento existente.
- Favoritos e historial van en `localStorage` del navegador — sin necesidad de persistir en servidor ni de auth.

---

## Capa MCP (`mcp-documents`)

### `search_procedures` (modificado)
```typescript
search_procedures({
  query: string,
  tags?: string[]   // nuevo — filtro opcional
})
```
Si vienen `tags`: consulta DB para obtener `abacus_doc_id` de docs activos que contengan **todos** los tags (intersección, no unión). Pasa esos IDs a AbacusAI como filtro. Si no vienen tags: comportamiento existente sin cambio.

### `ingest_document` (modificado)
Acepta `tags: string[]` en el payload. Los persiste en la columna `tags`.

### `list_tags` (nueva)
```typescript
list_tags() → string[]
```
Retorna todos los tags únicos de documentos activos, ordenados alfabéticamente. Usada por el frontend para construir los chips dinámicamente.

### `get_recent_updates` (nueva)
```typescript
get_recent_updates(since_hours?: number) → {
  id: string,
  originalName: string,
  tags: string[],
  updatedAt: string
}[]
```
Retorna documentos con `updated_at` dentro de las últimas N horas (default 24). Usada para el banner de actualización.

---

## Gateway (`packages/gateway`)

| Ruta | Tipo de cambio | Detalle |
|------|---------------|---------|
| `POST /api/chat` | Modificada | Acepta `tag_context?: string[]` en body; lo pasa a `search_procedures` |
| `POST /api/admin/documents` | Modificada | Acepta campo `tags` en multipart; lo parsea a `string[]`. Si ya existe un documento activo con el mismo `original_name`, lo desactiva (soft-replace) antes de insertar el nuevo |
| `GET /api/tags` | Nueva | Llama `list_tags()`, retorna `string[]` |
| `GET /api/recent-updates` | Nueva | Llama `get_recent_updates()`, retorna array de docs recientes |

---

## Frontend (`packages/frontend`)

### Chips de tags
- Al montar el chat, llama `GET /api/tags`
- Se renderizan en scroll horizontal debajo del header
- Un solo tag activo a la vez; tocarlo de nuevo lo desactiva
- El tag activo se incluye en cada request de chat como `tag_context`

### Modo pasos interactivos
- Detección **en cliente** mediante regex de listas numeradas en la respuesta del bot
- Si la respuesta contiene 2+ ítems numerados (`1. ... 2. ...`), se renderiza como checklist
- Cada ítem tiene checkbox que el usuario puede marcar mientras trabaja
- Sin cambio en el backend

### Banner de actualización
- Al montar el chat, llama `GET /api/recent-updates`
- Si hay resultados: banner dismissible en parte superior del chat
- Mensaje: *"📋 El procedimiento '[nombre]' fue actualizado hoy."*
- Al cerrar: guarda flag en localStorage (`banner_dismissed_YYYY-MM-DD`), no reaparece hasta el día siguiente

### Favoritos
- Ícono ★ en cada respuesta del bot
- Al marcar: guarda `{ pregunta, respuesta, tags, fecha }` en localStorage
- Pestaña lateral "Mis favoritos": lista con opción de re-ejecutar pregunta o eliminar favorito

### Historial
- Cada pregunta enviada se guarda automáticamente en localStorage (últimas 20)
- Pestaña "Historial": lista de preguntas recientes; tocar un ítem re-ejecuta la pregunta

### Texto grande
- Ícono ⚙ en el header
- Toggle que cambia clase CSS del contenedor de chat entre `text-base` y `text-lg`
- Persiste en localStorage

### Admin — campo tags
- Input de texto libre con placeholder `"Etiquetas: ensamble, seguridad, cajón"`
- Se parsea por comas antes de enviar al gateway
- Se muestran los tags actuales de cada documento en la lista de documentos existentes

---

## Manejo de errores

- Si `GET /api/tags` falla: el chat funciona sin chips (degradación silenciosa)
- Si `GET /api/recent-updates` falla: no se muestra el banner (degradación silenciosa)
- Si el filtro por tags no retorna documentos coincidentes: `search_procedures` hace fallback a búsqueda sin filtro y añade nota en la respuesta: *"No encontré procedimientos con esa etiqueta; busqué en todos los documentos."*
- Tags vacíos al subir documento: se acepta, el documento queda sin tags (`{}`)

---

## Tests

- **mcp-documents:** tests unitarios para `search_procedures` con y sin `tags[]`, `list_tags`, `get_recent_updates`
- **gateway:** test de integración para `POST /api/chat` con `tag_context`; test para `GET /api/tags`
- **Frontend:** comportamiento de detección de pasos (regex), localStorage de favoritos e historial — testeados con vitest/jsdom si aplica

---

## Archivos afectados

**Nuevos:**
- `packages/db/migrations/003_tags_and_updated_at.sql`

**Modificados:**
- `packages/mcp-documents/src/tools.ts`
- `packages/mcp-documents/src/ingest.ts`
- `packages/mcp-documents/src/index.ts`
- `packages/gateway/src/routes/chat.ts`
- `packages/gateway/src/routes/admin.ts`
- `packages/frontend/src/components/Chat.tsx`
- `packages/frontend/src/components/ChatInput.tsx`
- `packages/frontend/src/components/MessageBubble.tsx`
- `packages/frontend/src/app/admin/page.tsx`

**Nuevos en frontend:**
- `packages/frontend/src/components/TagChips.tsx`
- `packages/frontend/src/components/StepChecklist.tsx`
- `packages/frontend/src/components/UpdateBanner.tsx`
- `packages/frontend/src/components/FavoritesDrawer.tsx`
- `packages/frontend/src/components/HistoryDrawer.tsx`
- `packages/frontend/src/lib/localStorage.ts`

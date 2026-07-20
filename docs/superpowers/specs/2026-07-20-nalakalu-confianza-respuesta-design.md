# Nalakalu — Confianza en la respuesta (Fase 1 de GUI)

**Fecha:** 2026-07-20
**Estado:** Aprobado — listo para plan de implementación

## Objetivo

Primera de 4 fases de mejora de GUI (orden acordado: usabilidad → visual/branding → funcionalidad de chat → panel admin). Esta fase ataca el mayor punto de fricción detectado: el operario no confía en la respuesta porque no sabe de qué documento sale ni puede señalar si le sirvió.

## Alcance

### Incluido
- Mostrar fuente de cada respuesta como tarjeta clara (nombre del documento + fecha de última actualización), no un link chico al final.
- Botones 👍/👎 por cada respuesta del asistente, persistidos en base de datos.
- Mover la acción de favorito (☆) de "solo la última respuesta" a cada respuesta, junto con 👍/👎.

### Excluido
- Cambios de branding/tema visual (fase siguiente).
- Nuevas funcionalidades de chat (subir archivo, ver doc embebido — fase siguiente).
- Panel admin (fase siguiente).
- Dashboard o vista de feedback para la empresa (se persiste el dato; verlo es trabajo futuro, no de esta fase).

## Backend

**`packages/db/migrations/005_feedback.sql`** (nueva tabla):
```sql
CREATE TABLE message_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('up', 'down')),
  document_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**`packages/mcp-documents/src/tools.ts`**
- `searchProcedures()`: agregar `updated_at` al SELECT existente y al `DocContext`.
- Nuevo tool `record_feedback({ sessionId, question, answer, rating, documentIds })` — INSERT vía `getDb()`, mismo patrón que el resto del archivo.

**`packages/mcp-documents/src/abacus.ts`**
- `AbacusQueryResult.references` gana `updatedAt: string` (ISO), tomado de `DocContext`.

**`packages/gateway/src/routes/chat.ts`**
- Nueva ruta `POST /chat/feedback` — proxy directo a `docsClient.callTool("record_feedback", ...)`, mismo patrón que las rutas existentes. Sin cambios en `/chat` (ya hace passthrough de `references`).

## Frontend

**`lib/api.ts`**
- `Reference` gana `updatedAt: string`.
- Nueva función `sendFeedback(sessionId, question, answer, rating, documentIds)` — fire-and-forget, catch silencioso (señal opcional, no bloqueante).

**`components/DocumentLink.tsx`**
- Pasa de link de texto a tarjeta: ícono + nombre del documento + fecha relativa ("Actualizado hace 3 días", calculada con `Date` nativo, sin librería). Mantiene el `onClick` que abre el doc en pestaña nueva.

**`components/MessageBubble.tsx`**
- Nueva fila de acciones bajo las referencias: 👍 👎 (lucide `ThumbsUp`/`ThumbsDown`) + ☆ Guardar (lucide `Star`, ya usado en el proyecto).
- Se muestra en cada mensaje del asistente excepto el saludo inicial (`index === 0`).
- Recibe `onFeedback?: (rating: "up" | "down") => void` y `onFavorite?: () => void` como props.
- Estado local: tras votar, botón se marca activo (color accent) y se deshabilita — sin persistencia entre recargas (bajo riesgo, no amerita `localStorage`).

**`components/Chat.tsx`**
- Elimina el botón suelto `handleFavoriteStar` fuera de la lista de mensajes.
- Por cada mensaje del asistente, calcula la pregunta que lo precede y pasa `onFeedback`/`onFavorite` a `MessageBubble` (mismo cálculo que hoy hace una sola vez para el último mensaje).

## Testing

- `mcp-documents`: test para `record_feedback()` (inserta fila, patrón igual a los tests existentes en `__tests__/`).
- `gateway`: test para `POST /chat/feedback` (proxy, patrón igual a `chat.test.ts` existente).
- Sin test nuevo de frontend — no hay infraestructura de test ahí todavía (YAGNI).

## Criterios de éxito

- Cada respuesta del asistente muestra de qué documento sale y cuándo se actualizó.
- 👍/👎 en cualquier respuesta queda guardado en `message_feedback`.
- El favorito (☆) funciona en cualquier respuesta, no solo la última.

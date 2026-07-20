# Nalakalu UX/UI Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework visual completo del frontend de Nalakalu — bug fix de checkboxes, sistema de tokens CSS para theming, y polish de todos los componentes UI.

**Architecture:** Se introducen CSS custom properties en `globals.css` como capa de theming; `tailwind.config.ts` las expone como colores con nombre semántico. Cada componente migra sus clases `slate-*` hardcoded a las nuevas clases token. No hay cambios en lógica de negocio ni APIs.

**Tech Stack:** Next.js 14, Tailwind CSS v3, lucide-react (nuevo), ReactMarkdown, TypeScript

---

## File Map

| Archivo | Acción |
|---------|--------|
| `packages/frontend/src/app/globals.css` | Añadir tokens CSS |
| `packages/frontend/tailwind.config.ts` | Extender colors con tokens |
| `packages/frontend/src/components/StepChecklist.tsx` | Bug fix + mejoras |
| `packages/frontend/src/components/MessageBubble.tsx` | Avatar, loading dots, tokens, fix li |
| `packages/frontend/src/components/Chat.tsx` | Header con lucide icons + tag indicator |
| `packages/frontend/src/components/ChatInput.tsx` | Auto-resize, Send icon, tokens |
| `packages/frontend/src/components/TagChips.tsx` | Pills styling, fade edges, tokens |
| `packages/frontend/src/components/UpdateBanner.tsx` | Bell icon, tokens |
| `packages/frontend/src/components/FavoritesDrawer.tsx` | X icon, slide-in, tokens |
| `packages/frontend/src/components/HistoryDrawer.tsx` | X icon, slide-in, tokens |

---

### Task 1: Instalar lucide-react y definir CSS tokens

**Files:**
- Modify: `packages/frontend/package.json` (via npm install)
- Modify: `packages/frontend/src/app/globals.css`
- Modify: `packages/frontend/tailwind.config.ts`

- [ ] **Step 1: Instalar lucide-react**

```bash
cd /home/cdvv/Documentos/Nalakalu_IA/nalakalu/packages/frontend
npm install lucide-react
```

Expected: `added 1 package` (o similar, sin errores)

- [ ] **Step 2: Añadir CSS custom properties en globals.css**

Reemplazar el contenido completo de `packages/frontend/src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg-app:        #0f172a;
  --bg-surface:    #1e293b;
  --bg-elevated:   #293548;
  --bg-input:      #334155;
  --border:        #334155;
  --text-primary:  #f1f5f9;
  --text-muted:    #94a3b8;
  --text-disabled: #475569;
  --accent:        #3b82f6;
  --accent-hover:  #2563eb;
  --user-bubble:   #1d4ed8;
}
```

- [ ] **Step 3: Extender Tailwind con los tokens**

Reemplazar el contenido completo de `packages/frontend/tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        app:            "var(--bg-app)",
        surface:        "var(--bg-surface)",
        elevated:       "var(--bg-elevated)",
        "bg-input":     "var(--bg-input)",
        "nk-border":    "var(--border)",
        accent:         "var(--accent)",
        "accent-h":     "var(--accent-hover)",
        "user-bubble":  "var(--user-bubble)",
        primary:        "var(--text-primary)",
        muted:          "var(--text-muted)",
        "txt-disabled": "var(--text-disabled)",
      },
    },
  },
  plugins: [],
} satisfies Config;
```

> Nota: se usan nombres como `nk-border` para evitar colisión con el `border` nativo de Tailwind, y `txt-disabled` para evitar colisión con `disabled:` variant.

- [ ] **Step 4: Verificar que el build sigue pasando**

```bash
cd /home/cdvv/Documentos/Nalakalu_IA/nalakalu
npm run build -w @nalakalu/frontend
```

Expected: `✓ Compiled successfully` sin errores de TypeScript.

- [ ] **Step 5: Commit**

```bash
cd /home/cdvv/Documentos/Nalakalu_IA/nalakalu
git add packages/frontend/package.json packages/frontend/package-lock.json packages/frontend/src/app/globals.css packages/frontend/tailwind.config.ts
git commit -m "feat(frontend): añadir sistema de CSS tokens y lucide-react"
```

---

### Task 2: Fix StepChecklist — bug de checkboxes en blanco + mejoras visuales

**Files:**
- Modify: `packages/frontend/src/components/StepChecklist.tsx`

**Causa del bug:** ReactMarkdown inyecta nodos de texto `"\n"` entre los `<li>` al construir el array de children del `<ol>`. `StepChecklist` los trata como ítems → checkboxes vacíos.

- [ ] **Step 1: Reescribir StepChecklist.tsx**

```tsx
"use client";

import { useState } from "react";

interface Props {
  children: React.ReactNode;
}

export default function StepChecklist({ children }: Props) {
  const raw = Array.isArray(children) ? children : [children];
  // Filtrar nodos de texto vacíos que ReactMarkdown inyecta entre <li>
  const items = raw.filter(
    (child) => typeof child !== "string" || child.trim() !== ""
  );

  const [checked, setChecked] = useState<boolean[]>(() =>
    new Array(items.length).fill(false)
  );

  const toggle = (i: number) =>
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));

  const completedCount = checked.filter(Boolean).length;

  return (
    <div className="my-3">
      {items.length > 1 && (
        <p className="text-xs text-muted mb-2">
          {completedCount} / {items.length} pasos completados
        </p>
      )}
      <ol className="space-y-3">
        {items.map((child, i) => (
          <li
            key={i}
            className={`flex items-start gap-3 rounded-lg px-2 py-1.5 transition-colors duration-150 ${
              checked[i] ? "bg-elevated/40" : ""
            }`}
          >
            <input
              type="checkbox"
              checked={checked[i] ?? false}
              onChange={() => toggle(i)}
              className="mt-0.5 h-5 w-5 flex-shrink-0 rounded border-nk-border bg-bg-input cursor-pointer accent-accent"
            />
            <div
              className={`leading-relaxed ${
                checked[i] ? "line-through text-muted" : "text-primary"
              }`}
            >
              {child}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
```

> Cambios clave vs. original: filtro de strings vacíos, `div` en vez de `span` (evita block-inside-inline con el `<p>` que genera ReactMarkdown), barra de progreso, `gap-3` + `rounded-lg` en cada ítem, clases con tokens.

- [ ] **Step 2: Verificar build**

```bash
cd /home/cdvv/Documentos/Nalakalu_IA/nalakalu
npm run build -w @nalakalu/frontend
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/components/StepChecklist.tsx
git commit -m "fix(frontend): corregir checkboxes en blanco y mejorar StepChecklist"
```

---

### Task 3: Mejorar MessageBubble — avatar, loading dots y tokens

**Files:**
- Modify: `packages/frontend/src/components/MessageBubble.tsx`

- [ ] **Step 1: Reescribir MessageBubble.tsx**

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

export default function MessageBubble({ role, content, references, textLarge }: Props) {
  const isUser = role === "user";
  const textClass = textLarge ? "text-lg" : "text-base";

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
              <DocumentLink key={ref.documentId} documentId={ref.documentId} section={ref.section} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Actualizar Chat.tsx para usar LoadingBubble**

En `packages/frontend/src/components/Chat.tsx`, cambiar el import y el bloque de loading:

```tsx
// Cambiar el import de MessageBubble:
import MessageBubble, { LoadingBubble } from "./MessageBubble";
```

```tsx
// Reemplazar el bloque loading (actualmente líneas 163-170):
{loading && <LoadingBubble />}
```

- [ ] **Step 3: Verificar build**

```bash
cd /home/cdvv/Documentos/Nalakalu_IA/nalakalu
npm run build -w @nalakalu/frontend
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/components/MessageBubble.tsx packages/frontend/src/components/Chat.tsx
git commit -m "feat(frontend): avatar asistente, loading dots animados y tokens en MessageBubble"
```

---

### Task 4: Rediseñar Header con lucide-react y tag indicator

**Files:**
- Modify: `packages/frontend/src/components/Chat.tsx`

- [ ] **Step 1: Reemplazar el header en Chat.tsx**

Al inicio del archivo añadir el import de lucide:
```tsx
import { Clock, Star, Type } from "lucide-react";
```

Reemplazar el bloque `{/* Header */}` (actualmente líneas 112-139) con:

```tsx
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
      title="Historial"
    >
      <Clock size={18} />
    </button>
    <button
      onClick={() => setShowFavorites(true)}
      className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-elevated transition-colors"
      title="Favoritos"
    >
      <Star size={18} />
    </button>
    <button
      onClick={handleToggleTextSize}
      className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-elevated transition-colors"
      title="Tamaño de texto"
    >
      <Type size={18} />
    </button>
  </div>
</div>
```

- [ ] **Step 2: Actualizar el fondo principal del contenedor**

En la línea `<div className="flex flex-col h-screen bg-slate-900">`, cambiar a:
```tsx
<div className="flex flex-col h-screen bg-app">
```

- [ ] **Step 3: Verificar build**

```bash
cd /home/cdvv/Documentos/Nalakalu_IA/nalakalu
npm run build -w @nalakalu/frontend
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/components/Chat.tsx
git commit -m "feat(frontend): header rediseñado con lucide icons e indicador de tag activo"
```

---

### Task 5: Mejorar TagChips — pills y fade en bordes

**Files:**
- Modify: `packages/frontend/src/components/TagChips.tsx`

- [ ] **Step 1: Reescribir TagChips.tsx**

```tsx
interface Props {
  tags: string[];
  activeTag: string | null;
  onSelect: (tag: string | null) => void;
}

export default function TagChips({ tags, activeTag, onSelect }: Props) {
  if (tags.length === 0) return null;

  return (
    <div className="relative bg-surface border-b border-nk-border">
      {/* Fade izquierdo */}
      <div className="pointer-events-none absolute left-0 top-0 h-full w-6 bg-gradient-to-r from-surface to-transparent z-10" />
      {/* Fade derecho */}
      <div className="pointer-events-none absolute right-0 top-0 h-full w-6 bg-gradient-to-l from-surface to-transparent z-10" />

      <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-hide">
        {tags.map((tag) => {
          const isActive = tag === activeTag;
          return (
            <button
              key={tag}
              onClick={() => onSelect(isActive ? null : tag)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-sm font-medium transition-colors border ${
                isActive
                  ? "bg-accent border-accent text-white"
                  : "bg-transparent border-nk-border text-muted hover:bg-elevated hover:text-primary"
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar build**

```bash
cd /home/cdvv/Documentos/Nalakalu_IA/nalakalu
npm run build -w @nalakalu/frontend
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/components/TagChips.tsx
git commit -m "feat(frontend): TagChips con pills y fade de bordes"
```

---

### Task 6: Mejorar ChatInput — auto-resize, Send icon y touch target

**Files:**
- Modify: `packages/frontend/src/components/ChatInput.tsx`

- [ ] **Step 1: Reescribir ChatInput.tsx**

```tsx
"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Send } from "lucide-react";

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize hasta 6 líneas (~6rem)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 96) + "px"; // 96px ≈ 6 líneas
  }, [value]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    // Reset altura tras enviar
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex gap-2 p-3 bg-surface border-t border-nk-border">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKey}
        disabled={disabled}
        placeholder="Escribe tu pregunta sobre los procedimientos..."
        rows={1}
        className="flex-1 resize-none rounded-xl bg-bg-input text-primary placeholder-muted px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-accent border border-nk-border focus:border-accent transition-colors disabled:opacity-50"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="w-11 h-11 flex items-center justify-center bg-accent hover:bg-accent-h disabled:opacity-40 disabled:cursor-not-allowed active:bg-accent text-white rounded-xl transition-colors flex-shrink-0 self-end"
        aria-label="Enviar mensaje"
      >
        <Send size={18} />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verificar build**

```bash
cd /home/cdvv/Documentos/Nalakalu_IA/nalakalu
npm run build -w @nalakalu/frontend
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/components/ChatInput.tsx
git commit -m "feat(frontend): ChatInput con auto-resize, icono Send y touch target 44px"
```

---

### Task 7: Refinar UpdateBanner, FavoritesDrawer y HistoryDrawer

**Files:**
- Modify: `packages/frontend/src/components/UpdateBanner.tsx`
- Modify: `packages/frontend/src/components/FavoritesDrawer.tsx`
- Modify: `packages/frontend/src/components/HistoryDrawer.tsx`

- [ ] **Step 1: Reescribir UpdateBanner.tsx**

```tsx
"use client";

import { Bell, X } from "lucide-react";
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
    <div className="flex items-center gap-2 px-4 py-2 bg-amber-900/30 border-b border-amber-600/50 text-amber-200 text-sm">
      <Bell size={14} className="flex-shrink-0 text-amber-400" />
      <span className="flex-1">{label}</span>
      <button
        onClick={handleDismiss}
        className="p-0.5 rounded text-amber-400 hover:text-amber-200 transition-colors"
        aria-label="Cerrar aviso"
      >
        <X size={14} />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Reescribir FavoritesDrawer.tsx**

```tsx
"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
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

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end transition-opacity duration-200 ${
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <div
        className={`relative w-80 max-w-full bg-surface h-full flex flex-col shadow-2xl transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-nk-border">
          <h2 className="text-primary font-semibold">Favoritos</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted hover:text-primary hover:bg-elevated transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {favs.length === 0 && (
            <p className="text-muted text-sm text-center py-8">
              Aún no tienes favoritos. Toca ★ en una respuesta para guardarla.
            </p>
          )}
          {favs.map((f) => (
            <div key={f.id} className="bg-elevated rounded-xl p-3 border border-nk-border/50">
              <p className="text-muted text-xs mb-1">
                {new Date(f.savedAt).toLocaleDateString("es", {
                  day: "numeric",
                  month: "short",
                })}
              </p>
              <p className="text-primary text-sm font-medium mb-2">{f.question}</p>
              <p className="text-muted text-xs line-clamp-2 mb-3">{f.answer}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { onReask(f.question); onClose(); }}
                  className="flex-1 text-xs bg-accent hover:bg-accent-h text-white rounded-lg py-1.5 transition-colors"
                >
                  Preguntar de nuevo
                </button>
                <button
                  onClick={() => handleRemove(f.id)}
                  className="text-xs text-red-400 hover:text-red-300 border border-red-800/50 rounded-lg px-2 transition-colors"
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

- [ ] **Step 3: Reescribir HistoryDrawer.tsx**

```tsx
"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
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

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end transition-opacity duration-200 ${
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <div
        className={`relative w-80 max-w-full bg-surface h-full flex flex-col shadow-2xl transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-nk-border">
          <h2 className="text-primary font-semibold">Historial</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted hover:text-primary hover:bg-elevated transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {history.length === 0 && (
            <p className="text-muted text-sm text-center py-8">
              No hay preguntas recientes.
            </p>
          )}
          {history.map((item, i) => (
            <button
              key={i}
              onClick={() => { onReask(item.question); onClose(); }}
              className="w-full text-left bg-elevated hover:bg-bg-input rounded-xl p-3 transition-colors border border-nk-border/50"
            >
              <p className="text-primary text-sm">{item.question}</p>
              <p className="text-muted text-xs mt-1">
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

> Nota: los drawers ahora no usan `if (!open) return null`. En su lugar, usan `opacity-0 pointer-events-none` + `translate-x-full` para la animación slide-in CSS. Esto requiere eliminar el `return null` en ambos componentes.

- [ ] **Step 4: Verificar build**

```bash
cd /home/cdvv/Documentos/Nalakalu_IA/nalakalu
npm run build -w @nalakalu/frontend
```

Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/components/UpdateBanner.tsx packages/frontend/src/components/FavoritesDrawer.tsx packages/frontend/src/components/HistoryDrawer.tsx
git commit -m "feat(frontend): UpdateBanner y Drawers con lucide icons, tokens y animación slide-in"
```

---

### Task 8: Verificación e2e

**Files:** ninguno — solo verificación

- [ ] **Step 1: Build completo del monorepo**

```bash
cd /home/cdvv/Documentos/Nalakalu_IA/nalakalu
npm run build --workspaces --if-present
```

Expected: todos los workspaces compilados sin errores.

- [ ] **Step 2: Iniciar dev server del frontend**

```bash
cd /home/cdvv/Documentos/Nalakalu_IA/nalakalu/packages/frontend
npm run dev
```

Expected: `ready on http://localhost:3000`

- [ ] **Step 3: Smoke test visual — checklist**

Abrir `http://localhost:3000` y enviar la pregunta: `¿Cuáles son los pasos del procedimiento de corte primario?`

Verificar:
- Sin checkboxes en blanco entre ítems
- Barra de progreso "0 / N pasos completados" visible
- Al marcar un ítem: texto tachado + fondo sutil
- Avatar "A" visible en la burbuja del asistente
- Loading dots animados mientras espera respuesta

- [ ] **Step 4: Smoke test visual — header y drawers**

Verificar:
- Iconos lucide en header (Clock, Star, Type) — sin emoji
- Al seleccionar un tag chip: chip indicador aparece en el header junto a "Nalakalu"
- Al tocar Clock: drawer historial se desliza desde la derecha con animación
- Al tocar Star: drawer favoritos se desliza desde la derecha con animación

- [ ] **Step 5: Smoke test visual — ChatInput**

Verificar:
- Textarea crece al escribir texto largo (> 2 líneas)
- Icono Send en botón enviar
- Border se ilumina en azul al hacer focus

- [ ] **Step 6: Commit final**

```bash
cd /home/cdvv/Documentos/Nalakalu_IA/nalakalu
git add -A
git commit -m "chore(frontend): verificación e2e completada — UX/UI rework Fase 1"
```

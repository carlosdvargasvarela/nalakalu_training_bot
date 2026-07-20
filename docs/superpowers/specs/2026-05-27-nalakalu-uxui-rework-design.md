# Nalakalu — UX/UI Rework (Fase 1)

**Fecha:** 2026-05-27
**Estado:** Aprobado — listo para implementación

---

## Objetivo

Rework visual y estructural del frontend de Nalakalu para todos los perfiles de usuario (operarios de planta, ventas, gerentes). UI moderna, minimalista, industrial dark, responsive (mobile + desktop), con sistema de tokens CSS que permita theming de marca en el futuro.

---

## Alcance

### Incluido
- Sistema de CSS custom properties (tokens de color/espacio) en `globals.css` + `tailwind.config.ts`
- Fix del bug de checkboxes en blanco en `StepChecklist`
- Rediseño del Header (lucide-react, indicador de tag activo)
- Mejoras visuales de `MessageBubble` (avatar, loading animado)
- Mejoras de `StepChecklist` (barra de progreso, mejor spacing)
- Mejoras de `TagChips` (fades en bordes, estilo de pills)
- Mejoras de `ChatInput` (auto-resize, icono Send, focus ring)
- Refinamiento de `UpdateBanner`, `FavoritesDrawer`, `HistoryDrawer`

### Excluido
- Cambios en lógica de negocio o API
- Nuevas funcionalidades
- Cambio de tema de empresa (se prepara la infraestructura, no se aplica aún)

---

## Token System

### `globals.css`

```css
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

### `tailwind.config.ts`

Extender `theme.colors` con referencias a los tokens:

```ts
colors: {
  app:      'var(--bg-app)',
  surface:  'var(--bg-surface)',
  elevated: 'var(--bg-elevated)',
  input:    'var(--bg-input)',
  border:   'var(--border)',
  accent:   'var(--accent)',
  'accent-hover': 'var(--accent-hover)',
  'user-bubble':  'var(--user-bubble)',
  primary:  'var(--text-primary)',
  muted:    'var(--text-muted)',
  disabled: 'var(--text-disabled)',
}
```

Para cambiar el tema de empresa: solo se sobreescriben las variables CSS en `:root`.

---

## Componentes

### StepChecklist — bug fix + mejoras

**Bug:** ReactMarkdown inyecta nodos `"\n"` entre `<li>` → checkboxes en blanco.

```tsx
// Fix: filtrar string vacíos
const items = (Array.isArray(children) ? children : [children])
  .filter(child => typeof child !== 'string' || child.trim() !== '');
```

**Mejoras visuales:**
- Checkbox 20×20px, `accent-color: var(--accent)`
- `gap-3` entre ítems
- Fondo del ítem marcado: `bg-elevated/40` + transición suave
- Barra de progreso: `"N / M pasos completados"` arriba del listado (texto `text-muted text-xs`)

**Fix en `MessageBubble.tsx`:**
```tsx
li: ({ children }) => <li>{children}</li>,
// StepChecklist maneja el wrapping del ol
```

### Header

**Dependencia nueva:** `lucide-react`

**Layout:**
```
[ Nalakalu ]  [ chip-tag-activo? ]     [ Clock ][ Star ][ Type ]
```

- Logo/nombre a la izquierda
- Chip de tag activo junto al nombre (visible sin scrollear): `"Ensamble ×"`
- Iconos: `Clock` (historial), `Star` (favoritos), `Type` (texto grande)
- Botones 32×32px, `rounded-lg`, hover `bg-elevated`
- En móvil: nombre se acorta o se oculta, botones permanecen

### MessageBubble

- Asistente: `bg-elevated border border-border/50 shadow-sm`
- Usuario: `bg-user-bubble` (sin cambio estructural)
- Avatar pequeño "A" (inicial) a la izquierda de la burbuja asistente — `w-7 h-7 rounded-full bg-accent flex items-center justify-center text-xs font-bold`
- Loading: tres puntos con `animate-bounce` escalonado (`delay-0`, `delay-150`, `delay-300`) en vez de texto

### TagChips

- Inactivo: `border border-border bg-transparent text-muted hover:bg-elevated`
- Activo: `bg-accent text-white border-accent`
- Fade-out en bordes: gradiente CSS en el contenedor para indicar scroll horizontal
- Si no hay tags: no renderiza (ya implementado)

### ChatInput

- Textarea: `bg-input border border-border focus:border-accent` con transición suave
- Auto-resize: `onInput` ajusta `scrollHeight` hasta `max-height: 6rem` (≈6 líneas)
- Botón enviar: icono `Send` de lucide-react, 44×44px (área de toque móvil correcta)

### UpdateBanner

- Fondo: `bg-amber-900/30 border border-amber-600/50`
- Icono `Bell` de lucide-react
- Sin cambios funcionales

### FavoritesDrawer / HistoryDrawer

- Fondo del panel: `bg-surface`
- Overlay: `bg-black/50 backdrop-blur-sm`
- Animación: slide-in desde la derecha con `transition-transform`
- Sin cambios funcionales

---

## Archivos afectados

| Archivo | Tipo de cambio |
|---------|---------------|
| `packages/frontend/src/app/globals.css` | Añadir CSS tokens |
| `packages/frontend/tailwind.config.ts` | Extender colors con tokens |
| `packages/frontend/src/components/StepChecklist.tsx` | Bug fix + mejoras |
| `packages/frontend/src/components/MessageBubble.tsx` | Avatar, loading, fix li |
| `packages/frontend/src/components/Chat.tsx` | Header rediseñado |
| `packages/frontend/src/components/ChatInput.tsx` | Auto-resize, icono Send |
| `packages/frontend/src/components/TagChips.tsx` | Estilo pills, fades |
| `packages/frontend/src/components/UpdateBanner.tsx` | Estilo refinado |
| `packages/frontend/src/components/FavoritesDrawer.tsx` | Estilo refinado |
| `packages/frontend/src/components/HistoryDrawer.tsx` | Estilo refinado |

**Dependencia nueva:** `lucide-react`

---

## Criterios de éxito

- Sin checkboxes en blanco en ningún procedimiento
- UI legible en móvil y desktop sin CSS custom
- Cambiar `--accent` en `:root` afecta todos los colores de acción coherentemente
- Botones con área de toque ≥ 44px en móvil

# Diseño — Fletes Tucumán

Sistema visual desde el sprint 5 ("hoja de ruta"). Los valores viven en `web/src/app/globals.css`
(tokens HSL) y `web/tailwind.config.ts`; este documento explica cómo usarlos.

## Idea

Una app de envíos seria. El **azul** es el sistema: marca, estructura, links, progreso y estado
actual. El **naranja** es la única señal de "andá": la acción principal de cada pantalla. El
**rojo** es solo peligro (cancelar, errores). Si algo naranja no es una acción, está mal.

## Color

| Rol | Token | Valor | Uso |
|---|---|---|---|
| Fondo | `background` | `#f8fafc` | Fondo de la app, blanco frío |
| Tarjeta | `card` | `#ffffff` | Tarjetas, formularios, diálogos |
| Texto | `foreground` | `#0f172a` | Texto principal |
| Texto secundario | `muted-foreground` | `#475569` | Descripciones, metadatos |
| Marca | `primary` | `#1d4ed8` | Links, progreso, paso actual, badges de info, foco |
| Marca suave | `primary-soft` | `#dbeafe` | Fondos destacados (no leído, hoy, fila elegida) |
| Encabezado | `secondary` | `#1e3a8a` | Encabezado, avatares, bloques de marca |
| Texto sobre azul marino | `secondary-muted` | `#c7d2fe` | Texto secundario sobre `secondary` |
| Acción | `accent` | `#c2410c` | Botón principal (`<Button>` por defecto), FAB, badge de notificaciones |
| Acción sobre oscuro | `accent-on-dark` | `#fb923c` | Solo texto/foco sobre `secondary`, nunca sobre blanco |
| Peligro | `destructive` | `#b91c1c` | Cancelar, eliminar, errores |
| Éxito | `success` | `#166534` | Etapas cumplidas, "Más barato" |
| Aviso | `warning` | `#854d0e` | Advertencias |
| Estrellas | `rating` | `#f59e0b` | Solo el relleno de las estrellas |
| Borde | `border` / `input` | `#e2e8f0` / `#7c8ba1` | Divisores / borde de campos (3:1 contra el fondo) |

Contraste verificado: todo texto ≥4.5:1, incluidos los badges tintados (color sobre el mismo color
al 10%) encima de `background`, `card` y `muted`. Por eso el naranja de acción es `#c2410c` y no
`#ea580c` (que da 3.6:1 con texto blanco). No hay modo oscuro; los tokens lo dejan preparado.

## Tipografía

- Títulos: **Archivo** 600–800 (`font-heading`), grotesca de cartelería de transporte.
- Texto: **Inter** (`font-sans`). Números de precios y tablas con `tabular-nums`.

## Botones

- Por defecto: naranja. **Una acción principal por pantalla.**
- `secondary`: azul, acciones con peso que no son la principal.
- `outline`: blanco con borde, alternativas ("Volver", "Ir al inicio").
- `accent`: el principal sobre el encabezado azul marino.
- `destructive`: rojo, siempre detrás de un `ConfirmDialog`.

## Gesto propio: la ruta punteada

`.ruta-punteada` (en `globals.css`) dibuja el trazo entre origen (punto azul) y destino (punto
naranja). Aparece en la vista previa de la portada, en "Cómo funciona", en el panel de login y en
las pantallas de error (`PantallaError`), donde la ruta se corta en el problema.

## Pantallas de error

- `app/not-found.tsx`: 404 global en español, con "Ir al inicio" y "Volver".
- `app/global-error.tsx`: si se rompe el layout raíz; trae su propio `<html>` y recarga la página.
- `error.tsx` por área (pública, login, comunes, cliente, fletero, admin): `ErrorSeccion`, con
  reintentar e ir al inicio del área. Muestran el código (`digest`), nunca el mensaje del error.

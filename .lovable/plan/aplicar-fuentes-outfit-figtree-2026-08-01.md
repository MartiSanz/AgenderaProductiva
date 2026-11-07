# Aplicar fuentes Outfit + Figtree

## Objetivo
Cambiar la tipografía de la app a la combinación **Outfit** (títulos) + **Figtree** (cuerpo), manteniendo la paleta de colores y la imagen del sidebar tal como están.

## Cambios
1. **Cargar fuentes desde Google Fonts** en `src/routes/__root.tsx` mediante `<link>` en el `head`:
   - `Figtree`: 400, 500, 600, 700
   - `Outfit`: 400, 500, 600, 700

2. **Registrar variables tipográficas** en `src/styles.css` dentro del bloque `@theme inline`:
   - `--font-sans: "Figtree", sans-serif;`
   - `--font-heading: "Outfit", sans-serif;`

3. **Aplicar fuentes base** en `@layer base`:
   - `body` usa `font-sans` (Figtree).
   - `h1, h2, h3` usan `font-heading` (Outfit), además del color heading existente.

## Alcance
Solo tipografía. No se modifican colores, componentes, layouts ni imágenes.

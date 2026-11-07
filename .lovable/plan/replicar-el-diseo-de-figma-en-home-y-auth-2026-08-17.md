# Replicar el diseño de Figma en Home y /auth

## Qué vas a subir
Un ZIP con el export de código de Figma (HTML/CSS). De ahí leo los valores exactos: colores, familias y pesos tipográficos, radios, bordes y sombras.

## Alcance
Solo el estilo visual de **la página de inicio (`/`)** y **la pantalla de ingreso (`/auth`)**.

Se copia:
- Paleta de colores
- Tipografías
- Estilo de componentes (botones, tarjetas, inputs: radios, bordes, sombras)

No se toca:
- La distribución/layout actual de esas pantallas
- Los textos y el contenido
- Ninguna funcionalidad (login con Google, redirecciones, navegación)
- El panel del profesional (agenda, pacientes, configuración, resumen) ni el portal de pacientes

## Cómo se implementa
1. Leer el ZIP y extraer los valores de diseño del CSS exportado.
2. Definir un conjunto de tokens con alcance acotado (por ejemplo `--landing-*`) en `src/styles.css`, convertidos a `oklch`, sin pisar los tokens globales que usa el resto de la app.
3. Cargar las fuentes del diseño con `<link>` en el `head` de `src/routes/__root.tsx`, conservando Outfit + Figtree para el resto de la app.
4. Aplicar esos tokens únicamente dentro de `src/routes/index.tsx` y `src/routes/auth.tsx` (contenedor con clase propia), ajustando clases de presentación de botones, tarjetas e inputs de esas dos pantallas.
5. Verificar en el preview que Home y /auth se ven como el diseño y que agenda, pacientes, resumen, configuración y portal quedan idénticos.

## Nota
Si algo del diseño no se puede reproducir sin mover la distribución, te lo señalo y mantengo el layout actual, tal como pediste.

# Ajustes del panel lateral e iconos

## Objetivo
Dejar el panel lateral liso con buen contraste, corregir la visibilidad del email del usuario y cambiar los iconos actuales por versiones más alegres y redondeadas.

## Cambios propuestos

### 1. Panel lateral liso
- Eliminar el degradado horizontal actual en `src/routes/_authenticated.tsx`.
- Aplicar un fondo liso `#58a65c` en todo el `aside`.

### 2. Email visible
- Cambiar el color del email del usuario de `text-[#58a65c]/90` a `text-white` para que contraste con el fondo verde.

### 3. Iconos más alegres
- Reemplazar los iconos de navegación del panel lateral por alternativas de Lucide con trazo más grueso, más redondeadas y/o con relleno parcial para dar sensación de amabilidad.
- Opciones a aplicar:
  - **Agenda:** `CalendarDays` → `CalendarHeart` (o `CalendarCheck2`) con trazo grueso.
  - **Pacientes:** `Users` → `UsersRound` con trazo grueso.
  - **Simulador:** `MessageCircle` → `MessageSquareMore` o `MessageSquareHeart` con trazo grueso.
  - **Configuración:** `Settings` → `Settings2` o `Cog` con trazo grueso.
  - **Salir:** `LogOut` → `LogOut` con trazo grueso.
- Aplicar `strokeWidth={2.5}` y `fill="currentColor"` en iconos que lo permitan para dar sensación filled.

### 4. Verificación de contraste
- Revisar que el logo, textos de navegación, email y botón "Salir" mantengan buen contraste sobre el verde liso.
- Ajustar sombras o fondos semitransparentes si fuera necesario.

## Alcance
Solo modifica el panel lateral (`src/routes/_authenticated.tsx`) y no toca otras pantallas ni la tipografía.

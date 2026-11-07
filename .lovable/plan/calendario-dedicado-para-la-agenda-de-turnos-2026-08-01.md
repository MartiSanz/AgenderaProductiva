# Calendario dedicado para la agenda de turnos

## Objetivo
Que los turnos no se mezclen con tu calendario personal: la app crea automáticamente un calendario propio en tu cuenta de Google (por ejemplo "Turnos — Martina Sanz") y escribe ahí todos los turnos. Vos lo ves en Google Calendar como un calendario más, que podés mostrar/ocultar o compartir.

## Cómo funciona para el usuario
1. En **Configuración → Google Calendar**, después de conectar, aparece el estado: "Calendario de turnos: no creado".
2. Botón **"Crear calendario de turnos"**: la app crea el calendario en tu cuenta con nombre configurable y tu zona horaria, y guarda su ID.
3. Desde ese momento, cada turno reservado por WhatsApp se crea en ese calendario; reprogramar lo actualiza y cancelar lo elimina.
4. Aparece solo en Google Calendar (web y móvil) bajo "Mis calendarios" — no hay que agregarlo a mano.
5. Si ya existe un calendario con ese nombre, se reutiliza en vez de duplicarlo.
6. Se puede desvincular (deja de usarse, no se borra en Google) o renombrar.

## Disponibilidad
Los horarios ocupados se seguirán calculando con **tu calendario personal (primary) + el calendario de turnos**, para que no te agenden un turno encima de un compromiso personal. (Si preferís que solo mire el calendario de turnos, se cambia con una opción.)

## Detalles técnicos
- **Scope**: hace falta ampliar de `calendar.events` a `https://www.googleapis.com/auth/calendar` (permite `calendars.insert` y `calendarList`). Requiere reconectar Google una vez desde Configuración.
- **Migración de base**: agregar a `professional_config`:
  - `google_calendar_id text not null default ''`
  - `google_calendar_name text not null default 'Turnos'`
- **`src/lib/api/calendar.functions.ts`**:
  - `ensureTurnosCalendar`: busca en `GET /calendar/v3/users/me/calendarList` por nombre; si no está, `POST /calendar/v3/calendars` con `{ summary, timeZone }`; guarda el ID en `professional_config`.
  - `getTurnosCalendarStatus`: devuelve conectado + id/nombre del calendario.
  - Reemplazar el `primary` hardcodeado en `createCalendarEvent`, `updateCalendarEvent` y `deleteCalendarEvent` por el ID guardado; si no hay ID, crearlo al vuelo.
  - `listGoogleCalendarEvents` / `getCalendarBusyRanges`: consultar `primary` y el calendario de turnos y unir resultados.
- **`src/routes/_authenticated/configuracion.tsx`** (`GoogleCalendarCard`): estado del calendario, input de nombre, botón crear/reutilizar y mensajes de error reales del API.

## Fuera de alcance
Compartir el calendario con terceros y colores personalizados por estado de turno.

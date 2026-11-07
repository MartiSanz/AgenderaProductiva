# Sincronización bidireccional con Google Calendar

## Qué vas a poder hacer
En **Configuración → Google Calendar** vas a elegir el modo de sincronización:

- **Solo desde la app** (por defecto): Google Calendar es un espejo. Si borrás o movés un evento del calendario "Turnos" a mano, la próxima sincronización lo restaura tal como está en la app. Nada se pierde por un borrado accidental.
- **Desde ambas plataformas**: lo que hagas en Google Calendar manda. Si borrás un evento, se cancela el turno en la app; si lo movés de horario, el turno se actualiza (si el nuevo horario está libre y dentro de tus horarios de atención; si no, se revierte y queda avisado).

Además:
- La sincronización corre **automática cada 10 minutos** (valor elegible: 5, 10, 15, 30 o 60 minutos).
- Botón **"Sincronizar ahora"** en Configuración y en la Agenda, con la fecha/hora de la última sincronización y un resumen ("2 eventos restaurados", "1 turno cancelado desde Google").
- Solo se toca el calendario dedicado de turnos. Tu calendario personal nunca se modifica: se sigue leyendo únicamente para bloquear disponibilidad.

## Qué se sincroniza
Ventana: desde hoy hasta 60 días hacia adelante (los turnos pasados no se tocan).

| Cambio hecho en Google | Solo desde la app | Desde ambas plataformas |
|---|---|---|
| Evento borrado | Se vuelve a crear | Se cancela/borra el turno en la app |
| Evento movido de horario | Se restaura el horario original | Se actualiza el turno (si el horario es válido) |
| Turno sin evento en Google | Se crea el evento | Se crea el evento |
| Evento nuevo creado a mano en el calendario de turnos | Se deja como está y bloquea la disponibilidad (no se convierte en turno: no hay paciente asociado) | Igual |

## Detalles técnicos
- **Migración**: en `professional_config` agregar `calendar_sync_mode text not null default 'app_only'` (valores `app_only` \| `two_way`), `calendar_sync_interval_minutes smallint not null default 10`, `calendar_last_sync_at timestamptz`, `calendar_last_sync_summary jsonb not null default '{}'`. En `appointments`, índice sobre `calendar_event_id`.
- **`src/lib/api/calendarSync.server.ts`** (nuevo): `syncOwnerCalendar(ownerId)` — carga la clave de conexión cifrada del profesional, lista los eventos del calendario de turnos en la ventana, los cruza contra `appointments` activos por `calendar_event_id` y aplica la tabla de arriba. Reutiliza los helpers de `calendar.functions.ts` (extraídos a un módulo server-only compartido para poder llamarlos sin sesión de usuario).
- **`src/lib/api/calendar.functions.ts`**: nuevas server fns `syncCalendarNow` (manual, con `requireSupabaseAuth`) y `getCalendarSyncStatus`.
- **`src/routes/api/public/hooks/calendar-sync.ts`** (nuevo): endpoint POST autenticado con la clave pública del backend; recorre con el cliente de servicio los profesionales con conexión activa cuyo intervalo ya venció y llama a `syncOwnerCalendar`.
- **pg_cron**: job cada 5 minutos que golpea ese endpoint; cada profesional se procesa según su propio intervalo.
- **Validación en modo bidireccional**: un evento movido se acepta solo si cae en día laborable, dentro de la franja horaria configurada y sin choque con otro turno; si no, se revierte en Google y se registra el motivo en el resumen.
- **UI**: `GoogleCalendarCard` en `src/routes/_authenticated/configuracion.tsx` suma el selector de modo, el intervalo, "Sincronizar ahora" y el estado; la Agenda muestra un botón de sincronizar e invalida las queries al terminar.

## Fuera de alcance
- Webhooks push de Google (sincronización instantánea) — se puede agregar después sobre esta misma base.
- Crear pacientes automáticamente a partir de eventos creados a mano en Google.

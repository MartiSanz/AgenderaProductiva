# Bloqueos desde Google Calendar y licencias en el calendario

## Qué cambia

**1. Texto del modo bidireccional (Configuración → Google Calendar)**

El texto actual dice que al borrar un evento se cancela el turno y al moverlo se reprograma. Se reemplaza por:

> "Si agregás un evento en Google Calendar, se toma como bloqueo de agenda; si borrás el evento de un turno, el turno se cancela; si lo movés, el turno se reprograma, siempre que el nuevo horario sea válido."

(Tu redacción decía "se crea un turno", pero según definiste después los turnos se cargan únicamente desde la app: los eventos creados a mano son bloqueos. El texto queda alineado con ese criterio.)

**2. Eventos creados a mano en Google = bloqueo de agenda**

Los turnos se crean solo desde la app. Cualquier evento del calendario "Turnos" que no corresponda a un turno de la app se respeta tal cual: ocupa el horario, no se borra, no se convierte en turno y, mientras exista, ese horario deja de ofrecerse en WhatsApp y en la app. Eso ya funciona para la disponibilidad; lo que se agrega es que la sincronización nunca los toque ni los cuente como conflicto, y que aparezcan en la agenda como franja "Bloqueado en Google Calendar" para que no parezcan un hueco libre.

Si el bloqueo cae en un día no laborable o fuera de horario, no hay problema: esos horarios ya no se ofrecen, el bloqueo simplemente convive.

**3. Vacaciones y licencias publicadas en el calendario**

Cada período de licencia cargado en Configuración se publica en el calendario "Turnos" como evento de día completo ("Licencia: motivo"). Al borrarlo en la app, el evento se elimina. Los días no laborables recurrentes (ej. domingos) no se publican, para no llenar el calendario de eventos repetidos.

Estos eventos los administra la app: la sincronización los restaura si se borran a mano en Google.

## Detalles técnicos

- **Migración**: en `time_off`, agregar `calendar_event_id text not null default ''`.
- **`src/lib/api/schedule.functions.ts`**: `addTimeOff` crea el evento all-day en el calendario de turnos y guarda el id; `deleteTimeOff` lo borra en Google antes de eliminar la fila. Un error de Google no bloquea la operación local (se reconcilia en la próxima sincronización).
- **`src/server/googleCalendar.server.ts`**: helper `insertAllDayEvent` (usa `start.date`/`end.date`) y una propiedad extendida privada `lovable_kind: "time_off" | "appointment"` para distinguir los eventos gestionados por la app.
- **`src/server/calendarSync.server.ts`**:
  - Los eventos que no están asociados a un turno y no tienen `lovable_kind` se ignoran por completo en ambos modos (son bloqueos manuales).
  - Nueva pasada de licencias: reconcilia `time_off` contra los eventos `lovable_kind = "time_off"` de la ventana (crea faltantes, restaura borrados, elimina huérfanos) en ambos modos.
  - El resumen suma contadores de licencias creadas/restauradas.
- **`src/routes/_authenticated/configuracion.tsx`**: nuevo texto del modo bidireccional.
- **`src/routes/_authenticated/agenda.tsx`**: la vista muestra los bloqueos externos del calendario como franja gris, tomados del mismo fetch de disponibilidad que ya consulta Google.

## Fuera de alcance
- Convertir eventos manuales en turnos con paciente.
- Publicar los días no laborables recurrentes como eventos.
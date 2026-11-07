# Link de confirmación en el recordatorio de WhatsApp

Cada recordatorio va a incluir un botón "Confirmar turno" con un link único. Al abrirlo, el turno queda confirmado automáticamente y el paciente ve una página simple con los datos. Si no lo abre, el turno queda "Pendiente de confirmación" y así se ve en la agenda.

## Cómo obtiene WhatsApp esa URL

Meta no permite mandar links arbitrarios en una plantilla, pero sí un **botón de URL dinámica**: en la plantilla se define una base fija y la app envía solo el tramo final por cada recordatorio.

1. En Meta, la plantilla `recordatorio_turno` suma un botón de tipo **URL dinámica** con la base:
   `https://<tu-dominio>/c/{{1}}`
2. Al enviar el recordatorio, la app genera un **código único e irrepetible** para ese turno (no adivinable) y lo manda como parámetro del botón.
3. El paciente toca "Confirmar turno" → abre `https://<tu-dominio>/c/<código>` → el turno se marca confirmado.

El cuerpo del mensaje (las 6 variables actuales: especialidad, nombre, día, mes, hora, dirección) no cambia.

## Qué ve el paciente

Página simple, sin login, con el resultado:
- **Turno confirmado**: "¡Listo! Tu turno quedó confirmado", con profesional, día, hora y dirección.
- Ya estaba confirmado: mismo mensaje, sin duplicar la confirmación.
- Link vencido / turno cancelado o inexistente: mensaje claro de que el turno ya no está disponible.

El código se invalida cuando el turno pasa, se cancela o se reprograma (al reprogramar se genera uno nuevo con el próximo recordatorio).

## Qué cambia en la agenda

Los turnos futuros que ya recibieron el recordatorio y no fueron confirmados muestran la etiqueta **"Pendiente de confirmación"**; los confirmados muestran **"Confirmado"**. Los turnos a los que todavía no se les mandó recordatorio no muestran etiqueta. La marca aparece en la vista de lista, en el panel de próximos turnos y en el detalle del turno.

## Pasos que tenés que hacer una vez en Meta

Editar la plantilla de recordatorio y agregarle el botón "Confirmar turno" de tipo URL dinámica con la base indicada arriba (la app te va a mostrar la URL exacta para copiar en la tarjeta de WhatsApp de Configuración), y esperar su aprobación.

## Alcance técnico

### Base de datos
- Migración: `appointments.confirm_token text unique` + `confirm_token_expires_at timestamptz`. Sin cambios de RLS (el token se resuelve solo del lado del servidor con el cliente admin).

### Envío del recordatorio
- `src/routes/api/public/hooks/whatsapp-reminders.ts`: antes de enviar, genera el token (`crypto.randomUUID()` compacto / 22 chars base64url), lo guarda en el turno junto con `reminder_sent_at`, y lo pasa a `sendTemplate`.
- `src/server/whatsapp.server.ts`: `sendTemplate(account, to, bodyParams, urlButtonParam?)` agrega el componente
  `{ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: token }] }`
  cuando se pasa el parámetro. Si la plantilla todavía no tiene el botón, Meta devuelve error y queda visible en `last_error` de la cuenta, igual que hoy.

### Página de confirmación
- Nueva ruta pública `src/routes/c.$token.tsx` (URL `/c/<token>`), fuera de `_authenticated`, con `robots: noindex`.
- Loader llama a un server fn público `confirmAppointmentByToken` en `src/lib/api/confirm.functions.ts`, que delega en `src/server/confirm.server.ts`: busca el turno por token con el cliente admin, valida estado `active`, no vencido y no expirado, setea `confirmed_at` si falta y devuelve solo datos no sensibles (nombre del profesional, especialidad, fecha/hora formateada en la zona horaria del profesional, dirección). Nunca devuelve datos del paciente ni IDs internos.
- Rate limit simple por token (un token = un turno) y respuesta genérica ante token inválido para no filtrar existencia.

### UI de agenda
- `src/routes/_authenticated/agenda.tsx`, `src/components/agenda/UpcomingPanel.tsx` y el detalle del turno: badge derivado de `confirmed_at` + `reminder_sent_at` usando los tokens de color ya existentes (verde = confirmado, ámbar = pendiente).
- Los datos ya se consultan en `appointments.functions.ts`; solo hay que incluir `confirmed_at`/`reminder_sent_at` en el select si faltan.

### Configuración
- En la tarjeta de WhatsApp de `/configuracion`, agregar la URL base del botón (`https://<dominio>/c/{{1}}`) con botón de copiar y una línea en la guía de pasos de Meta.

## Orden de trabajo

1. Migración del token en `appointments`.
2. Generación del token + parámetro del botón en el envío del recordatorio.
3. Ruta pública `/c/$token` con confirmación automática.
4. Etiquetas Pendiente/Confirmado en la agenda.
5. URL base + instrucciones en la tarjeta de WhatsApp.

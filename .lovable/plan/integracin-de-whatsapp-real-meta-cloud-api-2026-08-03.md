# Integración de WhatsApp real (Meta Cloud API)

Conectar el chatbot que hoy funciona en `/simulador` a WhatsApp de verdad, usando la API oficial de Meta, con un número propio por cada profesional y recordatorios automáticos de turno.

## Qué va a poder hacer el profesional

1. En **Configuración → WhatsApp** ve una tarjeta nueva donde carga los datos de su número de WhatsApp Business (los obtiene desde el panel de Meta): ID del número, ID de la cuenta de WhatsApp Business y su token de acceso.
2. La app le muestra la **URL del webhook** y un **token de verificación** para pegar en Meta, y un botón "Probar conexión" que envía un mensaje de prueba a su propio número.
3. Una vez conectado, cualquier paciente que le escriba a ese número conversa con el mismo menú que hoy se ve en el simulador: reservar, ver mis turnos, cancelar, reprogramar, cómo llegar.
4. El día anterior al turno, a la hora que ya está configurada (9 o 17 hs), el paciente recibe un recordatorio automático por WhatsApp y puede confirmar o cancelar respondiendo.

El simulador se mantiene tal cual para probar sin gastar mensajes.

## Lo que necesita hacer el profesional en Meta (una sola vez)

Es un requisito de Meta, no de la app: crear una app en Meta for Developers, agregar el producto WhatsApp, verificar el negocio, asociar un número (que no esté en uso en WhatsApp normal) y aprobar una plantilla de mensaje para los recordatorios. La app le va a mostrar estos pasos en pantalla con los valores que tiene que copiar.

## Alcance técnico

### Base de datos
- Nueva tabla `whatsapp_accounts` (una fila por profesional): `owner_id`, `phone_number_id`, `waba_id`, `access_token_ciphertext`, `verify_token`, `display_phone`, `status`, `last_error`, timestamps. RLS por `owner_id` + GRANTs; el token se guarda cifrado reutilizando `src/server/connectionKeyCrypto.ts`, y la columna cifrada nunca se devuelve al navegador.
- Nueva tabla `whatsapp_sessions`: estado de la conversación por `owner_id` + teléfono (`step`, `context jsonb`, `history jsonb`, `expires_at`), para que el bot recuerde en qué paso está cada paciente entre mensajes.
- `appointments`: columnas `reminder_sent_at` y `confirmed_at` para no repetir recordatorios.

### Motor de conversación compartido
- Extraer la lógica del chat que hoy vive dentro de `src/routes/_authenticated/simulador.tsx` a un módulo puro `src/lib/domain/botEngine.ts`: recibe (estado actual, texto entrante, datos del profesional) y devuelve (respuestas, nuevo estado, acciones a ejecutar).
- El simulador y el webhook de WhatsApp usan el mismo motor, así ambos flujos nunca se desincronizan.
- Las acciones (reservar, cancelar, reprogramar, buscar disponibilidad, whitelist) se resuelven en `src/server/botActions.server.ts` reutilizando la lógica ya existente de `appointments.functions.ts`, `patients.functions.ts` y `availability.ts`.

### Webhook e envío
- `src/routes/api/public/hooks/whatsapp.ts`:
  - `GET` → verificación del webhook de Meta (`hub.challenge`) validando el `verify_token` contra la tabla.
  - `POST` → valida la firma `X-Hub-Signature-256` (HMAC SHA-256 sobre el body crudo, comparación timing-safe), descarta duplicados por `message id`, resuelve el profesional por `phone_number_id`, corre el motor y responde.
- `src/server/whatsapp.server.ts`: cliente de la Graph API (`/v22.0/{phone_number_id}/messages`) para mensajes de texto, botones interactivos y plantillas; marca mensajes como leídos y registra todo en `sim_messages` para que quede historial visible.

### Recordatorios
- `src/routes/api/public/hooks/whatsapp-reminders.ts`: recorre los profesionales con WhatsApp activo, busca turnos del día siguiente sin recordatorio enviado y manda la plantilla aprobada.
- Cron con `pg_cron` + `pg_net` cada hora; cada profesional se procesa solo cuando la hora local coincide con su `reminder_hour` y su zona horaria.
- La respuesta del paciente ("Confirmar" / "Cancelar") entra por el webhook normal y actualiza el turno.

### UI
- Nueva tarjeta "WhatsApp" en `/configuracion` con el mismo estilo de sección (color de acento, `SectionButton`): formulario de credenciales, estado de conexión, URL + token de verificación para copiar, botón de prueba y botón desconectar.
- Guía de pasos de Meta colapsable dentro de la misma tarjeta.

### Seguridad
- El token de acceso solo se lee en el servidor; nunca viaja al navegador.
- Validación de firma obligatoria antes de procesar cualquier mensaje.
- El webhook responde 200 rápido y procesa después, para evitar reintentos de Meta.
- Validación con Zod de todo el payload entrante.

## Orden de trabajo

1. Migración de base de datos (tablas + columnas + cron).
2. Extracción del motor de conversación y refactor del simulador para usarlo.
3. Cliente de la Graph API + guardado cifrado de credenciales.
4. Webhook de entrada con verificación de firma.
5. Tarjeta de configuración en la UI.
6. Recordatorios automáticos + plantilla.

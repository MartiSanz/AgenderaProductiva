# Que el estado de WhatsApp refleje la realidad

## Qué pasa hoy

Al guardar las credenciales, la app marca la cuenta como "Conectado" sin preguntarle nada a Meta: simplemente guarda los datos y pone ese estado. Por eso ves "conectado" aunque el número todavía no esté registrado en la Cloud API, y recién al enviar la prueba aparece el error 133010.

## Qué cambia

1. Al guardar (o actualizar) la conexión, la app consulta a Meta el estado real del número antes de decidir el estado:
   - Credenciales inválidas o número inexistente -> estado "Error" con el motivo en pantalla.
   - Número existente pero sin registrar en la Cloud API -> estado "Pendiente de registro", con el texto que explica el paso "Registrar" con el PIN de verificación en dos pasos.
   - Número registrado -> estado "Conectado".
2. La tarjeta de WhatsApp en Configuración muestra esos tres estados con color e indicación clara, y un botón "Revisar estado" para volver a consultar sin reescribir el token.
3. El botón "Enviar prueba" queda deshabilitado mientras el estado no sea "Conectado", con la aclaración de por qué.
4. Si la prueba falla, además del toast actual el estado guardado pasa a "Pendiente de registro" o "Error" según el código de Meta, así la tarjeta no vuelve a mentir.

## Detalle técnico

- Nuevo helper en `src/server/whatsapp.server.ts`: `checkAccountStatus(account)` que hace `GET {GRAPH_BASE}/{phone_number_id}?fields=id,display_phone_number,verified_name,platform_type,status,throughput` y traduce la respuesta/errores a `connected | needs_registration | error` + mensaje.
- `saveAccount` deja de fijar `status: "connected"`; lo determina `checkAccountStatus` tras guardar. Se reutiliza el estado del campo `status` y `last_error` ya existentes en `whatsapp_accounts` (no hace falta migración).
- Nueva server fn `refreshWhatsappStatus` en `src/lib/api/whatsapp.functions.ts` (autenticada) que corre la verificación y devuelve `{ status, message }`.
- `sendWhatsappTest`: al mapear el error 133010 también persiste `status: "needs_registration"`.
- La `WhatsappCard` en `src/routes/_authenticated/configuracion.tsx` pasa a renderizar el estado con los tres casos, agrega el botón "Revisar estado" e inhabilita "Enviar prueba" fuera de "Conectado".

## Nota

Este cambio no registra el número por vos: el paso "Registrar" con el PIN sigue siendo obligatorio en Meta. Lo que se gana es que la app te diga la verdad desde el principio y te indique exactamente qué falta.

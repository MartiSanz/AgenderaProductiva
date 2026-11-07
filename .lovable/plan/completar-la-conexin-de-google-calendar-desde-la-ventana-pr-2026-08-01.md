# Completar la conexión de Google Calendar desde la ventana principal

## Qué está pasando

El popup de Google vuelve correctamente con el código, pero la ventana emergente no encuentra tu sesión iniciada. Dentro del editor la app corre en un marco embebido, y el navegador guarda la sesión de ese marco en un compartimento separado del que usa una ventana nueva. Por eso el popup se ve "deslogueado" y falla con "La sesión no está disponible en esta ventana".

La ventana principal (Configuración) sí tiene la sesión. La solución es que el popup no llame al servidor: que solo devuelva el código a la ventana que lo abrió, y que esa ventana guarde la conexión.

## Cambios

1. `src/routes/oauth/google-calendar/return.tsx`
   - Quitar la espera de sesión y la llamada a `completeGoogleCalendarConnect`.
   - Leer `success`, `code` y `error` de la URL y enviarlos al opener por `postMessage` (mismo origen, `connectorId: "google_calendar"`), luego cerrar.
   - Si no hay opener (caso raro: el popup quedó como pestaña suelta), mostrar un mensaje pidiendo volver a la app y reintentar.

2. `src/routes/_authenticated/configuracion.tsx`
   - `waitForOAuthCompletion` pasa a resolver con el `code` recibido.
   - Tras recibirlo, la ventana principal llama a `completeGoogleCalendarConnect({ data: { code } })`, muestra el toast y refresca el estado de conexión.
   - Errores del intercambio se muestran con su mensaje real.

## Notas técnicas

- El `code` es de un solo uso y de vida corta; se intercambia inmediatamente en la ventana principal, que ya tiene el bearer token adjunto por el middleware de cliente.
- Ninguna credencial (`lovack_*`) llega al navegador: el intercambio y el guardado cifrado siguen ocurriendo en el servidor.
- No se toca la lógica del servidor (`calendar.functions.ts`) ni el almacenamiento cifrado.

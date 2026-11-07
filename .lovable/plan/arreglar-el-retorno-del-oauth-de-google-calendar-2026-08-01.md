# Arreglar el retorno del OAuth de Google Calendar

## Qué pasa

Google autoriza correctamente y te devuelve a la app, pero el popup termina en
`https://localhost:8080/...` y el navegador muestra `ERR_CONNECTION_REFUSED`.

El motivo: la URL de retorno se arma en el servidor a partir de la URL de la
petición interna (`request.url`), que en el entorno de vista previa llega como
`https://localhost:8080`. Ese host solo responde por `http` dentro del sandbox y
no existe en tu máquina, así que el navegador no puede abrirlo. El código de
OAuth llega bien (se ve en la URL), pero nunca se ejecuta la pantalla que lo
canjea y lo guarda.

## Solución

Que la URL de retorno la determine el navegador (el origen real donde estás
viendo la app) en lugar del servidor.

1. En Configuración, al presionar "Conectar Google Calendar", enviar
   `window.location.origin` junto con el pedido de inicio de conexión.
2. En el servidor, validar ese origen y usarlo para construir
   `/oauth/google-calendar/return`. Si no llega o no es válido, caer al
   comportamiento actual basado en la petición.
3. Con eso el popup vuelve al mismo origen de la vista previa (o del sitio
   publicado), la pantalla de retorno canjea el código y guarda la conexión.

## Detalle técnico

- `src/lib/api/calendar.functions.ts`: `startGoogleCalendarConnect` pasa a
  aceptar `{ origin }` validado (solo `http`/`https`, mismo host que la petición
  o `localhost`), y arma `returnUrl` desde ahí.
- `src/routes/_authenticated/configuracion.tsx`: `connect()` llama
  `start({ data: { origin: window.location.origin } })`.
- No hay cambios de base de datos ni de configuración en Google Cloud: la URI
  registrada allí sigue siendo la del gateway de Lovable.

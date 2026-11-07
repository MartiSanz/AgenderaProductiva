## Diagnóstico (confirmado)

El `authError` de la URL decodifica exactamente esto:

```text
redirect_uri_mismatch
redirect_uri: https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback
client_id: 1086523512335-oqhh5icltadjo57k6lno6nv2n1u3k5n6.apps.googleusercontent.com
```

No es un problema de código de la app: el cliente OAuth de Google con ese `client_id` no tiene registrada esa URI de redireccionamiento. El conector `google_calendar` está correctamente creado y vinculado al proyecto (con acceso offline habilitado), así que el flujo de la app está bien.

Causas típicas cuando "ya la cargué":
1. La URL se pegó en **Orígenes autorizados de JavaScript** en lugar de **URIs de redireccionamiento autorizados** (son dos campos distintos).
2. Se cargó en **otro cliente OAuth** (o en otro proyecto de Google Cloud) distinto al del `client_id` de arriba.
3. Hay una diferencia exacta de texto: barra final, `http` en vez de `https`, o un espacio invisible al pegar.
4. Se guardó pero Google todavía no propagó el cambio (puede tardar unos minutos).

## Pasos a seguir (en Google Cloud Console)

1. Abrir https://console.cloud.google.com/apis/credentials y ubicar el cliente cuyo ID sea **1086523512335-oqhh5icltadjo57k6lno6nv2n1u3k5n6.apps.googleusercontent.com**. Confirmar que es de tipo **Aplicación web**.
2. En ese cliente, en la sección **URIs de redireccionamiento autorizados** (no "Orígenes de JavaScript"), verificar que exista exactamente:

```text
https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback
```

   Sin barra final, sin espacios, en `https`.
3. Guardar y esperar 2–5 minutos.
4. Verificar en la pantalla de consentimiento OAuth que estén habilitados los scopes:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `https://www.googleapis.com/auth/calendar.events`
5. Confirmar que la **API de Google Calendar** esté habilitada en ese mismo proyecto de Cloud (APIs y servicios → Biblioteca → Google Calendar API).
6. Reintentar "Conectar Google Calendar" desde Configuración, preferentemente con las protecciones de Brave (escudo) bajas para ese sitio.

## Si el cliente no coincide

Si el `client_id` de la consola no es ese, significa que el cliente del conector guardado en el workspace usa otras credenciales. En ese caso vuelvo a abrir el flujo de conexión del conector para que cargues el Client ID/Secret correctos.

## Del lado del código

No hay cambios necesarios. Como mejora opcional puedo hacer que, cuando el popup se cierre con error, la app muestre el motivo real devuelto por Google en lugar del mensaje genérico "La ventana se cerró antes de completar la conexión", para facilitar diagnósticos futuros.

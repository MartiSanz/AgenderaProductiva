# Conectar Google Search Console

## Objetivo
Vincular y verificar `https://agendera.lovable.app/` en Google Search Console para habilitar sitemap, monitoreo de indexación y diagnósticos SEO.

## Pasos

1. **Conectar el connector**
   - Llamar `standard_connectors--connect` con `connector_id: "google_search_console"`.
   - Esperar que el usuario autorice la conexión con su cuenta de Google.

2. **Verificar la propiedad (flujo META)**
   - Solicitar token de verificación para `https://agendera.lovable.app/` (tipo `SITE`, método `META`).
   - Insertar la meta tag en el `<head>` de `src/routes/__root.tsx`.
   - Verificar que la tag esté en el HTML desplegado de la raíz publicada.
   - Llamar a la API de verificación.

3. **Agregar el sitio a Search Console**
   - Llamar `PUT /webmasters/v3/sites/{https://agendera.lovable.app/}`.
   - Listar propiedades para confirmar que aparece.

4. **Enviar sitemap**
   - Enviar `https://agendera.lovable.app/sitemap.xml`.

5. **Marcar el hallazgo resuelto**
   - Actualizar el finding `gsc:gsc` a `fixed` vía `seo_chat--update_findings`.

## Notas
- No se cambiará a verificación DNS ni a otros métodos; se usa META por defecto.
- Si la tag no está viva tras publicar, se pedirá al usuario publicar antes de continuar.
- No se añadirán ni quitarán rutas privadas del sitemap ni robots.txt en este plan.

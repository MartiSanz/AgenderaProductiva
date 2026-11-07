# Publicar Agendera en URL gratuita de Lovable

## Objetivo
Publicar la aplicación en `https://agendera.lovable.app` usando la URL gratuita de Lovable, para que el webhook de WhatsApp sea accesible públicamente por Meta.

## Pasos

1. Verificar seguridad del proyecto
   - Revisar resultados del escaneo de seguridad actual.
   - Si hay hallazgos críticos sin resolver, informar antes de publicar.

2. Publicar la aplicación
   - Usar la opción de publicación con slug `agendera`.
   - Confirmar que la URL pública queda activa: `https://agendera.lovable.app`.

3. Actualizar configuración del webhook de WhatsApp
   - Reemplazar la URL del webhook en la configuración de Meta por la URL pública:
     `https://agendera.lovable.app/api/public/hooks/whatsapp`
   - Verificar que el endpoint de verificación responde correctamente a los parámetros de Meta.

4. Validación final
   - Probar que el sitio publicado carga correctamente.
   - Confirmar que el webhook de WhatsApp está accesible desde internet.

## Notas
- Publicar no impide seguir editando: los cambios de UI se actualizan desde el diálogo de Publish, y los cambios de backend se despliegan automáticamente.
- Después de publicar se puede agregar un dominio propio si se decide más adelante.

Actualizar las descripciones de los planes en la Home

Objetivo: alinear la descripción del Plan Base y Plan Pro en `src/routes/index.tsx` con lo que realmente incluye cada plan según el modelo de entitlements actual.

Estado verificado

- `src/lib/entitlements.ts` define los planes:
  - `basic`: sin funciones adicionales (`PLAN_FEATURES[basic] = []`).
  - `pro`: `whatsapp_bot`, `patient_self_booking`, `public_directory`.
- Las funciones habilitadas para cada plan se muestran en `FEATURE_LABELS`:
  - `Vinculación con WhatsApp`, `Reserva autónoma del paciente`, `Aparecer en el portal de pacientes`.
- `src/routes/_authenticated/configuracion.tsx` muestra que la vinculación de WhatsApp está bloqueada para planes no Pro.
- La integración con Google Calendar **no está limitada por plan** en el código actual: cualquier usuario puede conectar y sincronizar su calendario.
- El portal público (directorio de profesionales) fue ocultado a pedido previo; solo queda activo el link personal de cada profesional (`/portal?pro=<id>`).

Cambios propuestos

1. Actualizar la tarjeta del Plan Base en `src/routes/index.tsx`:
   - Descripción principal: enfatizar que incluye la agenda digital, gestión de pacientes, recordatorios automáticos y sincronización con Google Calendar (porque hoy no está restringida a Pro).
   - Actualizar `BASE_FEATURES` para reflejar estas funciones: agenda digital ilimitada, gestión de pacientes, recordatorios automáticos por WhatsApp, panel de configuración simple y sincronización con Google Calendar.

2. Actualizar la tarjeta del Plan Pro en `src/routes/index.tsx`:
   - Descripción principal: enfatizar que agrega al Base el bot de WhatsApp con autogestión de turnos (reserva, cancelación y reprogramación por el paciente).
   - No afirmar que Google Calendar es exclusivo de Pro.
   - Actualizar `PRO_FEATURES` para destacar: todo lo del Plan Base, bot de WhatsApp para autogestión, reserva/cancelación/reprogramación por el paciente.
   - Dejar fuera de la copia pública el feature `public_directory` porque el portal público sigue oculto.

3. Ajustar las respuestas del FAQ (`FAQS` en el mismo archivo) que mencionan Google Calendar como exclusivo de Pro, para que coincidan con la nueva descripción.

4. Opcional / decisión del usuario: si Google Calendar debe seguir siendo solo de Pro, se necesitará un paso aparte para agregar el control de plan en el backend. Si no, el plan propuesto lo mueve a la descripción del Base.

Archivos a modificar

- `src/routes/index.tsx` (tarjetas de planes, listas de features y FAQ).

Criterio de aceptación

- La Home describe el Plan Base con todas las funciones que hoy están disponibles para ese plan.
- La Home describe el Plan Pro con las funciones que realmente agrega (WhatsApp bot y autogestión del paciente).
- No hay afirmaciones incorrectas sobre funciones exclusivas de Pro que en realidad están disponibles en Base.
- Las preguntas frecuentes quedan consistentes con las nuevas descripciones.

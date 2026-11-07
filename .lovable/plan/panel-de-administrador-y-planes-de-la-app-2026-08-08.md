# Panel de administrador y planes de la app

## Qué vas a poder hacer

Un panel nuevo en `/admin`, visible solo para tu cuenta, donde vas a ver todos los profesionales registrados y controlar qué funciones tiene cada uno.

### Planes

- **Básico**: agenda, pacientes, configuración y recordatorio diario. Sin bot de WhatsApp ni reserva autónoma del paciente.
- **Pro**: todo lo anterior + bot de WhatsApp para que los pacientes gestionen sus turnos.

Además de asignar un plan, vas a poder activar funciones sueltas como excepción (por ejemplo, darle WhatsApp a alguien que está en Básico, para una prueba).

### Por cada usuario vas a ver y editar

- Email, fecha de alta y nombre del profesional
- Plan actual y funciones extra activadas
- Fecha de vencimiento del plan (solo informativa: se marca como vencido y te avisa en el panel, pero el plan nunca cambia solo; el cambio lo hacés vos)
- Estado de pago: pagado / pendiente / vencido, con fecha del último pago y nota opcional
- Suspender o reactivar la cuenta (sin borrarla)
- Métricas: cantidad de pacientes, turnos activos, turnos del mes, último ingreso

### Qué ve el usuario según su plan

- El simulador queda visible en todos los planes, para que puedan probar el bot y ver qué ganan al sumarlo.
- Si no tiene WhatsApp habilitado: se oculta solo la tarjeta de vinculación con WhatsApp en Configuración (y el modo de acceso a reservas queda fijo en la carga manual del profesional). El bot real no responde mensajes entrantes.
- Si la cuenta está suspendida: al entrar ve una pantalla que le avisa que su acceso está pausado, con contacto. No puede usar la agenda.

## Detalle técnico

### Base de datos (una migración)

- `app_role` enum (`admin`, `user`) + tabla `user_roles` con función `has_role()` security definer. Tu email se marca como admin en la misma migración.
- Tabla `account_plans`: `user_id`, `plan` (`basic` | `pro`), `expires_at`, `status` (`active` | `suspended`), `payment_status` (`paid` | `pending` | `overdue`), `last_payment_at`, `notes`, timestamps.
  - Políticas: cada usuario lee solo su fila; los admin leen y editan todas (vía `has_role`).
  - Trigger `handle_new_user` extendido para crear la fila con plan `basic` al registrarse.
- Tabla `plan_feature_overrides`: `user_id`, `feature` (texto: `whatsapp_bot`, `patient_self_booking`, …), `enabled`. Solo admin escribe.
- Vista/consulta de métricas por usuario resuelta desde el servidor con cliente admin (no expone datos entre usuarios).

### Servidor

- `src/lib/api/admin.functions.ts`: `listAccounts`, `updateAccountPlan`, `setFeatureOverride`, `setAccountStatus`, `setPaymentStatus`. Todas con `requireSupabaseAuth` + verificación de rol admin contra `has_role` antes de cargar el cliente privilegiado dentro del handler.
- `src/lib/api/entitlements.functions.ts`: `getMyEntitlements` devuelve `{ plan, features, status, expiresAt, expired }`. El vencimiento nunca degrada el plan: solo marca `expired` para mostrarlo en el panel de admin.
- Refuerzo en servidor: las funciones de vinculación de WhatsApp (`saveWhatsappAccount`, `sendWhatsappTest`) y el webhook público validan que el dueño tenga `whatsapp_bot` habilitado antes de operar. Las funciones del simulador (`simulatorStart`, `simulatorSend`, `simulatorReset`) quedan disponibles para todos los planes.

### Cliente

- Hook `useEntitlements()` con TanStack Query, consumido en `_authenticated.tsx` para filtrar el menú lateral y mostrar la pantalla de cuenta suspendida.
- Nueva ruta `src/routes/_authenticated/admin.tsx`, con gate por rol admin; en el menú aparece solo para vos.
- `configuracion.tsx`: la tarjeta de vinculación con WhatsApp y el modo de acceso a reservas se renderizan solo con la función habilitada, reutilizando los tokens y estilos actuales. El menú lateral conserva Simulador siempre.

### Fuera de alcance

No se integra cobro automático: el estado de pago lo cargás vos manualmente en el panel.

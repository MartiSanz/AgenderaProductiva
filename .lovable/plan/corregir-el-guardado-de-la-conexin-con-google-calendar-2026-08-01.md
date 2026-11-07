# Corregir el guardado de la conexión con Google Calendar

## Diagnóstico (verificado)

La autorización con Google sí funcionó: el navegador volvió a `/oauth/google-calendar/return?success=true&code=...`. Lo que falla es el paso siguiente, guardar la credencial.

Consulté la base de datos y encontré dos hechos:

1. La tabla `app_user_connections` está **vacía**: no se guardó ninguna conexión.
2. Esa tabla **no tiene ningún permiso otorgado** (ni siquiera para el rol interno del servidor). Sin esos permisos, cualquier escritura desde el servidor es rechazada con un error de permisos, aunque el resto del flujo esté bien.

Esto explica exactamente el mensaje "No se pudo guardar la conexión".

## Qué se va a hacer

1. **Migración de base de datos**: otorgar a `service_role` los permisos sobre `public.app_user_connections` (la tabla mantiene RLS activo y sigue siendo inaccesible desde el navegador; solo el servidor puede leerla/escribirla).
2. **Mostrar el error real**: hoy la pantalla de retorno del OAuth captura la excepción y muestra un texto genérico. Se va a propagar el mensaje real del servidor al aviso de la app, para que un fallo futuro se diagnostique en un intento y no a ciegas.
3. **Reintento**: volver a "Conectar Google Calendar" desde Configuración y verificar que la conexión quede guardada y que el estado pase a "conectado".

## Detalles técnicos

- Migración:
  ```sql
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_user_connections TO service_role;
  ```
  (sin permisos para `anon` ni `authenticated`: la fila cifrada nunca debe ser legible desde el cliente).
- `src/routes/oauth/google-calendar/return.tsx`: en el `.catch`, usar `error.message` en el `postMessage` en vez del texto fijo "No se pudo guardar la conexión".
- No se toca la lógica de cifrado ni el flujo OAuth: ambos quedaron confirmados como correctos.

## Verificación

Tras la migración y el reintento, se comprueba que exista una fila en `app_user_connections` para el usuario y que la Configuración muestre la cuenta conectada.

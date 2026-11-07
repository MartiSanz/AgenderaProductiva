# Un solo número de WhatsApp para todas las cuentas

## Qué cambia
- Habrá un único número de WhatsApp, configurado solo por la administradora en Configuración → Integraciones.
- Todos los recordatorios de todas las cuentas salen desde ese número. La plantilla actual ya muestra los datos de cada profesional.
- El número solo envía mensajes: si un paciente escribe o responde, no se contesta. Igual se registran los avisos de entregado, leído y fallido.
- Los profesionales ya no ven nada de WhatsApp en Configuración.
- El plan de cada cuenta sigue decidiendo quién recibe recordatorios, con las mismas excepciones de Administración.
- En Administración, la conexión deja de mostrarse cuenta por cuenta: aparece un único estado general.

## Detalles técnicos
- Fuente única: los envíos (recordatorio diario, recordatorio manual y aviso de acceso aprobado) usan la conexión guardada por la cuenta administradora, no la del profesional. Se agrega un helper `getSharedAccount()` en whatsapp.server.ts.
- Las funciones del servidor para guardar, desconectar, refrescar y probar la conexión exigen rol de administrador en el servidor.
- Webhook: identifica la cuenta compartida, verifica la firma, aplica los estados de entrega y descarta los mensajes entrantes (se quita el bot para todas las cuentas).
- Recordatorio diario: recorre todas las cuentas con la función habilitada y envía con la cuenta compartida.
- configuracion.tsx: la tarjeta de WhatsApp se muestra solo a la administradora (sin cambios para ella).
- AccountsDashboard/adminAccounts: se quita la conexión de WhatsApp por cuenta; se agrega un estado global que solo marca "funcionando" cuando hubo un envío exitoso en las últimas 24 h.
- No se borran datos: si hay conexiones viejas de profesionales, quedan guardadas pero sin uso. No hace falta cambiar la base de datos.
- Pruebas: elegir la cuenta compartida y la regla de plan.

## Pendiente de verificar
- Confirmar que la conexión guardada hoy es la de la cuenta administradora y no la de otro profesional.

# Orden alfabético en todos los listados de personas y nombres

## Qué cambia
Todo listado que muestre personas, cuentas o nombres se ordenará de la A a la Z (sin distinguir mayúsculas ni acentos: "Álvarez" va con la A).

- **Administración → Cobranzas**: lista de cuentas (Todas / Vencida / Vence pronto) por nombre del profesional.
- **Administración → Cuentas y planes**: seguimiento de cuentas, recordatorios de WhatsApp enviados por profesional e historial de gastos agrupado por profesional.
- **Administración → Solicitudes de acceso**: por nombre.
- **Administración → Finanzas**: cuentas por cobrar e ingresos por profesional (y luego por período).
- **Clientes (pacientes)**: listado y buscador por apellido y nombre.
- **Configuración**: tipos de turno y sedes por nombre.
- **Nuevo turno / portal**: selector de paciente, tipo de turno, sede y especialidades por nombre.
- **Resumen**: rankings de ausencias, reprogramaciones y asistencias siguen ordenados por cantidad (es un ranking); en empates, por nombre.

## Qué NO cambia (orden por fecha u hora, porque es lo lógico)
Agenda y próximos turnos, horarios disponibles, días de la semana, jornadas, historiales de eventos y pagos, packs por vencimiento.

## Detalle técnico
- Helper único `compareByName(a, b)` en `src/lib/sort.ts` usando `Intl.Collator("es", { sensitivity: "base", numeric: true })`, con test.
- Aplicarlo en el cliente sobre las listas ya cargadas (BillingPanel, AccountsDashboard, AccessRequestsPanel, FinancePanel, pacientes.tsx, configuracion.tsx, agenda.tsx/portal) y en las consultas de pacientes con `order("last_name").order("first_name")` para que la paginación de 30 respete el orden.
- Los filtros de estado en Cobranzas siguen funcionando; solo cambia el orden dentro de cada filtro.

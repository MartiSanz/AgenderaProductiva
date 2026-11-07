# Nueva vista semanal en grilla + panel "Próximos turnos"

## Qué se agrega

1. **Tercera opción de vista** en el selector de la agenda: `Semana` (lista actual, sin cambios) · `Grilla` (nueva) · `Mes` (sin cambios).
2. **Vista semanal en grilla**: columnas de lunes a domingo (se muestran todos los días, incluidos los no laborables), filas cada 30 minutos, y cada turno como bloque de color según el día, con la paleta ya usada en la agenda.
   - El rango horario se ajusta a los turnos de la semana: desde el más temprano hasta el más tardío. Si la semana no tiene turnos, se muestra un rango mínimo con mensaje de semana vacía.
   - Cada bloque muestra paciente y motivo, y al hacer clic abre el mismo detalle/acciones que ya existen (reprogramar, notas, asistencia, WhatsApp, llamar, cancelar).
3. **Panel lateral "Próximos turnos"**: visible en las tres vistas, listando los turnos del rango visible desde el momento actual en adelante, ordenados cronológicamente, con hora, día abreviado, paciente y motivo. En pantallas chicas se ubica debajo de la agenda.

## Qué no cambia

- La vista de lista semanal actual y la vista de mes se conservan intactas.
- Botones de cabecera, ausencias, nuevo turno y resync siguen igual.
- No se toca la lógica de datos, disponibilidad, ni la sincronización con el calendario.

## Detalles técnicos

- `src/routes/_authenticated/agenda.tsx`: el estado de vista pasa de `"week" | "month"` a `"week" | "grid" | "month"`.
- Nuevo componente `WeekGrid`: recibe los días visibles y los turnos ya cargados; calcula el rango horario mín/máx redondeado a la media hora y posiciona cada turno por índice de fila de 30 minutos.
- Nuevo componente `UpcomingPanel`: deriva de los mismos turnos ya en memoria (sin consultas nuevas), filtrando los que empiezan de ahora en adelante dentro del rango visible.
- Layout: grilla de 2 columnas en `lg` (agenda + panel ~320px), una sola columna en móvil.
- Colores desde los tokens existentes `--day-1..--day-6`; sin colores hardcodeados.
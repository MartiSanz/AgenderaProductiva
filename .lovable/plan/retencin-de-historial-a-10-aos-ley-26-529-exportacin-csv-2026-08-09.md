# Retención de historial a 10 años (Ley 26.529) + exportación CSV

Hoy la base borra sola: `purge_old_appointments()` elimina turnos con más de 7 días y pacientes sin turnos. Eso se reemplaza por un ciclo de retención de **10 años**, alineado con la Ley 26.529 (art. 18: conservación de la historia clínica por 10 años), con aviso al profesional y descarga previa del historial.

## Cómo funciona

1. **Nada se borra automáticamente.** El borrado siempre requiere confirmación del profesional.
2. **Aviso a los 10 años.** Cuando existen turnos con más de 10 años, aparece un aviso en Agenda y en Resumen del mes: "Hay X turnos con más de 10 años. Cumplido el plazo legal de conservación (Ley 26.529, art. 18), podés descargarlos y depurarlos." El aviso se puede posponer 30 días y no bloquea el uso de la app.
3. **Descarga previa.** Desde el aviso, botón "Descargar historial" que baja los turnos a depurar en CSV.
4. **Confirmación.** "Depurar historial" se habilita después de descargar (o de tildar "ya tengo la copia"), pide confirmación y muestra cuántos turnos se eliminan.
5. **Qué se borra:** turnos con más de 10 años, **excepto el último turno de cada paciente**. **Los pacientes nunca se borran.**

## Exportación CSV (disponible siempre, no solo al depurar)

En Configuración, sección "Mis datos", dos botones de descarga inmediata:

- **Pacientes.csv** — apellido, nombre, DNI, teléfono, email, fecha de nacimiento, habilitado, notas, fecha de alta.
- **Turnos.csv** — fecha, hora inicio, hora fin, duración, paciente, DNI, teléfono, estado, asistencia, notas.

Con filtro opcional de rango de fechas para los turnos (por defecto: todo). Codificación UTF-8 con BOM y separador `;` para que abra bien en Excel en español.

## Archivado en vez de borrado seco

- **Resumen histórico por paciente:** antes de eliminar, se guarda en el paciente un resumen compacto (cantidad de turnos, primera y última visita, asistencias y ausencias). Se pierde el detalle pero se conserva la trazabilidad y las estadísticas, ocupando casi nada.
- **Registro de depuración:** cada limpieza queda anotada (fecha, cantidad depurada, rango de fechas cubierto) para poder demostrar qué y cuándo se depuró.
- **Plazo configurable:** 10 años por defecto, editable en Configuración (5, 10, 15 o 20 años).

## Detalles técnicos

- Migración: quitar el cron/uso de `purge_old_appointments()` a 7 días; agregar a `professional_config` `retention_years` (default 10) y `purge_reminder_snoozed_until`; agregar a `patients` `history_summary` (jsonb); crear tabla `purge_log` (owner_id, ejecutado_en, turnos_eliminados, rango) con GRANT + RLS por dueño.
- Server fns nuevas en `src/lib/api/retention.functions.ts`: `getRetentionStatus`, `exportPatientsCsvData`, `exportAppointmentsCsvData`, `purgeOldHistory` (borra vencidos conservando el último por paciente, actualiza `history_summary`, escribe `purge_log`).
- Generación del CSV en el cliente (escape de comillas, BOM UTF-8) y descarga vía `Blob`; nombres `pacientes-AAAA-MM-DD.csv` y `turnos-AAAA-MM-DD.csv`.
- UI: componente `RetentionNotice` montado en `src/routes/_authenticated/agenda.tsx` y `resumen.tsx`; sección "Mis datos" y selector de plazo en `src/routes/_authenticated/configuracion.tsx`.

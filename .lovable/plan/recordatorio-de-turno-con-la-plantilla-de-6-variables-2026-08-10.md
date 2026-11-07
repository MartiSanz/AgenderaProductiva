# Recordatorio de turno con la plantilla de 6 variables

Adaptar el envío automático del recordatorio para que coincida exactamente con la plantilla aprobada en Meta y para que los botones "Confirmar" / "Cancelar" hagan efecto en la agenda.

## Mensaje final que recibe el paciente

```text
¡Hola!👋

Este es un recordatorio de tu próximo turno con Programadora Martina Sanz.

🗓️ El Martes 12 de Agosto a las 9:00 hs.

📍 Dirección: Av. Fortabat 161.

Por favor, confirma o cancela tu turno.

¡Gracias!😊
```

## Cómo se completan las variables

| Variable | Contenido | Origen |
|---|---|---|
| {{1}} | Especialidad ("Programadora") | Configuración del profesional |
| {{2}} | Nombre del profesional ("Martina Sanz") | Nombre para mostrar extraído de los datos del profesional |
| {{3}} | Día ("Martes 12") | Fecha del turno |
| {{4}} | Mes ("Agosto") | Fecha del turno |
| {{5}} | Hora ("9:00") | Hora del turno |
| {{6}} | Dirección ("Av. Fortabat 161") | Configuración (o lugar de atención del turno si tiene uno asignado) |

Día y mes se envían con la primera letra en mayúscula, como en la plantilla.

## Botones Confirmar / Cancelar

**Plan Básico**

- **Confirmar**: el turno queda marcado como confirmado. El bot no responde nada.
- **Cancelar**: el turno se cancela (se libera el horario y se borra del calendario, igual que hoy). El bot no responde nada.

**Plan Pro**

- **Confirmar**: el turno queda marcado como confirmado. El bot no responde nada.
- **Cancelar**: el turno se cancela y el bot pregunta si quiere reprogramar. Si responde que sí, muestra los próximos turnos disponibles con el mismo flujo de "Reprogramar turno" del menú principal (elegir día, elegir horario, confirmación) y repite ese flujo hasta que reserve o salga. Si responde que no, la conversación termina ahí.

La diferencia entre planes se resuelve con el permiso `patient_self_booking` (incluido en Pro): sin ese permiso no se ofrece reprogramar.

- Si la respuesta llega y ya no hay un turno próximo pendiente, el bot no hace nada.

## Alcance técnico

- `src/routes/api/public/hooks/whatsapp-reminders.ts`: cargar también `professional_config` (especialidad, nombre, dirección, zona horaria) y el lugar del turno; armar el array de 6 parámetros en el orden de la tabla. Se cachea la config por profesional igual que la cuenta de WhatsApp.
- `src/lib/domain/availability.ts`: helpers `formatDayNumber` ("Martes 12"), `formatMonthName` ("Agosto") y hora sin cero inicial ("9:00"), respetando la zona horaria del profesional.
- `src/server/whatsapp.server.ts`: `sendTemplate` ya mapea los parámetros por orden; se agrega el registro del `appointment_id` en la sesión/`sim_messages` para poder asociar la respuesta del botón al turno correcto.
- `src/routes/api/public/hooks/whatsapp.ts` + `src/lib/domain/botEngine.ts`: interpretar la respuesta de botón (`button`/`interactive` reply con texto "Confirmar" / "Cancelar") sobre el turno pendiente y ejecutar confirmar o cancelar reutilizando las acciones existentes en `src/server/botActions.server.ts`.
- Si la plantilla en Meta tiene distinta cantidad de variables, el envío falla y el error queda visible en el estado de la cuenta de WhatsApp, como ya ocurre hoy.

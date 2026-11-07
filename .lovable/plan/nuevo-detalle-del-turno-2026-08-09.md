# Nuevo detalle del turno

Rediseñar el diálogo "Detalle del turno" con la organización de la imagen: avatar con iniciales, nombre y edad, y una lista de datos con etiqueta a la izquierda y valor a la derecha.

## Qué va a mostrar

- Avatar circular con las iniciales del paciente
- Nombre y apellido
- Edad ("67 años")
- HORA (ej. 8:00 hs)
- DÍA (ej. Lun 3 ago)
- DURACIÓN (ej. 60 min, calculada entre inicio y fin del turno)
- TELÉFONO
- ÚLTIMA VISITA (turno anterior más reciente del paciente; si no hay, "Primera visita")
- NOTAS: texto libre opcional que el profesional puede agregar o editar desde el mismo detalle

No se incluyen "tipo" ni diagnóstico. Debajo se mantienen el estado y los botones "Cancelar turno" y "Reprogramar".

## Qué hay que agregar

Único dato nuevo: **fecha de nacimiento del paciente**, para calcular la edad automáticamente.

- Se agrega el campo (opcional) al alta y edición de pacientes en /pacientes.
- Si el paciente no la tiene cargada, la línea de edad no se muestra.
- En el registro por WhatsApp no se pide (sigue siendo nombre, apellido, DNI y teléfono).

## Detalles técnicos

1. Migración: `ALTER TABLE public.patients ADD COLUMN birth_date date` (nullable).
2. `src/lib/api/patients.functions.ts`: incluir `birth_date` en los esquemas de alta/edición y en los selects.
3. `src/lib/api/appointments.functions.ts`: incluir `birth_date` en el join del paciente y agregar una función que devuelva la última visita (turno pasado más reciente del paciente).
4. `src/routes/_authenticated/agenda.tsx`: rehacer el contenido del diálogo de detalle con avatar de iniciales, encabezado y filas etiqueta/valor usando los tokens de color del sistema.
5. `/pacientes`: agregar el input de fecha de nacimiento en el formulario modal.
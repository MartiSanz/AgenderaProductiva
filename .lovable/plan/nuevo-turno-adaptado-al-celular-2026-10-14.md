# Nuevo turno adaptado al celular

## Objetivo
Reorganizar «Nuevo turno» para que resulte compacto y cómodo en el celular, sin contenido cortado y conservando todas las funciones actuales.

## Cambios
1. **Ventana adaptada a la pantalla:** ajustar ancho, altura y espacios para celulares; permitir desplazamiento vertical cuando haga falta, sin desbordamiento horizontal. Mantener visibles y accesibles el título, el cierre y los botones de cada paso.
2. **Pasos compactos:** distribuir «Paciente», «Horario» y «Confirmar» dentro del ancho disponible, sin superposición ni etiquetas recortadas. Ordenar campos en una sola columna en el celular.
3. **Tipo de turno desplegable:** en el celular, sustituir los botones por un menú con los tipos existentes y «Otro». Conservar la duración personalizada y la selección actual. En escritorio, mantener los botones.
4. **Fecha compacta:** acomodar mes y año al ancho disponible y contener la tira de días para que únicamente esa fila pueda deslizarse horizontalmente.
5. **Horarios simplificados:** en el celular, mostrar los primeros **tres horarios disponibles**, ordenados por hora, como listado de una columna. Si hay más, agregar «Ver más horarios» con la cantidad restante; al desplegar, mostrar todos y permitir «Ver menos». Si hay tres o menos, no mostrar ese control.
6. **Selección consistente:** volver al listado compacto al cambiar el día, el tipo o la duración, o al abrir un nuevo turno. Si se elige un horario del listado ampliado y luego se contrae, mantenerlo seleccionado y visible, sin añadir otros horarios no seleccionados.
7. **Conservar lo existente:** búsqueda de pacientes, datos, notas, horario manual, advertencias fuera de agenda y confirmación. No cambiar disponibilidad, reservas, recordatorios ni Google Calendar. Mantener el diseño actual de escritorio y de «Ausencias».

## Detalles técnicos
- Acotar los ajustes a «Nuevo turno», con una clase específica: `.np-dialog` también se utiliza en «Ausencias» y no debe alterarla.
- Usar los controles y estilos existentes, con tamaños y columnas que no dependan del ancho mínimo del contenido.
- Reutilizar `daySlots`, sin nuevas consultas ni cambios al cálculo de disponibilidad; añadir únicamente el estado de expansión para el listado móvil.
- Incorporar pruebas pequeñas para el límite de tres opciones, expansión, reinicio y conservación de la selección.

## Verificación
- Revisar los tres pasos en anchos de 320, 375 y 393 px, incluyendo una pantalla de 393 × 596 px y el teclado abierto.
- Probar selección de paciente, tipo, fecha, expansión de horarios y revisión del turno; confirmar que ningún campo o botón queda fuera del ancho de la pantalla.
- Verificar que escritorio y «Ausencias» conservan su presentación actual y que no aparecen errores.
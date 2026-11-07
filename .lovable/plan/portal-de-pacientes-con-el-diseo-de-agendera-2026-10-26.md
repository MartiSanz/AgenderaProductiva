# Portal de pacientes con el diseño de Agendera

## Objetivo
Que `/portal` (buscador de profesionales y reserva de turnos) se vea igual que el inicio, el ingreso y el panel: misma paleta crema/naranja/café, Bricolage Grotesque en títulos, DM Sans en texto, mismos botones, tarjetas, campos y estilo del logo.

## Qué cambia (solo visual)
1. **Barra superior** como la del panel: logo Agendera + "Agendera / Portal de pacientes", con "Ir al inicio" e "Ingresar como profesional" como botones suaves.
2. **Tarjeta principal** con el mismo estilo de tarjeta del sitio (fondo superficie, borde suave, radio y sombra cálida), título en Bricolage.
3. **Listas** (profesionales, tipos de turno, opciones del menú, turnos activos) como filas del estilo de "Próximos turnos": fondo claro, borde, hover naranja suave, avatar con iniciales en durazno.
4. **Elección de día y horario** con el mismo aspecto que "Nuevo turno": tira de días con el día activo naranja y horarios como botones contorneados; en celular los primeros tres horarios y "Ver más" igual que en Nuevo turno.
5. **Campos y botones** (nombre, apellido, teléfono, email, Confirmar, Volver) con los estilos ya unificados de formularios.
6. **Pantalla de confirmación** con resumen en bloque claro (profesional, tipo, fecha, hora, lugar) como el resumen de Nuevo turno.
7. Responsive revisado en 375 px y desktop.

## Qué NO cambia
- Pasos, textos, validaciones, reglas de reserva, identidad del paciente, link Pro, cancelación y reprogramación.

## Detalles técnicos
- Envolver el portal en `.app-shell` (tokens de `landing.css`) y reemplazar clases utilitarias sueltas (`bg-muted/60`, `rounded-3xl`, etc.) por clases `portal-*` nuevas en `src/styles/landing.css`.
- Reutilizar `MobileSlotList` para horarios en móvil; sin cambios en `portal.functions.ts`.
- Verificación con Playwright en el link del profesional a 375 y 1280 px.

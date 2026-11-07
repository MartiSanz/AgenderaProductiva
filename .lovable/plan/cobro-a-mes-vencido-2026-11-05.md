# Cobro a mes vencido

## Qué está mal hoy
El sistema le cobra a cada profesional el mes en curso (Kashiwa, aceptada el 5/11, ya ve "Abono 2026-11 · vence el 10/11"). La regla acordada es **a mes vencido**: lo usado en noviembre se paga del 1 al 10 de diciembre.

## Regla nueva
- En un mes cualquiera se debe solamente lo de **meses anteriores ya terminados**, nunca el mes en curso.
- El importe de cada mes = abono del plan + los packs comprados en ese mes que sigan impagos.
- Ese importe vence el día 10 del mes siguiente. Del 1 al 10 figura como "pendiente"; desde el 11, "vencido".
- El primer mes se cobra completo aunque la cuenta haya entrado a mitad de mes (sin prorrateo).
- Una cuenta aceptada este mes no debe nada hasta el mes que viene.

Ejemplos (hoy 5/11):
- Kashiwa (aceptada 5/11): saldo $0, sin aviso. El 1/12 verá "Noviembre: $24.900 + packs · vence el 10/12".
- Francisco (desde agosto, sin pagos): debe octubre (pendiente, vence 10/11) y meses previos sin pagar (vencidos, aviso rojo). Noviembre ya no aparece.

## Dónde se aplica (mismo criterio en todo el sistema)
1. **Mis pagos** del profesional: lista "Noviembre 2026 · vence el 10/12/2026", con abono y packs del mes.
2. **Aviso en el panel**: naranja del 5 al 10 si debe el mes anterior; rojo si tiene algo vencido.
3. **Cobranzas (Administración)**: al elegir un mes, se ve quién pagó ese mes ya usado; vence el 10 del mes siguiente.
4. **WhatsApp del día 9**: recuerda el pago del mes anterior.

## Detalle técnico
- `src/lib/billing.ts`: `unpaidPlanPeriods` devuelve períodos desde `since` hasta el mes anterior (excluye el actual), con estado según vencimiento `deadline(period) = día 10 de period+1`; `deadlineLabel` pasa a apuntar al mes siguiente. Tests nuevos: cuenta del mes actual = sin deuda; mes anterior día 5 = pending; día 11 = overdue; meses más viejos = overdue.
- `messageCredits.server.ts`: agrupar packs pendientes por mes de compra y sumarlos al período correspondiente; los packs del mes en curso no se cobran todavía.
- `PaymentDebtBanner` y `MessagesTabs`: usar los períodos ya calculados (mes en curso nunca suma).
- `billing.server.ts` (Cobranzas y cron): el cron del día 9 evalúa `previousPeriod(today)`; el estado en Cobranzas compara contra el día 10 del mes siguiente al período elegido.
- Actualizar la memoria de reglas de cobro con "primer mes completo, sin prorrateo" si confirmás.

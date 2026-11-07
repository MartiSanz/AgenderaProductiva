/**
 * Normaliza un teléfono argentino al formato internacional +549XXXXXXXXXX.
 * Acepta formatos comunes: 11 5555-4444, 011 15-5555-4444, 15-5555-4444,
 * 54911..., +54 9 11..., etc. Si el número ya viene en internacional, se respeta.
 */
export function normalizeArPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  // Número internacional de otro país: se respeta tal cual.
  if (raw.trim().startsWith("+") && !digits.startsWith("54")) return `+${digits}`;
  // Quitar prefijo de país y el 9 móvil si ya vienen.
  if (digits.startsWith("54")) digits = digits.slice(2);
  if (digits.startsWith("9")) digits = digits.slice(1);
  // Quitar el 0 de discado nacional.
  while (digits.startsWith("0")) digits = digits.slice(1);
  // Quitar el 15 de discado móvil local cuando sobra longitud
  // (el número nacional son 10 dígitos: área de 2-4 + número).
  // El 15 puede venir al inicio ("15-5555-4444") o tras el código
  // de área ("11 15-5555-4444", "2281 15-50-6344").
  if (digits.length > 10) {
    if (digits.startsWith("15")) {
      digits = digits.slice(2);
    } else {
      const idx = digits.indexOf("15");
      if (idx >= 2 && idx <= 4) digits = digits.slice(0, idx) + digits.slice(idx + 2);
    }
  }
  return `+549${digits}`;
}

/** Cupo mensual de recordatorios incluido en el plan; no acumulable, se reinicia cada mes (hora Argentina). */
export const MONTHLY_REMINDERS = 180;

export type PackLite = { remaining: number; expires_at: string; cancelled_at: string | null };

export function activePacks<T extends PackLite>(packs: T[], now = new Date()): T[] {
  return packs.filter((p) => !p.cancelled_at && p.remaining > 0 && new Date(p.expires_at) > now);
}

export function availableMessages(sentThisMonth: number, packs: PackLite[], now = new Date()) {
  const monthlyLeft = Math.max(0, MONTHLY_REMINDERS - sentThisMonth);
  const packsLeft = activePacks(packs, now).reduce((s, p) => s + p.remaining, 0);
  return { monthlyLeft, packsLeft, total: monthlyLeft + packsLeft };
}

export function daysUntil(iso: string, now = new Date()) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now.getTime()) / 86400000));
}

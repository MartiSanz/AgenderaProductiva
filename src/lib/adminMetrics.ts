const TZ = "America/Argentina/Buenos_Aires";

/** "YYYY-MM" of an instant in Buenos Aires time. */
export function monthKeyAR(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" })
    .format(date)
    .slice(0, 7);
}

/** An account paid this month when its last payment date (YYYY-MM-DD) falls in the current month. */
export function paidThisMonth(lastPaymentAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!lastPaymentAt) return false;
  return lastPaymentAt.slice(0, 7) === monthKeyAR(now);
}

/** Whole days since the given instant, or null when never. */
export function daysSince(value: string | null | undefined, now: Date = new Date()): number | null {
  if (!value) return null;
  return Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / 86_400_000));
}

export type SetupChecks = {
  personalData: boolean;
  schedule: boolean;
  location: boolean;
  appointmentTypes: boolean;
  calendar: boolean;
};

export const SETUP_LABELS: Record<keyof SetupChecks, string> = {
  personalData: "Datos personales",
  schedule: "Horarios semanales",
  location: "Lugar de atención",
  appointmentTypes: "Tipos de turno",
  calendar: "Google Calendar",
};

/** Setup counts as complete only when every required onboarding step is done. */
export function setupComplete(c: SetupChecks): boolean {
  // Google Calendar is optional and never blocks completion.
  return c.personalData && c.schedule && c.location && c.appointmentTypes;
}

/** Account state: suspended wins; otherwise approved (or admin) is active; else pending approval. */
export function accountState(input: { suspended: boolean; approved: boolean; isAdmin: boolean }) {
  if (input.suspended) return "suspended" as const;
  if (input.approved || input.isAdmin) return "active" as const;
  return "pending" as const;
}

/**
 * Inactive: setup complete and neither a sign-in nor a created appointment in the last 30 days.
 * Accounts still configuring are never counted as inactive.
 */
export function isInactive(input: {
  setupDone: boolean;
  lastSignInAt: string | null;
  lastCreatedAt: string | null;
  now?: Date;
}): boolean {
  if (!input.setupDone) return false;
  const now = input.now ?? new Date();
  const last = [input.lastSignInAt, input.lastCreatedAt]
    .filter(Boolean)
    .map((v) => new Date(v as string).getTime());
  if (last.length === 0) return true;
  return now.getTime() - Math.max(...last) > 30 * 86_400_000;
}

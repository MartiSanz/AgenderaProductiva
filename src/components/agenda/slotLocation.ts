/**
 * Resolves which care location (lugar de atención) a chosen appointment time
 * belongs to, using the professional's weekly schedule bands and locations.
 */

import { isDated } from "@/lib/domain/dateBlocks";

export type Place = { name: string; address: string };

export type LocationLike = { id: string; name: string; address?: string | null };

export type BandLike = {
  day_of_week?: number | null;
  start_time: string;
  end_time: string;
  location_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  dated_dow?: number | null;
};

export type PlaceForSlotOptions = {
  /** Appointment start as an ISO string ("" when nothing was picked yet). */
  startIso: string;
  /** Turn duration in minutes, used to know where the appointment ends. */
  durationMinutes: number;
  /** weekly_schedule rows of the professional. */
  schedule: BandLike[];
  /** locations rows of the professional. */
  locations: LocationLike[];
  /** IANA timezone of the professional (e.g. America/Argentina/Buenos_Aires). */
  timezone?: string | null;
  /** professional_config.address, used only when no location can be resolved. */
  fallbackAddress?: string | null;
  /** Calendar day picked in the booking panel, as "YYYY-MM-DD". */
  dayKey?: string;
};

function toMinutes(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hm ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Wall-clock minutes of day (0-1439) for an instant, in the given timezone. */
export function minutesOfDay(date: Date, timezone?: string | null): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    ...(timezone ? { timeZone: timezone } : {}),
  }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

function dayOfWeek(dayKey?: string, start?: Date, timezone?: string | null): number | null {
  if (dayKey && /^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
    const [y, m, d] = dayKey.split("-").map(Number);
    return new Date(y, m - 1, d).getDay();
  }
  if (!start) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    ...(timezone ? { timeZone: timezone } : {}),
  }).formatToParts(start);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "";
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd.slice(0, 3)] ?? null;
}

/**
 * Returns the place that covers the appointment time, or null when it cannot be
 * determined without guessing (e.g. a forced time outside every band with more
 * than one location registered).
 */
export function placeForSlot(opts: PlaceForSlotOptions): Place | null {
  const { startIso, durationMinutes, schedule, locations, timezone, fallbackAddress, dayKey } = opts;
  if (!startIso) return null;
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return null;

  const startMin = minutesOfDay(start, timezone);
  const rawEndMin = startMin + Math.max(0, Number(durationMinutes) || 0);
  const endMin = rawEndMin > 1439 ? 1440 : rawEndMin;

  const byId = new Map<string, LocationLike>();
  for (const l of locations ?? []) if (l?.id) byId.set(l.id, l);

  const bands = (schedule ?? [])
    .map((b) => ({ band: b, s: toMinutes(b?.start_time), e: toMinutes(b?.end_time) }))
    .filter((x): x is { band: BandLike; s: number; e: number } => x.s !== null && x.e !== null && x.e > x.s);

  const dow = dayOfWeek(dayKey, start, timezone);
  // Only the bands of the chosen weekday may decide the location. A band of
  // another weekday that happens to cover the same clock time says nothing about
  // where this appointment is attended, so borrowing it would be a guess.
  // Jornadas por fecha: on a day covered by dated bands only those decide.
  const ymd =
    dayKey && /^\d{4}-\d{2}-\d{2}$/.test(dayKey)
      ? dayKey
      : new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", ...(timezone ? { timeZone: timezone } : {}) }).format(start);
  // Inside a jornada only its bands for this weekday apply (same rule as bandsForDay).
  const datedToday = bands.filter(
    (x) =>
      isDated(x.band) &&
      ymd >= x.band.start_date! &&
      ymd <= x.band.end_date! &&
      (dow === null || x.band.dated_dow == null || x.band.dated_dow === dow),
  );
  const jornadaCoversDay = bands.some((x) => isDated(x.band) && ymd >= x.band.start_date! && ymd <= x.band.end_date!);
  const weekly = bands.filter((x) => !isDated(x.band));
  const sameDay =
    jornadaCoversDay
      ? datedToday
      : dow === null
        ? weekly
        : weekly.filter((x) => x.band.day_of_week === dow || x.band.day_of_week == null);

  const fullyInside = (x: { s: number; e: number }) => x.s <= startMin && endMin <= x.e;
  const overlaps = (x: { s: number; e: number }) => x.s <= startMin && startMin < x.e;

  const chosen =
    sameDay.find((x) => fullyInside(x) && x.band.location_id) ??
    sameDay.find(fullyInside) ??
    sameDay.find(overlaps) ??
    null;

  const fromId = (id?: string | null): Place | null => {
    if (!id) return null;
    const found = byId.get(id);
    if (!found) return null;
    return { name: found.name, address: found.address ?? "" };
  };

  const single = locations?.length === 1 ? fromId(locations[0].id) : null;

  if (chosen) {
    const direct = fromId(chosen.band.location_id);
    if (direct) return direct;
    if (single) return single;
  } else if (single) {
    return single;
  }

  const address = String(fallbackAddress ?? "").trim();
  if (address) return { name: address, address: "" };
  return null;
}

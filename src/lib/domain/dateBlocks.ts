/**
 * Jornadas por fecha y sede: a band with start_date/end_date applies only on
 * those calendar days and, on any day it covers, replaces the weekly bands —
 * so on a La Plata day only La Plata times exist and the other city is closed.
 */
export type DatedBand = {
  day_of_week?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  start_time: string;
  end_time: string;
  location_id?: string | null;
  /** Weekday a dated band applies to inside its range; null = every day. */
  dated_dow?: number | null;
};

export function isDated(b: DatedBand): boolean {
  return !!b.start_date && !!b.end_date;
}

/** Bands that apply on `ymd` (YYYY-MM-DD, weekday `dow`). */
export function bandsForDay<T extends DatedBand>(schedule: T[], ymd: string, dow: number): T[] {
  const dated = schedule.filter((b) => isDated(b) && ymd >= b.start_date! && ymd <= b.end_date!);
  // A jornada covering the day decides it: only its bands for this weekday
  // apply, and a weekday without bands (e.g. a Saturday) stays closed.
  if (dated.length > 0) return dated.filter((b) => b.dated_dow == null || b.dated_dow === dow);
  return schedule.filter((b) => !isDated(b) && b.day_of_week === dow);
}

/** Converts schedule_date_blocks rows into bands that can be mixed with weekly ones. */
export function dateBlocksAsBands(rows: any[]): DatedBand[] {
  return (rows ?? []).map((r) => ({
    day_of_week: null,
    start_date: r.start_date,
    end_date: r.end_date,
    start_time: String(r.start_time).slice(0, 5),
    end_time: String(r.end_time).slice(0, 5),
    location_id: r.location_id,
    dated_dow: r.day_of_week ?? null,
  }));
}

/**
 * Locations a patient can choose when booking: those used by a weekly band or
 * by a dated workday that has not ended yet, in the given locations order.
 */
export function bookableLocations<L extends { id: string }>(locations: L[], schedule: DatedBand[], todayYmd: string): L[] {
  const used = new Set(
    schedule
      .filter((b) => b.location_id && (!isDated(b) || b.end_date! >= todayYmd))
      .map((b) => b.location_id as string),
  );
  return locations.filter((l) => used.has(l.id));
}

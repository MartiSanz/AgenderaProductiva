/** Timezone helpers: interpret wall-clock times in a professional's timezone. */

function partsInTz(utcMs: number, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(new Date(utcMs))) {
    if (part.type !== "literal") p[part.type] = part.value;
  }
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    second: Number(p.second),
  };
}

function offsetMs(utcMs: number, timeZone: string) {
  const p = partsInTz(utcMs, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Calendar date (y/m/d) and weekday of an instant, as seen in `timeZone`. */
export function calendarDayInTz(date: Date, timeZone: string) {
  const p = partsInTz(date.getTime(), timeZone);
  const ymd = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  // Weekday of that calendar date (weekday is tz-stable for the date itself).
  const dow = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  return { year: p.year, month: p.month, day: p.day, ymd, dow };
}

/** Convert a wall-clock time in `timeZone` to the corresponding UTC instant. */
export function wallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let ts = naive - offsetMs(naive, timeZone);
  // Re-check once for DST boundaries.
  ts = naive - offsetMs(ts, timeZone);
  return new Date(ts);
}

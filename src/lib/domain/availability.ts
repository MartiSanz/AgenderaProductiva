import type { Appointment, ProfessionalConfig, TimeOff, WeeklySlot } from "./types";
import { calendarDayInTz, wallClockToUtc } from "./timezone";
import { bandsForDay, isDated, type DatedBand } from "./dateBlocks";

export type Slot = { start: Date; end: Date };

function parseHM(hm: string): [number, number] {
  const [h, m] = hm.split(":").map(Number);
  return [h, m];
}

export type CalendarBusyRange = { start: string; end: string; summary?: string };

/**
 * Compute available slots for a given date, based on config, weekly schedule,
 * time off, existing active appointments and optional Google Calendar busy ranges.
 *
 * When `timeZone` is provided, the schedule bands are interpreted as wall-clock
 * times in that timezone (independent of where the code runs).
 */
export function computeAvailableSlots(
  date: Date,
  config: Pick<ProfessionalConfig, "appointment_duration_minutes"> & {
    non_working_days?: number[];
    timezone?: string | null;
  },
  schedule: WeeklySlot[],
  timeOff: TimeOff[],
  appointments: Appointment[],
  calendarBusy: CalendarBusyRange[] = [],
  locationId?: string | null,
): Slot[] {
  const timeZone = config.timezone || undefined;
  const cal = timeZone
    ? calendarDayInTz(date, timeZone)
    : {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
        ymd: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
        dow: date.getDay(),
      };
  const dow = cal.dow;
  const ymd = cal.ymd;

  const dayBands = bandsForDay(schedule as DatedBand[], ymd, dow);
  // When a location is chosen, only that location's bands of the day count.
  const bands = locationId ? dayBands.filter((b) => b.location_id === locationId) : dayBands;
  // A dated workday (jornada por fecha) is worked even on a usual day off.
  const datedDay = bands.some(isDated);
  if (!datedDay && config.non_working_days?.includes(dow)) return [];

  // Blocked by vacation?
  const dayOff = timeOff.filter((t) => ymd >= t.start_date && ymd <= t.end_date);
  if (dayOff.some((t) => !t.start_time || !t.end_time)) return [];

  if (bands.length === 0) return [];

  const duration = config.appointment_duration_minutes;

  const at = (h: number, m: number) => {
    if (timeZone) return wallClockToUtc(cal.year, cal.month, cal.day, h, m, timeZone);
    const d = new Date(date);
    d.setHours(h, m, 0, 0);
    return d;
  };

  // Busy ranges: active appointments + Google Calendar events
  const busy = appointments
    .filter((a) => a.status === "active")
    .map((a) => ({ s: new Date(a.start_at).getTime(), e: new Date(a.end_at).getTime() }));

  const calendarBusyRanges = calendarBusy
    .filter((event) => event.start && event.end)
    .map((event) => ({ s: new Date(event.start).getTime(), e: new Date(event.end).getTime() }));

  const timeOffRanges = dayOff.map((t) => {
    const [sh, sm] = parseHM(t.start_time!);
    const [eh, em] = parseHM(t.end_time!);
    return { s: at(sh, sm).getTime(), e: at(eh, em).getTime() };
  });

  const allBusy = [...busy, ...calendarBusyRanges, ...timeOffRanges];

  // Candidate start times: the band start, the end of each busy range, and
  // the end of each free slot found — so available times chain one after
  // another (e.g. a 9:00–9:40 turn frees 9:40, then 10:40, 11:40, ...).
  const slots: Slot[] = [];

  for (const band of bands) {
    const [sh, sm] = parseHM(band.start_time);
    const [eh, em] = parseHM(band.end_time);
    const bandStartMs = at(sh, sm).getTime();
    const bandEndMs = at(eh, em).getTime();

    const candidates = new Set<number>([bandStartMs]);
    for (const b of allBusy) {
      if (b.e > bandStartMs && b.e < bandEndMs) candidates.add(b.e);
    }

    const queue = [...candidates].sort((a, b) => a - b);
    for (let i = 0; i < queue.length; i++) {
      const startMs = queue[i];
      const endMs = startMs + duration * 60_000;
      if (endMs > bandEndMs) continue;
      if (allBusy.some((b) => startMs < b.e && b.s < endMs)) continue;
      slots.push({ start: new Date(startMs), end: new Date(endMs) });
      // Chain: the end of this free slot is also a valid start time.
      if (!candidates.has(endMs) && endMs < bandEndMs) {
        candidates.add(endMs);
        queue.push(endMs);
        queue.sort((a, b) => a - b);
      }
    }
  }

  return slots.filter((slot) => {
    const s = slot.start.getTime();
    const e = slot.end.getTime();
    // Also drop past slots for today
    if (e <= Date.now()) return false;
    return !allBusy.some((b) => s < b.e && b.s < e);
  });
}

export function formatTime(d: Date, timeZone?: string) {
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, ...(timeZone ? { timeZone } : {}) });
}

export function formatDateLong(d: Date) {
  return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Martes 12" — day of week + day number, capitalized. */
export function formatDayNumber(d: Date, timeZone?: string) {
  const opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric" };
  if (timeZone) opts.timeZone = timeZone;
  const parts = new Intl.DateTimeFormat("es-AR", opts).formatToParts(d);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  return `${capitalize(weekday)} ${day}`.trim();
}

/** "Agosto" */
export function formatMonthName(d: Date, timeZone?: string) {
  const opts: Intl.DateTimeFormatOptions = { month: "long" };
  if (timeZone) opts.timeZone = timeZone;
  return capitalize(new Intl.DateTimeFormat("es-AR", opts).format(d));
}

/** "9:00" — hour without leading zero. */
export function formatHourShort(d: Date, timeZone?: string) {
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", hour12: false };
  if (timeZone) opts.timeZone = timeZone;
  return new Intl.DateTimeFormat("es-AR", opts).format(d).replace(/^0/, "");
}
import { describe, expect, it } from "vitest";
import { minutesOfDay, placeForSlot } from "./slotLocation";

const TZ = "America/Argentina/Buenos_Aires";
const KASHIWA = { id: "kashiwa", name: "Consultorio Kashiwa", address: "Fortabat 161" };
const SECOND = { id: "second", name: "Consultorio 2", address: "Avenida Fortabat 162" };

/** ISO instant for a wall-clock time in the professional's timezone. */
function at(dayKey: string, hm: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const [h, min] = hm.split(":").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d, h, min));
  // Buenos Aires is UTC-3 all year (no DST), so shift the wall clock by its offset.
  return new Date(base.getTime() + 3 * 3600_000).toISOString();
}

const DAY = "2026-10-20"; // Tuesday (day_of_week 2)

describe("placeForSlot", () => {
  it("returns the location of the band that covers the chosen time", () => {
    const schedule = [
      { day_of_week: 2, start_time: "09:00", end_time: "13:00", location_id: KASHIWA.id },
      { day_of_week: 2, start_time: "14:00", end_time: "18:00", location_id: SECOND.id },
    ];
    expect(placeForSlot({ startIso: at(DAY, "09:30"), durationMinutes: 30, schedule, locations: [KASHIWA, SECOND], timezone: TZ, dayKey: DAY })).toEqual({
      name: "Consultorio Kashiwa",
      address: "Fortabat 161",
    });
    expect(placeForSlot({ startIso: at(DAY, "14:30"), durationMinutes: 30, schedule, locations: [KASHIWA, SECOND], timezone: TZ, dayKey: DAY })).toEqual({
      name: "Consultorio 2",
      address: "Avenida Fortabat 162",
    });
  });

  it("keeps the band when the appointment ends exactly at its closing time", () => {
    const schedule = [{ day_of_week: 2, start_time: "09:00", end_time: "10:00", location_id: KASHIWA.id }];
    expect(
      placeForSlot({ startIso: at(DAY, "09:30"), durationMinutes: 30, schedule, locations: [KASHIWA], timezone: TZ, dayKey: DAY }),
    ).toEqual({ name: "Consultorio Kashiwa", address: "Fortabat 161" });
  });

  it("ignores bands of other weekdays when picking the location", () => {
    const schedule = [
      { day_of_week: 3, start_time: "09:00", end_time: "13:00", location_id: SECOND.id },
      { day_of_week: 2, start_time: "09:00", end_time: "13:00", location_id: KASHIWA.id },
    ];
    expect(
      placeForSlot({ startIso: at(DAY, "10:00"), durationMinutes: 30, schedule, locations: [KASHIWA, SECOND], timezone: TZ, dayKey: DAY }),
    ).toEqual({ name: "Consultorio Kashiwa", address: "Fortabat 161" });
  });

  it("shows nothing on a day without bands, even when another day covers the same time", () => {
    // Saturday has no band; Monday 09:00-13:00 would cover 12:00 but says nothing
    // about where a Saturday turn is attended.
    const schedule = [
      { day_of_week: 1, start_time: "09:00", end_time: "13:00", location_id: SECOND.id },
      { day_of_week: 2, start_time: "09:00", end_time: "17:00", location_id: KASHIWA.id },
    ];
    expect(
      placeForSlot({ startIso: at("2026-10-17", "12:00"), durationMinutes: 30, schedule, locations: [KASHIWA, SECOND], timezone: TZ, dayKey: "2026-10-17" }),
    ).toBeNull();
  });

  it("uses the only location on a day without bands", () => {
    const schedule = [{ day_of_week: 1, start_time: "09:00", end_time: "13:00", location_id: KASHIWA.id }];
    expect(
      placeForSlot({ startIso: at("2026-10-17", "12:00"), durationMinutes: 30, schedule, locations: [KASHIWA], timezone: TZ, dayKey: "2026-10-17" }),
    ).toEqual({ name: "Consultorio Kashiwa", address: "Fortabat 161" });
  });

  it("uses the only location when the band has none assigned", () => {
    const schedule = [{ day_of_week: 2, start_time: "09:00", end_time: "13:00", location_id: null }];
    expect(
      placeForSlot({ startIso: at(DAY, "09:00"), durationMinutes: 30, schedule, locations: [KASHIWA], timezone: TZ, dayKey: DAY }),
    ).toEqual({ name: "Consultorio Kashiwa", address: "Fortabat 161" });
  });

  it("uses the only location for a forced time outside every band", () => {
    const schedule = [{ day_of_week: 2, start_time: "09:00", end_time: "13:00", location_id: KASHIWA.id }];
    expect(
      placeForSlot({ startIso: at(DAY, "19:00"), durationMinutes: 30, schedule, locations: [KASHIWA], timezone: TZ, dayKey: DAY }),
    ).toEqual({ name: "Consultorio Kashiwa", address: "Fortabat 161" });
  });

  it("shows nothing when a forced time could belong to several locations", () => {
    const schedule = [
      { day_of_week: 2, start_time: "09:00", end_time: "13:00", location_id: KASHIWA.id },
      { day_of_week: 4, start_time: "09:00", end_time: "13:00", location_id: SECOND.id },
    ];
    expect(
      placeForSlot({ startIso: at(DAY, "19:00"), durationMinutes: 30, schedule, locations: [KASHIWA, SECOND], timezone: TZ, dayKey: DAY }),
    ).toBeNull();
  });

  it("falls back to the professional address when there are no locations", () => {
    expect(
      placeForSlot({
        startIso: at(DAY, "09:00"),
        durationMinutes: 30,
        schedule: [{ day_of_week: 2, start_time: "09:00", end_time: "13:00", location_id: null }],
        locations: [],
        timezone: TZ,
        dayKey: DAY,
        fallbackAddress: "Av. Rivadavia 1200",
      }),
    ).toEqual({ name: "Av. Rivadavia 1200", address: "" });
  });

  it("returns null when no time was picked yet", () => {
    expect(placeForSlot({ startIso: "", durationMinutes: 30, schedule: [], locations: [KASHIWA], timezone: TZ, dayKey: DAY })).toBeNull();
  });

  it("reads wall-clock minutes in the professional timezone", () => {
    expect(minutesOfDay(new Date(at(DAY, "09:30")), TZ)).toBe(9 * 60 + 30);
  });
});

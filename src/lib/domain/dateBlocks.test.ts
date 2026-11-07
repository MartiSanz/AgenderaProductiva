import { describe, expect, it } from "vitest";
import { computeAvailableSlots } from "./availability";

const cfg = { appointment_duration_minutes: 60, timezone: "America/Argentina/Buenos_Aires", non_working_days: [3] };
const weekly = [{ id: "w", day_of_week: 3, start_time: "09:00", end_time: "11:00", location_id: "juarez" }];
const laPlata = { day_of_week: null, start_date: "2030-11-04", end_date: "2030-11-06", start_time: "14:00", end_time: "16:00", location_id: "laplata" };
const hm = (d: Date) => d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: cfg.timezone });
const day = (ymd: string) => new Date(`${ymd}T15:00:00Z`);

describe("jornadas por fecha y sede", () => {
  it("on a dated day only that sede's hours are offered, even on a usual day off", () => {
    const slots = computeAvailableSlots(day("2030-11-06"), cfg, [...weekly, laPlata] as any, [], []);
    expect(slots.map((s) => hm(s.start))).toEqual(["14:00", "15:00"]);
  });
  it("outside the dated range the weekly schedule applies", () => {
    const slots = computeAvailableSlots(day("2030-11-13"), { ...cfg, non_working_days: [] }, [...weekly, laPlata] as any, [], []);
    expect(slots.map((s) => hm(s.start))).toEqual(["09:00", "10:00"]);
  });
});

import { bookableLocations } from "./dateBlocks";
describe("sede elegida", () => {
  const cfg = { appointment_duration_minutes: 60, non_working_days: [] };
  const sched = [
    { id: "a", day_of_week: null, start_date: "2030-11-07", end_date: "2030-11-09", start_time: "09:00", end_time: "11:00", location_id: "LP" },
    { id: "b", day_of_week: null, start_date: "2030-11-07", end_date: "2030-11-09", start_time: "16:00", end_time: "17:00", location_id: "LP" },
    { id: "c", day_of_week: null, start_date: "2030-12-10", end_date: "2030-12-14", start_time: "09:00", end_time: "10:00", location_id: "BJ" },
  ];
  const d = (s: string) => new Date(`${s}T12:00:00`);
  const hm = (x: Date) => `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
  it("ofrece varias franjas de La Plata el 8/11", () => {
    expect(computeAvailableSlots(d("2030-11-08"), cfg, sched as any, [], [], [], "LP").map((s) => hm(s.start))).toEqual(["09:00", "10:00", "16:00"]);
  });
  it("Benito Juárez no tiene horarios en días de La Plata", () => {
    expect(computeAvailableSlots(d("2030-11-08"), cfg, sched as any, [], [], [], "BJ")).toEqual([]);
  });
  it("lista las ciudades con jornadas vigentes", () => {
    const locs = [{ id: "LP" }, { id: "BJ" }, { id: "X" }];
    expect(bookableLocations(locs, sched as any, "2030-11-01").map((l) => l.id)).toEqual(["LP", "BJ"]);
    expect(bookableLocations(locs, sched as any, "2030-11-20").map((l) => l.id)).toEqual(["BJ"]);
  });
});

describe("horarios por día dentro de la jornada", () => {
  const cfg2 = { appointment_duration_minutes: 60, timezone: "America/Argentina/Buenos_Aires", non_working_days: [] };
  const tue = { ...laPlata, dated_dow: 2, start_time: "09:00", end_time: "11:00" };
  const wed = { ...laPlata, dated_dow: 3, start_time: "14:00", end_time: "15:00" };
  it("each weekday uses its own hours", () => {
    expect(computeAvailableSlots(day("2030-11-05"), cfg2, [...weekly, tue, wed] as any, [], []).map((s) => hm(s.start))).toEqual(["09:00", "10:00"]);
    expect(computeAvailableSlots(day("2030-11-06"), cfg2, [...weekly, tue, wed] as any, [], []).map((s) => hm(s.start))).toEqual(["14:00"]);
  });
  it("a weekday of the range without hours is closed, weekly bands do not apply", () => {
    expect(computeAvailableSlots(day("2030-11-06"), cfg2, [...weekly, tue] as any, [], [])).toEqual([]);
  });
});

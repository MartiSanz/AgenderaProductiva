import { describe, it, expect } from "vitest";
import { computeAvailableSlots } from "./availability";

const cfg = { appointment_duration_minutes: 60, timezone: "America/Argentina/Buenos_Aires" };
const schedule = [{ id: "s", day_of_week: 1, start_time: "09:00", end_time: "13:00" }] as any;
const day = new Date("2099-01-05T15:00:00Z"); // lunes
const hm = (d: Date) => d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: cfg.timezone });

describe("ausencias por franja horaria", () => {
  it("bloquea solo la franja indicada", () => {
    const off = [{ id: "t", start_date: "2099-01-05", end_date: "2099-01-05", reason: "", start_time: "10:00", end_time: "12:00" }];
    expect(computeAvailableSlots(day, cfg, schedule, off, []).map((s) => hm(s.start))).toEqual(["09:00", "12:00"]);
  });
  it("sin horario bloquea el día completo", () => {
    const off = [{ id: "t", start_date: "2099-01-05", end_date: "2099-01-05", reason: "" }];
    expect(computeAvailableSlots(day, cfg, schedule, off, [])).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { mobileSlotsKey, visibleMobileSlots } from "./mobileSlots";

const slots = ["09:00", "09:30", "10:00", "10:30", "11:00"].map((label) => ({ value: `2026-10-15T${label}:00Z`, label }));
describe("mobile available times", () => {
  it("shows the first three ordered times", () => {
    expect(visibleMobileSlots([...slots].reverse(), false, "").map((s) => s.label)).toEqual(["09:00", "09:30", "10:00"]);
  });
  it("expands to all available times", () => {
    expect(visibleMobileSlots(slots, true, "")).toEqual(slots);
  });
  it("keeps a later selection visible when collapsed", () => {
    expect(visibleMobileSlots(slots, false, slots[4].value).map((s) => s.label)).toEqual(["09:00", "09:30", "11:00"]);
  });
  it("keeps lists with fewer than three intact", () => {
    expect(visibleMobileSlots(slots.slice(0, 2), false, "")).toHaveLength(2);
  });
  it.each([
    [false, "2026-10-15", "control", 30],
    [true, "2026-10-16", "control", 30],
    [true, "2026-10-15", "consulta", 30],
    [true, "2026-10-15", "control", 60],
  ] as const)("resets expansion when its context changes (%s, %s, %s, %s)", (open, day, type, duration) => {
    expect(mobileSlotsKey(open, day, type, duration)).not.toBe(mobileSlotsKey(true, "2026-10-15", "control", 30));
  });
});
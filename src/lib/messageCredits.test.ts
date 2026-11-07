import { describe, it, expect } from "vitest";
import { availableMessages, MONTHLY_REMINDERS } from "./messageCredits";

const now = new Date("2026-11-15T12:00:00Z");
const future = "2026-12-30T00:00:00Z";

describe("message credits", () => {
  it("includes 180 monthly reminders", () => {
    expect(MONTHLY_REMINDERS).toBe(180);
    expect(availableMessages(0, [], now).total).toBe(180);
  });
  it("adds active packs after the monthly quota", () => {
    expect(availableMessages(200, [{ remaining: 25, expires_at: future, cancelled_at: null }], now)).toEqual({ monthlyLeft: 0, packsLeft: 25, total: 25 });
  });
  it("ignores expired and cancelled packs", () => {
    const r = availableMessages(180, [
      { remaining: 10, expires_at: "2026-11-01T00:00:00Z", cancelled_at: null },
      { remaining: 10, expires_at: future, cancelled_at: "2026-11-02T00:00:00Z" },
    ], now);
    expect(r.total).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { paidThisMonth, monthKeyAR } from "./adminMetrics";

const now = new Date("2026-10-21T21:57:00Z");

describe("paidThisMonth", () => {
  it("counts a payment dated inside the current month", () => {
    expect(paidThisMonth("2026-10-03", now)).toBe(true);
  });
  it("does not count a payment from last month", () => {
    expect(paidThisMonth("2026-09-30", now)).toBe(false);
  });
  it("does not count an account with no payment", () => {
    expect(paidThisMonth(null, now)).toBe(false);
  });
  it("uses Buenos Aires month near midnight", () => {
    // 1 Nov 01:00 UTC is still 31 Oct in Buenos Aires
    expect(monthKeyAR(new Date("2026-11-01T01:00:00Z"))).toBe("2026-10");
  });
});

import { setupComplete, accountState, isInactive } from "./adminMetrics";

describe("setup and activity rules", () => {
  const all = { personalData: true, schedule: true, location: true, appointmentTypes: true, calendar: true };
  it("setup is complete without Google Calendar, but not without a required step", () => {
    expect(setupComplete(all)).toBe(true);
    expect(setupComplete({ ...all, calendar: false })).toBe(true);
    expect(setupComplete({ ...all, personalData: false })).toBe(false);
  });
  it("suspended beats approved", () => {
    expect(accountState({ suspended: true, approved: true, isAdmin: false })).toBe("suspended");
    expect(accountState({ suspended: false, approved: false, isAdmin: false })).toBe("pending");
  });
  it("an account still configuring is never inactive", () => {
    expect(isInactive({ setupDone: false, lastSignInAt: null, lastCreatedAt: null, now })).toBe(false);
  });
  it("31 days without sign-in or new turnos is inactive, 10 days is not", () => {
    expect(isInactive({ setupDone: true, lastSignInAt: "2026-09-20T12:00:00Z", lastCreatedAt: null, now })).toBe(true);
    expect(isInactive({ setupDone: true, lastSignInAt: "2026-09-20T12:00:00Z", lastCreatedAt: "2026-10-11T12:00:00Z", now })).toBe(false);
  });
});

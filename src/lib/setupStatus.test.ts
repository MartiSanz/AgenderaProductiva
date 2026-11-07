import { describe, expect, it } from "vitest";
import { isSetupComplete } from "./setupStatus";

const full = {
  config: { display_name: "Ana", phone: "+5492281000000", specialty: "Psicología" },
  locations: 1,
  appointmentTypes: 1,
  scheduleSlots: 1,
  calendarConnected: false,
};

describe("setup completion", () => {
  it("is complete without Google Calendar", () => {
    expect(isSetupComplete(full)).toBe(true);
  });
  it("is incomplete without phone", () => {
    expect(isSetupComplete({ ...full, config: { ...full.config, phone: "" } })).toBe(false);
  });
  it("is incomplete without schedule", () => {
    expect(isSetupComplete({ ...full, scheduleSlots: 0 })).toBe(false);
  });
  it("is complete with jornadas and no weekly schedule", () => {
    expect(isSetupComplete({ ...full, scheduleSlots: 0, dateBlocks: 2 })).toBe(true);
  });
  it("is incomplete without location or types", () => {
    expect(isSetupComplete({ ...full, locations: 0 })).toBe(false);
    expect(isSetupComplete({ ...full, appointmentTypes: 0 })).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { visibleRangeFor } from "./agendaRange";
const ymd = (d: Date) => d.toLocaleDateString("en-CA");
describe("visibleRangeFor", () => {
  it("week of Wed 4 Nov 2026 runs Mon 2 to Sun 8, query end is Mon 9", () => {
    const r = visibleRangeFor("week", new Date(2026, 10, 4));
    expect(ymd(r.days[0])).toBe("2026-11-02");
    expect(ymd(r.days[6])).toBe("2026-11-08");
    expect(ymd(r.end)).toBe("2026-11-09");
  });
  it("grid equals week", () => {
    expect(visibleRangeFor("grid", new Date(2026, 10, 1)).days.map(ymd)).toEqual(visibleRangeFor("week", new Date(2026, 10, 1)).days.map(ymd));
  });
  it("Sunday 1 Nov belongs to the week starting Mon 26 Oct", () => {
    expect(ymd(visibleRangeFor("week", new Date(2026, 10, 1)).start)).toBe("2026-10-26");
  });
  it("month Nov 2026 query covers every visible cell (26 Oct – 6 Dec)", () => {
    const r = visibleRangeFor("month", new Date(2026, 10, 15));
    expect(ymd(r.start)).toBe("2026-10-26");
    expect(ymd(r.days[r.days.length - 1])).toBe("2026-12-06");
    expect(ymd(r.end)).toBe("2026-12-07");
  });
  it("year change: Jan 2027 starts Mon 28 Dec 2026", () => {
    expect(ymd(visibleRangeFor("month", new Date(2027, 0, 10)).start)).toBe("2026-12-28");
  });
});

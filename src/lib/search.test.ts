import { describe, it, expect } from "vitest";
import { matchesSearch } from "./search";
describe("matchesSearch", () => {
  it("matches name ignoring accents", () => expect(matchesSearch("alvarez", "Ana Álvarez")).toBe(true));
  it("matches phone digits regardless of format", () => expect(matchesSearch("11 5555", "+54 9 11-5555-1234")).toBe(true));
  it("rejects non-matching", () => expect(matchesSearch("zzz", "Ana", "ana@x.com")).toBe(false));
});

import { describe, it, expect } from "vitest";
import { assignSlugs, baseSlug } from "./portalSlug";
describe("portal slug", () => {
  it("usa nombre y profesión sin acentos", () => {
    expect(baseSlug("Martina Sanz", "Odontología")).toBe("martina-sanz-odontologia");
  });
  it("desambigua duplicados", () => {
    const m = assignSlugs([
      { owner_id: "a", display_name: "Ana Paz", specialty: "Psicología", created_at: "1" },
      { owner_id: "b", display_name: "Ana Paz", specialty: "Psicología", created_at: "2" },
    ]);
    expect(m.get("a")).toBe("ana-paz-psicologia");
    expect(m.get("b")).toBe("ana-paz-psicologia-2");
  });
});

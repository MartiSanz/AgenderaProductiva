import { describe, it, expect } from "vitest";
import { splitPhone, joinPhone } from "./phoneCountries";
import { normalizeArPhone } from "./phone";
describe("teléfono con código de país", () => {
  it("Argentina por defecto", () => expect(splitPhone("")).toEqual({ code: "54", national: "" }));
  it("separa +549", () => expect(splitPhone("+5492281506344")).toEqual({ code: "54", national: "2281506344" }));
  it("separa Uruguay", () => expect(splitPhone("+598 99123456").code).toBe("598"));
  it("AR se guarda como +549", () => expect(normalizeArPhone(joinPhone("54", "2281 50-6344"))).toBe("+5492281506344"));
  it("otro país se respeta", () => expect(normalizeArPhone(joinPhone("598", "99 123 456"))).toBe("+59899123456"));
});

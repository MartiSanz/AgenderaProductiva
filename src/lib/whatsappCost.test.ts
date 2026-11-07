import { describe, expect, it } from "vitest";
import { whatsappCost } from "./whatsappCost";

describe("whatsappCost", () => {
  it("charges 0.026 USD per message", () => {
    expect(whatsappCost(100, null).usd).toBeCloseTo(2.6);
  });
  it("converts to ARS and adds 21% VAT", () => {
    const c = whatsappCost(100, 1000);
    expect(c.arsNet).toBeCloseTo(2600);
    expect(c.vat).toBeCloseTo(546);
    expect(c.arsTotal).toBeCloseTo(3146);
  });
});

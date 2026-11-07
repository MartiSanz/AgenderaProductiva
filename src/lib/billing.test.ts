import { describe, expect, it } from "vitest";
import { billingStatus, deadlineLabel, formatAmount, reminderKindFor } from "./billing";

describe("reglas de cobro", () => {
  it("el día 10 todavía no está vencido", () => expect(billingStatus(false, 10)).toBe("due_soon"));
  it("desde el día 11 un impago está vencido", () => expect(billingStatus(false, 11)).toBe("overdue"));
  it("un pago registrado nunca figura vencido", () => expect(billingStatus(true, 25)).toBe("paid"));
  it("el día 1 no se envía aviso", () => { expect(reminderKindFor(1, true)).toBeNull(); expect(reminderKindFor(1, false)).toBeNull(); });
  it("el día 9 se avisa solo a impagos", () => {
    expect(reminderKindFor(9, false)).toBe("due");
    expect(reminderKindFor(9, true)).toBeNull();
  });
  it("otros días no se envía nada", () => expect(reminderKindFor(5, false)).toBeNull());
  it("noviembre vence el 10 de diciembre", () => expect(deadlineLabel("2026-11")).toBe("10/12/2026"));
  it("diciembre vence el 10 de enero", () => expect(deadlineLabel("2026-12")).toBe("10/01/2027"));
  it("monto con punto de miles", () => expect(formatAmount(10000)).toBe("10.000"));
});

import { unpaidPlanPeriods } from "./billing";
describe("abonos impagos del plan", () => {
  it("cuenta aceptada este mes no debe nada", () =>
    expect(unpaidPlanPeriods([], { period: "2026-11", day: 5 }, "2026-11")).toEqual([]));
  it("el mes en curso nunca se cobra", () =>
    expect(unpaidPlanPeriods([], { period: "2026-11", day: 25 }, "2026-10").map((p) => p.period)).toEqual(["2026-10"]));
  it("octubre el 5 de noviembre está pendiente", () =>
    expect(unpaidPlanPeriods([], { period: "2026-11", day: 5 }, "2026-10")).toEqual([{ period: "2026-10", status: "pending" }]));
  it("octubre el 11 de noviembre está vencido", () =>
    expect(unpaidPlanPeriods([], { period: "2026-11", day: 11 }, "2026-10")).toEqual([{ period: "2026-10", status: "overdue" }]));
  it("meses más viejos impagos están vencidos", () =>
    expect(unpaidPlanPeriods([], { period: "2026-11", day: 5 }, "2026-09")).toEqual([
      { period: "2026-09", status: "overdue" }, { period: "2026-10", status: "pending" }]));
  it("meses pagados no aparecen", () =>
    expect(unpaidPlanPeriods(["2026-09", "2026-10"], { period: "2026-11", day: 12 }, "2026-09")).toEqual([]));
});

import { debtBannerKind } from "./billing";
describe("aviso de deuda en el panel", () => {
  it("el día 4 no se muestra", () => expect(debtBannerKind(4, true)).toBeNull());
  it("desde el día 5 se muestra como recordatorio", () => expect(debtBannerKind(5, true)).toBe("due"));
  it("desde el día 11 se muestra vencido", () => expect(debtBannerKind(11, true)).toBe("overdue"));
  it("cuota de un mes anterior vencida se muestra el día 1", () => expect(debtBannerKind(1, true, true)).toBe("overdue"));
  it("cuota de un mes anterior vencida se muestra el día 4", () => expect(debtBannerKind(4, true, true)).toBe("overdue"));
  it("sin deuda nunca se muestra", () => expect(debtBannerKind(20, false)).toBeNull());
});

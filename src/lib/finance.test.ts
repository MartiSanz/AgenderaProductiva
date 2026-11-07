import { describe, expect, it } from "vitest";
import { breakEven, expandEntry, monthsToRecover, project, summarize, toArs, type FinanceEntry, type Income } from "./finance";

const e = (p: Partial<FinanceEntry>): FinanceEntry => ({
  id: "x", concept: "c", category: "Otros", kind: "operating", frequency: "once", currency: "ARS",
  amount: 0, fx_rate: null, amount_ars: 0, entry_date: "2026-01-01", end_date: null, ...p,
});
const inc = (date: string, amount: number): Income => ({ date, amount, source: "basic", professional: "", concept: "", period: null, method: "" });

describe("finanzas", () => {
  it("ejemplo del documento: 450.000 + 95.000 con 280.000 cobrados deja 265.000 pendientes (51,4%)", () => {
    const s = summarize(
      [e({ kind: "investment", amount_ars: 450000 }), e({ amount_ars: 95000 })],
      [inc("2026-02-01", 280000)], "2026-01-01", "2026-12-31", "2026-12-31",
    );
    expect(s.toRecover).toBe(545000);
    expect(s.pending).toBe(265000);
    expect(Math.round(s.recoveredPctTotal! * 1000) / 10).toBe(51.4);
    expect(s.surplus).toBe(0);
  });

  it("superado el equilibrio muestra excedente y no saldo negativo", () => {
    const s = summarize([e({ kind: "investment", amount_ars: 100 })], [inc("2026-01-05", 150)], "2026-01-01", "2026-01-31", "2026-01-31");
    expect(s.pending).toBe(0);
    expect(s.surplus).toBe(50);
  });

  it("gastos futuros previstos no cuentan como egresos reales", () => {
    const s = summarize([e({ amount_ars: 500, entry_date: "2026-06-01" })], [], "2026-01-01", "2026-12-31", "2026-03-01");
    expect(s.operating).toBe(0);
  });

  it("un gasto mensual se reconoce una vez por mes hasta su fecha de fin", () => {
    const occ = expandEntry(e({ frequency: "monthly", amount_ars: 10, entry_date: "2026-01-31", end_date: "2026-04-15" }), "2026-12-31");
    expect(occ.map((o) => o.date)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  it("dólares se convierten con el tipo de cambio cargado", () => {
    expect(toArs(20, "USD", 1200)).toBe(24000);
    expect(() => toArs(20, "USD", null)).toThrow();
  });

  it("punto de equilibrio por margen de contribución", () => {
    const b = breakEven({ fixedMonthly: 100000, basicCount: 1, proCount: 1, priceBasic: 20000, pricePro: 30000, variablePerPro: 5000 });
    expect(b.margin).toBe(20000);
    expect(b.needed).toBe(5);
    expect(b.missing).toBe(3);
  });

  it("sin flujo neto positivo no hay fecha estimable", () => {
    expect(monthsToRecover(1000, 0)).toBeNull();
    expect(monthsToRecover(1000, 300)).toBe(4);
  });

  it("proyección descuenta costos previstos", () => {
    const p = project({ active: 10, newPerMonth: 0, churnPct: 0, proSharePct: 0, priceBasic: 1000, pricePro: 0, messagesPerPro: 0, costPerMessage: 0, packsPerMonth: 0, fixedMonthly: 4000, variablePerPro: 0 }, 3, 15000);
    expect(p.rows[0].net).toBe(6000);
    expect(p.recoveryMonth).toBe(3);
  });
});

import { whatsappMonthlyEntries, monthlyFixedCost } from "./finance";
describe("whatsappMonthlyEntries", () => {
  it("14 mensajes a US$0,026 + IVA 21% con dólar 1570 = $691,49 y cuenta como costo fijo del mes", () => {
    const [w] = whatsappMonthlyEntries({ "2026-11": 14 }, 1570, 0.026, 0.21);
    expect(w.amount_ars).toBeCloseTo(691.49, 0);
    expect(w.end_date).toBe("2026-11-30");
    expect(monthlyFixedCost([w], "2026-11-06")).toBeCloseTo(691.49, 0);
    expect(monthlyFixedCost([w], "2026-12-01")).toBe(0);
  });
});

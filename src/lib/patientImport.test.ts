import { describe, it, expect } from "vitest";
import { parsePatientRows } from "./patientImport";

const H = ["Email", "Nombres", "Apellidos", "DNI", "Número de cliente", "Teléfono", "Teléfono secundario del cliente", "Dirección", "comuna", "Ciudad", "Edad", "Género", "Día del nacimiento", "Mes del nacimiento", "Año de nacimiento.", "Fecha de creación."];

describe("parsePatientRows", () => {
  it("crea un paciente por fila con nombre, apellido y teléfono", () => {
    const r = parsePatientRows([H, [null, "Ana ", "Pérez", null, null, "+541112345678", null, null, null, null, null, 0, 5, 3, 1990, null]]);
    expect(r).toEqual([{ row: 2, ok: true, patient: { first_name: "Ana", last_name: "Pérez", dni: "", phone: "+541112345678", email: "", birth_date: "1990-03-05", notes: "" } }]);
  });
  it("omite filas sin teléfono y salta filas vacías", () => {
    const r = parsePatientRows([H, [null, "Ana", "Pérez"], [], [null, null, null]]);
    expect(r).toEqual([{ row: 2, ok: false, name: "Ana Pérez", reason: "Sin teléfono ni teléfono secundario" }]);
  });
  it("exige las columnas mínimas", () => {
    expect(() => parsePatientRows([["Email"]])).toThrow();
  });
});

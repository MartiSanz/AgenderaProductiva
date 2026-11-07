import { describe, expect, it } from "vitest";
import { matchPatient, samePatient } from "./patientIdentity";

describe("identidad de paciente: teléfono + nombre + apellido", () => {
  it("reconoce al mismo paciente aunque cambien mayúsculas, acentos y formato del teléfono", () => {
    expect(
      samePatient(
        { first_name: "María", last_name: "Gómez", phone: "2281 15-56-5356" },
        { first_name: "maria", last_name: "GOMEZ", phone: "+5492281565356" },
      ),
    ).toBe(true);
  });

  it("dos personas con el mismo teléfono y distinto nombre son pacientes distintos", () => {
    const rows = [{ id: "madre", first_name: "Ana", last_name: "Pérez", phone: "+5492281565356" }];
    expect(matchPatient(rows, { first_name: "Sofía", last_name: "Pérez", phone: "+5492281565356" })).toBeNull();
  });

  it("mismo nombre con otro teléfono es otro paciente", () => {
    expect(
      samePatient(
        { first_name: "Ana", last_name: "Pérez", phone: "+5492281565356" },
        { first_name: "Ana", last_name: "Pérez", phone: "+5491155554444" },
      ),
    ).toBe(false);
  });

  it("el DNI no participa de la identidad", () => {
    const rows = [{ id: "a", first_name: "Ana", last_name: "Pérez", phone: "+5492281565356", dni: "30111222" }];
    expect(matchPatient(rows, { first_name: "Ana", last_name: "Pérez", phone: "2281565356" })?.id).toBe("a");
  });
});

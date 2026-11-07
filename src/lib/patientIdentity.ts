import { normalizeArPhone } from "@/lib/phone";

/**
 * Regla única de identidad de un paciente dentro de un profesional:
 * teléfono normalizado + nombre + apellido. El DNI es solo informativo.
 * Dos personas que comparten teléfono (ej. madre e hija) son pacientes distintos.
 */
export type PatientIdentity = { first_name: string; last_name: string; phone: string };

function normName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function patientKey(p: PatientIdentity): string {
  return `${normalizeArPhone(p.phone)}|${normName(p.first_name)}|${normName(p.last_name)}`;
}

export function samePatient(a: PatientIdentity, b: PatientIdentity): boolean {
  return patientKey(a) === patientKey(b);
}

/** Elige, entre los pacientes con el mismo teléfono, el que coincide en nombre y apellido. */
export function matchPatient<T extends PatientIdentity>(rows: T[], who: PatientIdentity): T | null {
  return rows.find((r) => samePatient(r, who)) ?? null;
}

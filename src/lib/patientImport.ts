/** Convierte las filas de una planilla de clientes en pacientes listos para crear. */
export type ImportedPatient = {
  first_name: string;
  last_name: string;
  dni: string;
  phone: string;
  email: string;
  birth_date: string;
  notes: string;
};

export type ImportRowResult =
  | { row: number; ok: true; patient: ImportedPatient }
  | { row: number; ok: false; reason: string; name: string };

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const str = (v: unknown) => (v == null ? "" : v instanceof Date ? "" : String(v).trim());

function findCol(headers: string[], ...starts: string[]) {
  return headers.findIndex((h) => starts.some((s) => h.startsWith(s)));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parsePatientRows(sheet: unknown[][]): ImportRowResult[] {
  if (!sheet.length) return [];
  const headers = sheet[0].map(norm);
  const c = {
    email: findCol(headers, "email", "correo"),
    first: findCol(headers, "nombre"),
    last: findCol(headers, "apellido"),
    dni: findCol(headers, "dni", "documento"),
    phone: headers.findIndex((h) => h.startsWith("telefono") && !h.includes("secundario")),
    phone2: headers.findIndex((h) => h.startsWith("telefono") && h.includes("secundario")),
    day: findCol(headers, "dia del nacimiento", "dia de nacimiento"),
    month: findCol(headers, "mes del nacimiento", "mes de nacimiento"),
    year: findCol(headers, "ano de nacimiento", "año de nacimiento", "ano del nacimiento"),
  };
  if (c.first < 0 || c.last < 0 || c.phone < 0) {
    throw new Error("La planilla debe tener las columnas Nombres, Apellidos y Teléfono.");
  }
  const get = (r: unknown[], i: number) => (i >= 0 ? str(r[i]) : "");
  const out: ImportRowResult[] = [];
  sheet.slice(1).forEach((r, idx) => {
    const row = idx + 2;
    if (!r || r.every((v) => str(v) === "")) return;
    const first_name = get(r, c.first);
    const last_name = get(r, c.last);
    const phone = get(r, c.phone) || get(r, c.phone2);
    const name = `${first_name} ${last_name}`.trim();
    if (!first_name || !last_name) return out.push({ row, ok: false, name, reason: "Falta nombre o apellido" });
    if (phone.replace(/\D/g, "").length < 5) return out.push({ row, ok: false, name, reason: "Sin teléfono ni teléfono secundario" });
    const email = get(r, c.email);
    const d = Number(get(r, c.day)), m = Number(get(r, c.month)), y = Number(get(r, c.year));
    const birth_date =
      d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= 2100
        ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
        : "";
    out.push({
      row,
      ok: true,
      patient: {
        first_name,
        last_name,
        dni: get(r, c.dni).replace(/\D/g, "").slice(0, 20),
        phone,
        email: EMAIL_RE.test(email) ? email : "",
        birth_date,
        notes: "",
      },
    });
  });
  return out;
}

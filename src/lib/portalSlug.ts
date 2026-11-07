/** Builds the friendly portal path segment: "nombre-apellido-profesion". */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function baseSlug(displayName: string, specialty: string): string {
  return slugify(`${displayName} ${specialty}`);
}

type Row = { owner_id: string; display_name: string; specialty: string | null; created_at?: string };

/** Unique slug per professional; duplicates get -2, -3… by creation order. */
export function assignSlugs(rows: Row[]): Map<string, string> {
  const sorted = [...rows].sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));
  const used = new Map<string, number>();
  const out = new Map<string, string>();
  for (const r of sorted) {
    const base = baseSlug(r.display_name ?? "", r.specialty ?? "") || "profesional";
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    out.set(r.owner_id, n === 1 ? base : `${base}-${n}`);
  }
  return out;
}

/** Case/accent-insensitive search over names/emails; digit-only match for phone numbers. */
const norm = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function matchesSearch(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = norm(query.trim());
  if (!q) return true;
  const digits = q.replace(/\D/g, "");
  return fields.some((f) => {
    if (!f) return false;
    if (norm(f).includes(q)) return true;
    return digits.length >= 3 && f.replace(/\D/g, "").includes(digits);
  });
}

const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });

/** Alphabetical comparison ignoring case and accents (Spanish rules). */
export function compareByName(a: string | null | undefined, b: string | null | undefined): number {
  return collator.compare((a ?? "").trim(), (b ?? "").trim());
}

/** Returns a new array sorted A→Z by the given name getter. */
export function sortByName<T>(list: readonly T[], name: (x: T) => string | null | undefined): T[] {
  return [...list].sort((x, y) => compareByName(name(x), name(y)));
}

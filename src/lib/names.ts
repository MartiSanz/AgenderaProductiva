/** Capitaliza nombres y apellidos: "juan carlos" -> "Juan Carlos", "de la cruz" -> "De La Cruz". */
export function toTitleCase(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) =>
      word
        .split("-")
        .map((part) =>
          part
            .split("'")
            .map((p) => (p ? p.charAt(0).toLocaleUpperCase("es") + p.slice(1) : p))
            .join("'"),
        )
        .join("-"),
    )
    .join(" ");
}

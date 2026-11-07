export const COUNTRIES = [
  { iso: "AR", code: "54", flag: "🇦🇷", name: "Argentina" },
  { iso: "UY", code: "598", flag: "🇺🇾", name: "Uruguay" },
  { iso: "CL", code: "56", flag: "🇨🇱", name: "Chile" },
  { iso: "PY", code: "595", flag: "🇵🇾", name: "Paraguay" },
  { iso: "BR", code: "55", flag: "🇧🇷", name: "Brasil" },
  { iso: "BO", code: "591", flag: "🇧🇴", name: "Bolivia" },
  { iso: "PE", code: "51", flag: "🇵🇪", name: "Perú" },
  { iso: "CO", code: "57", flag: "🇨🇴", name: "Colombia" },
  { iso: "VE", code: "58", flag: "🇻🇪", name: "Venezuela" },
  { iso: "EC", code: "593", flag: "🇪🇨", name: "Ecuador" },
  { iso: "MX", code: "52", flag: "🇲🇽", name: "México" },
  { iso: "ES", code: "34", flag: "🇪🇸", name: "España" },
  { iso: "IT", code: "39", flag: "🇮🇹", name: "Italia" },
  { iso: "US", code: "1", flag: "🇺🇸", name: "Estados Unidos" },
] as const;

export const DEFAULT_CODE = "54";

/** Separa un teléfono guardado en código de país y número nacional. */
export function splitPhone(value: string): { code: string; national: string } {
  const v = (value ?? "").trim();
  if (!v.startsWith("+")) return { code: DEFAULT_CODE, national: v };
  const m = v.match(/^\+(\d+)\s?(.*)$/);
  const rest = v.slice(1);
  // Coincidencia más larga primero (ej. 598 antes que 59x).
  const sorted = [...COUNTRIES].sort((a, b) => b.code.length - a.code.length);
  for (const c of sorted) {
    if (rest.replace(/\s/g, "").startsWith(c.code)) {
      let national = rest.replace(/^\s*/, "");
      // quitar el código respetando espacios iniciales
      let digitsSeen = 0;
      let i = 0;
      while (i < national.length && digitsSeen < c.code.length) {
        if (/\d/.test(national[i])) digitsSeen++;
        i++;
      }
      national = national.slice(i).trim();
      if (c.code === "54") national = national.replace(/^9\s*/, "");
      return { code: c.code, national };
    }
  }
  return { code: DEFAULT_CODE, national: m ? v : v };
}

/** Une código y número; vacío si no hay número. */
export function joinPhone(code: string, national: string): string {
  if (!national.trim()) return "";
  if (national.trim().startsWith("+")) return national.trim();
  return `+${code} ${national}`;
}

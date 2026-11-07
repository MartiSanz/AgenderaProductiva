import { useEffect, useState } from "react";

const SEL = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60";
const API = "https://apis.datos.gob.ar/georef/api";

type Props = { value: string; onValueChange: (v: string) => void };

/** País → provincia → ciudad, todos como selectores. Devuelve "Ciudad, Provincia, Argentina". */
export function CitySelect({ value, onValueChange }: Props) {
  const parts = value.split(",").map((s) => s.trim());
  const [province, setProvince] = useState(parts.length >= 2 ? parts[1] : "");
  const [provinces, setProvinces] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const city = parts.length >= 2 ? parts[0] : "";

  useEffect(() => {
    fetch(`${API}/provincias?campos=nombre&max=50`)
      .then((r) => r.json())
      .then((j) =>
        setProvinces((j.provincias ?? []).map((p: { nombre: string }) => p.nombre).sort((a: string, b: string) => a.localeCompare(b, "es"))),
      )
      .catch(() => setProvinces([]));
  }, []);

  useEffect(() => {
    if (!province) return setCities([]);
    setLoading(true);
    fetch(`${API}/localidades?provincia=${encodeURIComponent(province)}&campos=nombre&max=5000`)
      .then((r) => r.json())
      .then((j) =>
        setCities([...new Set<string>((j.localidades ?? []).map((l: { nombre: string }) => l.nombre))].sort((a, b) => a.localeCompare(b, "es"))),
      )
      .catch(() => setCities([]))
      .finally(() => setLoading(false));
  }, [province]);

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <select className={SEL} value="Argentina" aria-label="País" disabled>
        <option value="Argentina">Argentina</option>
      </select>
      <select
        className={SEL}
        aria-label="Provincia"
        value={province}
        onChange={(e) => {
          setProvince(e.target.value);
          onValueChange("");
        }}
      >
        <option value="">Provincia</option>
        {provinces.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      <select
        className={SEL}
        aria-label="Ciudad"
        value={city}
        disabled={!province || loading}
        onChange={(e) => onValueChange(e.target.value ? `${e.target.value}, ${province}, Argentina` : "")}
      >
        <option value="">{loading ? "Cargando…" : "Ciudad"}</option>
        {cities.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    </div>
  );
}

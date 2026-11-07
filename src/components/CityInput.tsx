import { useEffect, useId, useState } from "react";
import { Input } from "@/components/ui/input";

type Props = Omit<React.ComponentProps<typeof Input>, "onChange" | "value" | "defaultValue"> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
};

/** Text input that suggests Argentine cities ("Ciudad, Provincia") from the public Georef service. */
export function CityInput({ value, defaultValue, onValueChange, ...rest }: Props) {
  const listId = useId();
  const [text, setText] = useState(value ?? defaultValue ?? "");
  const [options, setOptions] = useState<string[]>([]);

  useEffect(() => {
    if (value !== undefined) setText(value);
  }, [value]);

  useEffect(() => {
    const q = text.split(",")[0].trim();
    if (q.length < 2) return setOptions([]);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          `https://apis.datos.gob.ar/georef/api/localidades?nombre=${encodeURIComponent(q)}&max=10&campos=nombre,provincia.nombre`,
          { signal: ctrl.signal },
        );
        const j = await r.json();
        const names: string[] = (j.localidades ?? []).map(
          (l: { nombre: string; provincia: { nombre: string } }) => `${l.nombre}, ${l.provincia.nombre}`,
        );
        setOptions([...new Set(names)]);
      } catch {
        /* sin sugerencias */
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [text]);

  return (
    <>
      <Input
        {...rest}
        list={listId}
        autoComplete="off"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onValueChange?.(e.target.value);
        }}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { COUNTRIES, joinPhone, splitPhone } from "@/lib/phoneCountries";

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
};

/** Teléfono con selector de código de país; Argentina por defecto. */
export function PhoneInput({ id, value, onChange, placeholder, maxLength = 30 }: Props) {
  const parsed = splitPhone(value);
  // Recuerda el país elegido mientras el número está vacío (si no, volvería a Argentina).
  const [pickedCode, setPickedCode] = useState(parsed.code);
  const national = parsed.national;
  const code = national.trim() ? parsed.code : pickedCode;
  return (
    <div className="flex gap-2">
      {/* El número va primero en el DOM para que los diálogos lo enfoquen a él y no abran el selector (iOS). */}
      <Input
        id={id}
        type="tel"
        autoComplete="tel-national"
        inputMode="tel"
        value={national}
        maxLength={maxLength}
        className="order-2"
        placeholder={placeholder ?? (code === "54" ? "11 1234-5678" : "Número")}
        onChange={(e) => onChange(joinPhone(code, e.target.value))}
      />
      <select
        aria-label="Código de país"
        value={code}
        onChange={(e) => {
          setPickedCode(e.target.value);
          onChange(joinPhone(e.target.value, national));
        }}
        className="order-1 h-[2.85rem] w-[6.5rem] shrink-0 rounded-md border border-input bg-background px-2 text-sm text-foreground"
      >
        {COUNTRIES.map((c) => (
          <option key={c.iso} value={c.code}>
            {c.flag} +{c.code}
          </option>
        ))}
      </select>
    </div>
  );
}

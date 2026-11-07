import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { visibleMobileSlots, type AvailableTime } from "./mobileSlots";

export function MobileSlotList({ slots, selected, onSelect }: {
  slots: AvailableTime[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="space-y-2 sm:hidden">
      <div id="np-mobile-times" className="grid min-w-0 grid-cols-1 gap-2">
        {visibleMobileSlots(slots, expanded, selected).map((slot) => (
          <Button key={slot.value} variant="outline" aria-pressed={selected === slot.value}
            onClick={() => onSelect(slot.value)}
            className={`h-11 w-full rounded-xl ${selected === slot.value ? "border-primary bg-primary/10 text-foreground" : "border-border"}`}>
            {slot.label} hs
          </Button>
        ))}
      </div>
      {slots.length > 3 && (
        <Button variant="ghost" className="h-11 w-full text-primary" aria-expanded={expanded}
          aria-controls="np-mobile-times" onClick={() => setExpanded((value) => !value)}>
          {expanded ? <ChevronUp /> : <ChevronDown />}
          {expanded ? "Ver menos" : `Ver más horarios (${slots.length - 3})`}
        </Button>
      )}
    </div>
  );
}
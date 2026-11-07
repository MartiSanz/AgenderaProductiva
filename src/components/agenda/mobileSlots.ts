export type AvailableTime = { value: string; label: string };

export function visibleMobileSlots<T extends AvailableTime>(slots: T[], expanded: boolean, selected: string): T[] {
  const ordered = [...slots].sort((a, b) => a.value.localeCompare(b.value));
  if (expanded) return ordered;
  const first = ordered.slice(0, 3);
  const chosen = ordered.find((slot) => slot.value === selected);
  if (chosen && !first.some((slot) => slot.value === selected)) {
    first.splice(2, 1, chosen);
  }
  return first;
}

export function mobileSlotsKey(open: boolean, day: string, type: string, duration: number): string {
  return JSON.stringify([open, day, type, duration]);
}
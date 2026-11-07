// Visible date range of the agenda. Weeks run Monday→Sunday in every view.
export type AgendaView = "week" | "grid" | "month";

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function mondayOf(d: Date) {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  x.setHours(0, 0, 0, 0);
  return x;
}

/** start inclusive, end exclusive; `days` are exactly the columns/cells shown. */
export function visibleRangeFor(view: AgendaView, anchor: Date) {
  let start: Date;
  let count: number;
  if (view !== "month") {
    start = mondayOf(anchor);
    count = 7;
  } else {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const pad = (first.getDay() + 6) % 7;
    const total = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
    start = addDays(first, -pad);
    count = Math.ceil((pad + total) / 7) * 7;
  }
  const days = Array.from({ length: count }, (_, i) => addDays(start, i));
  return { start, end: addDays(start, count), days };
}

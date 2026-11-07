import { formatTime } from "@/lib/domain/availability";
import { Trash2 } from "lucide-react";

const DAY_BG = ["bg-day-1", "bg-day-2", "bg-day-3", "bg-day-4", "bg-day-5", "bg-day-6", "bg-day-1"];

const SLOT_MINUTES = 30;
const ROW_PX = 40;

function minutesOf(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}
function floorSlot(m: number) {
  return Math.floor(m / SLOT_MINUTES) * SLOT_MINUTES;
}
function ceilSlot(m: number) {
  return Math.ceil(m / SLOT_MINUTES) * SLOT_MINUTES;
}
function labelOf(m: number) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export type WeekGridDay = { date: Date; items: any[]; blocks: any[] };

export function WeekGrid({
  days,
  today,
  onSelect,
  onBlockSelect,
  timeOffFor = () => null,
  timeOffRangesFor = () => [],
  onDeleteTimeOff = () => {},
}: {
  days: WeekGridDay[];
  today: Date;
  onSelect: (appointment: any) => void;
  onBlockSelect?: (block: any) => void;
  timeOffFor?: (d: Date) => any;
  timeOffRangesFor?: (d: Date) => { id: string; start: string; end: string; summary: string }[];
  onDeleteTimeOff?: (id: string) => void;
}) {
  const timed: { day: number; start: number; end: number; row: any; kind: "appt" | "block" | "off" }[] = [];
  const allDayBlocks: { day: number; row: any }[] = [];

  days.forEach((d, dayIdx) => {
    for (const a of d.items) {
      const s = new Date(a.start_at);
      const e = new Date(a.end_at);
      timed.push({ day: dayIdx, start: minutesOf(s), end: Math.max(minutesOf(e), minutesOf(s) + SLOT_MINUTES), row: a, kind: "appt" });
    }
    for (const o of timeOffRangesFor(d.date)) {
      timed.push({ day: dayIdx, start: minutesOf(new Date(o.start)), end: minutesOf(new Date(o.end)), row: o, kind: "off" });
    }
    for (const b of d.blocks) {
      if (!b.start || String(b.start).length <= 10) {
        allDayBlocks.push({ day: dayIdx, row: b });
        continue;
      }
      const s = new Date(b.start);
      const e = b.end ? new Date(b.end) : new Date(s.getTime() + 30 * 60_000);
      timed.push({ day: dayIdx, start: minutesOf(s), end: Math.max(minutesOf(e), minutesOf(s) + SLOT_MINUTES), row: b, kind: "block" });
    }
  });

  const hasAny = timed.length > 0;
  const rawMin = hasAny ? Math.min(...timed.map((t) => t.start)) : 8 * 60;
  const rawMax = hasAny ? Math.max(...timed.map((t) => t.end)) : 14 * 60;
  const min = floorSlot(rawMin);
  const max = Math.max(ceilSlot(rawMax), min + SLOT_MINUTES);
  const rowCount = (max - min) / SLOT_MINUTES;
  const rows = Array.from({ length: rowCount }, (_, i) => min + i * SLOT_MINUTES);

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
      <div className="min-w-0">
        {/* Header */}
        <div
          className="grid border-b border-border"
          style={{ gridTemplateColumns: `var(--wg-time,44px) repeat(${days.length}, minmax(0, 1fr))` }}
        >
          <div />
          {days.map((d) => {
            const isToday = d.date.toDateString() === today.toDateString();
            const dayTimeOff = timeOffFor(d.date);
            return (
              <div key={d.date.toISOString()} className="min-w-0 px-0.5 py-3 text-center sm:px-2">
                <div className="text-xs font-medium capitalize text-muted-foreground">
                  {d.date.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", "")}
                </div>
                <div
                  className={`mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                    isToday ? "bg-primary text-primary-foreground" : "text-foreground"
                  }`}
                >
                  {d.date.getDate()}
                </div>
                {dayTimeOff && (
                  <button
                    type="button"
                    title={`Eliminar ausencia${dayTimeOff.reason ? `: ${dayTimeOff.reason}` : ""}`}
                    onClick={() => onDeleteTimeOff(dayTimeOff.id)}
                    className="mx-auto mt-1 flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 text-[11px] font-medium text-rose-800 hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-300"
                  >
                    Ausencia
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {allDayBlocks.length > 0 && (
          <div
            className="grid border-b border-border bg-muted/30"
            style={{ gridTemplateColumns: `var(--wg-time,44px) repeat(${days.length}, minmax(0, 1fr))` }}
          >
            <div className="px-2 py-2 text-right text-[11px] uppercase text-muted-foreground">Todo el día</div>
            {days.map((_, i) => (
              <div key={i} className="space-y-1 px-1 py-2">
                {allDayBlocks
                  .filter((b) => b.day === i)
                  .map((b, k) => (
                    <div
                      key={k}
                      className="truncate rounded-md border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground"
                    >
                      {b.row.summary || "Bloqueado"}
                    </div>
                  ))}
              </div>
            ))}
          </div>
        )}

        {/* Body */}
        <div
          className="relative grid"
          style={{
            gridTemplateColumns: `var(--wg-time,44px) repeat(${days.length}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rowCount}, ${ROW_PX}px)`,
          }}
        >
          {rows.map((m, i) => (
            <div
              key={`t-${m}`}
              className="border-b border-border/60 pr-1 pt-1 text-right font-mono text-[10px] sm:pr-2 sm:text-[11px] tabular-nums text-muted-foreground"
              style={{ gridColumn: 1, gridRow: i + 1 }}
            >
              {m % 60 === 0 ? labelOf(m) : ""}
            </div>
          ))}

          {rows.map((m, i) =>
            days.map((_, dayIdx) => (
              <div
                key={`c-${m}-${dayIdx}`}
                className={`border-b border-l border-border/60 ${m % 60 === 0 ? "" : "border-b-border/30"}`}
                style={{ gridColumn: dayIdx + 2, gridRow: i + 1 }}
              />
            )),
          )}

          {timed.map((t, idx) => {
            const startRow = Math.max(1, Math.round((t.start - min) / SLOT_MINUTES) + 1);
            const endRow = Math.min(rowCount + 1, Math.round((t.end - min) / SLOT_MINUTES) + 1);
            const a = t.row;
            if (t.kind === "off") {
              return (
                <button
                  key={`o-${idx}`}
                  type="button"
                  onClick={() => onDeleteTimeOff(a.id)}
                  className="z-10 m-0.5 flex cursor-pointer items-start justify-between gap-1 overflow-hidden rounded-lg border border-dashed border-destructive/40 bg-destructive/10 px-2 py-1 text-left text-[11px] leading-tight text-destructive transition-colors hover:bg-destructive/20"
                  style={{ gridColumn: t.day + 2, gridRow: `${startRow} / ${Math.max(endRow, startRow + 1)}` }}
                  title={`Eliminar ${a.summary}`}
                >
                  <span className="truncate font-medium">{a.summary}</span>
                  <Trash2 className="h-3 w-3 shrink-0" />
                </button>
              );
            }
            if (t.kind === "block") {
              return (
                <button
                  key={`b-${idx}`}
                  type="button"
                  onClick={() => onBlockSelect?.(a)}
                  className="z-10 m-0.5 cursor-pointer overflow-hidden rounded-lg border border-dashed border-border bg-muted/60 px-2 py-1 text-left text-[11px] leading-tight text-muted-foreground transition-colors hover:bg-muted/80"
                  style={{ gridColumn: t.day + 2, gridRow: `${startRow} / ${Math.max(endRow, startRow + 1)}` }}
                  title={`${formatTime(new Date(a.start))} · ${a.summary || "Bloqueado"}`}
                >
                  <div className="truncate font-medium">{a.summary || "Bloqueado"}</div>
                </button>
              );
            }
            const name = `${a.patient?.first_name ?? ""}`.trim() || "Turno";
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => onSelect(a)}
                className={`z-20 m-px min-w-0 overflow-hidden rounded-md px-1 py-0.5 sm:m-0.5 sm:rounded-lg sm:px-2 sm:py-1 text-left text-[11px] leading-tight text-background transition-opacity hover:opacity-90 ${DAY_BG[t.day % DAY_BG.length]}`}
                style={{ gridColumn: t.day + 2, gridRow: `${startRow} / ${Math.max(endRow, startRow + 1)}` }}
                title={`${formatTime(new Date(a.start_at))} · ${name}`}
              >
                <div className="truncate font-semibold">{name}</div>
                <div className="truncate opacity-90">{a.notes || formatTime(new Date(a.start_at))}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
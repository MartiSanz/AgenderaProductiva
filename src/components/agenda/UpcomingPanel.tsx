import { formatTime } from "@/lib/domain/availability";
import { ConfirmBadge } from "@/components/agenda/ConfirmBadge";
import { Button } from "@/components/ui/button";

const DOTS = ["bg-day-1", "bg-day-2", "bg-day-3", "bg-day-4", "bg-day-5", "bg-day-6"];

export function UpcomingPanel({
  appointments,
  onSelect,
  variant = "full",
  confirmed = true,
}: {
  appointments: any[];
  onSelect: (appointment: any) => void;
  variant?: "full" | "sidebar";
  confirmed?: boolean;
}) {
  const now = Date.now();
  const upcoming = appointments
    .filter((a) => new Date(a.start_at).getTime() >= now)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  const nameOf = (a: any) =>
    `${a.patient?.first_name ?? ""} ${a.patient?.last_name ?? ""}`.trim() || "Sin nombre";

  if (variant === "sidebar") {
    return (
      <section className="min-w-0" aria-label="Próximos turnos">
        <h2 className="upcoming-sidebar__title">Próximos turnos</h2>
        {upcoming.length === 0 ? (
          <p className="upcoming-sidebar__empty">{confirmed ? "No hay turnos próximos en este período." : "Cargando turnos…"}</p>
        ) : (
          <ul className="upcoming-sidebar__list">
            {upcoming.map((a) => {
              const d = new Date(a.start_at);
              const day = d.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", "");
              return (
                <li key={a.id}>
                  <button type="button" onClick={() => onSelect(a)} className="upcoming-sidebar__item">
                    <span className="upcoming-sidebar__meta">
                      <span className="capitalize">{day}</span> {d.getDate()} ·{" "}
                      <span className="tabular-nums">{formatTime(d)}</span>
                    </span>
                    <strong className="upcoming-sidebar__name">{nameOf(a)}</strong>
                    {a.appointment_type_name && (
                      <small className="upcoming-sidebar__meta">{a.appointment_type_name}</small>
                    )}
                    <ConfirmBadge appointment={a} className="mt-1 self-start" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    );
  }

  return (
    <section className="min-w-0" aria-label="Próximos turnos">
      <h2 className="text-base font-bold text-foreground">Próximos turnos</h2>
      {upcoming.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{confirmed ? "No hay turnos próximos en este período." : "Cargando turnos…"}</p>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {upcoming.map((a) => {
            const d = new Date(a.start_at);
            return (
              <li key={a.id}>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => onSelect(a)}
                  className="h-auto w-full min-w-0 flex-col items-stretch whitespace-normal rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${DOTS[d.getDay() % DOTS.length]}`} />
                    <span className="font-mono tabular-nums">{formatTime(d)}</span>
                    <span>·</span>
                    <span className="capitalize">{d.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", "")}</span>
                    <span>{d.toLocaleDateString("es-AR", { day: "numeric", month: "short" })}</span>
                  </div>
                  <div className="mt-1 truncate text-sm font-semibold text-foreground">{nameOf(a)}</div>
                  <ConfirmBadge appointment={a} className="mt-1" />
                  {a.notes && <div className="truncate text-xs text-muted-foreground">{a.notes}</div>}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

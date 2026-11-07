import { createFileRoute } from "@tanstack/react-router";
import "@/styles/landing.css";
import { CalendarCheck, CircleAlert, MapPin, Phone } from "lucide-react";
import { confirmAppointmentByToken } from "@/lib/api/confirm.functions";

export const Route = createFileRoute("/c/$token")({
  head: () => ({
    meta: [
      { title: "Confirmar turno — Agendera — La agenda que se maneja sola" },
      { name: "description", content: "Confirmá la asistencia a tu próximo turno con un solo clic desde el recordatorio." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Confirmar turno — Agendera — La agenda que se maneja sola" },
      { property: "og:description", content: "Confirmá la asistencia a tu próximo turno con un solo clic desde el recordatorio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ params }) => confirmAppointmentByToken({ data: { token: params.token } }),
  errorComponent: () => <Shell><Problem message="No pudimos procesar el link. Probá de nuevo más tarde." /></Shell>,
  notFoundComponent: () => <Shell><Problem message="El link no es válido." /></Shell>,
  component: ConfirmPage,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="zip-ui warm-ui warm-public grid place-items-center px-6 py-12">
      <div className="w-full max-w-md rounded-3xl border-2 border-border bg-card p-8 text-center shadow-sm">
        {children}
      </div>
    </main>
  );
}

function Problem({ message }: { message: string }) {
  return (
    <>
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-muted">
        <CircleAlert className="h-7 w-7 text-muted-foreground" />
      </div>
      <h1 className="text-xl font-bold text-foreground">Turno no disponible</h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </>
  );
}

function ConfirmPage() {
  const result = Route.useLoaderData();

  if (!result.ok) {
    const message =
      result.reason === "cancelled"
        ? "Este turno ya fue cancelado."
        : result.reason === "expired"
          ? "El link venció o el turno ya pasó."
          : "El link no es válido.";
    return (
      <Shell>
        <Problem message={message} />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-emerald-100">
        <CalendarCheck className="h-7 w-7 text-emerald-700" />
      </div>
      <h1 className="text-2xl font-bold text-foreground">
        {result.alreadyConfirmed ? "Tu turno ya estaba confirmado" : "¡Listo! Tu turno quedó confirmado"}
      </h1>
      <p className="mt-3 text-base font-semibold text-foreground">
        {[result.specialty, result.professional].filter(Boolean).join(" ")}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{result.when}</p>
      <div className="mt-6 space-y-2 text-sm text-muted-foreground">
        {result.address ? (
          <p className="inline-flex items-center justify-center gap-1.5">
            <MapPin className="h-4 w-4" />
            {result.address}
          </p>
        ) : null}
        {result.phone ? (
          <p className="inline-flex items-center justify-center gap-1.5">
            <Phone className="h-4 w-4" />
            {result.phone}
          </p>
        ) : null}
      </div>
    </Shell>
  );
}

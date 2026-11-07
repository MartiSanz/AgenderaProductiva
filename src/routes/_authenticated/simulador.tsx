import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Eye, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ProfessionalPortal } from "@/components/portal/PortalFlow";
import { createDemoPortalApi } from "@/components/portal/demoPortalApi";
import { getMyConfig } from "@/lib/api/config.functions";

export const Route = createFileRoute("/_authenticated/simulador")({
  component: PatientPortalDemoPage,
  head: () => ({
    meta: [
      { title: "Conoce el Portal Pacientes | Agendera — La agenda que se maneja sola" },
      {
        name: "description",
        content: "Conocé cómo funciona el portal de pacientes con una simulación interactiva.",
      },
      { property: "og:title", content: "Conocé el Portal Pacientes | Agendera — La agenda que se maneja sola" },
      {
        property: "og:description",
        content: "Conocé cómo funciona el portal de pacientes con una simulación interactiva.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function PatientPortalDemoPage() {
  const getConfig = useServerFn(getMyConfig);
  const { data: config } = useQuery({
    queryKey: ["config", "portal-demo"],
    queryFn: () => getConfig(),
  });

  const displayName = config?.display_name?.trim() || "tu nombre";
  const specialty = config?.specialty?.trim() || "Profesional";
  const address = config?.address?.trim() || "Calle Ejemplo 123";

  return (
    <div className="space-y-5">
      <div className="zip-ui warm-ui flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-day-2-soft px-3 py-1 text-xs font-semibold text-day-2">
            <Sparkles className="h-3.5 w-3.5" /> Función del plan Pro
          </div>
          <h1 className="text-2xl font-bold">Conocé el Portal Pacientes</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Mirá cómo tus pacientes pueden gestionar sus turnos desde tu enlace personal. Esta función está incluida en
            el plan Pro. Para esta demo usamos datos ficticios de pacientes, horarios y turnos.
          </p>
        </div>
      </div>

      <PortalDemo displayName={displayName} specialty={specialty} address={address} />
    </div>
  );
}

function PortalDemo({ displayName, specialty, address }: { displayName: string; specialty: string; address: string }) {
  const [session, setSession] = useState(0);
  const api = useMemo(() => createDemoPortalApi({ displayName, address }), [displayName, address, session]);
  const pro = { owner_id: "demo", display_name: displayName, specialty, address };

  return (
    <Card className="overflow-hidden rounded-2xl border-l-[6px] border-l-day-5">
      <div className="flex items-center justify-between border-b bg-day-5-soft px-4 py-2.5 text-xs text-muted-foreground sm:px-6">
        <span className="inline-flex items-center gap-1.5 font-semibold text-day-5">
          <Eye className="h-3.5 w-3.5" /> Así lo verá tu paciente
        </span>
        <span>Demo · no guarda cambios</span>
      </div>
      <CardContent className="bg-muted/40 p-4 sm:p-8">
        <div className="portal-shell mx-auto w-full max-w-[40rem]">
          <ProfessionalPortal
            key={session}
            pro={pro}
            api={api}
            embedded
            lockedToPro
            onExit={() => setSession((n) => n + 1)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ProfessionalPortal, Shell, type Pro } from "@/components/portal/PortalFlow";
import "@/styles/landing.css";
import agenderaMark from "@/assets/agendera-mark.png";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, CalendarPlus, Search, Loader2, MapPin, Calendar, CalendarCheck, CalendarX2, CalendarClock, CircleCheck, type LucideIcon } from "lucide-react";
import { placeForSlot, type Place } from "@/components/agenda/slotLocation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateLong, formatTime } from "@/lib/domain/availability";
import {
  getProfessional,
  listProfessionals,
  listSpecialties,
  portalAppointmentTypes,
  portalAvailability,
  portalBook,
  portalCancel,
  portalLookupPatient,
  portalReschedule,
} from "@/lib/api/portal.functions";

export const Route = createFileRoute("/portal")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { pro?: string } => {
    const pro = typeof search.pro === "string" ? search.pro : "";
    return pro ? { pro } : {};
  },
  // El portal público (buscador/listado) está oculto por ahora: solo se entra
  // con el link personal de cada profesional (/portal?pro=<id>).
  beforeLoad: ({ search }) => {
    if (!search.pro) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Portal de pacientes — Agendera — La agenda que se maneja sola" },
      { name: "description", content: "Portal de pacientes: reservá, consultá, reprogramá o cancelá tu turno con tu profesional en pocos pasos." },
      { property: "og:title", content: "Portal de pacientes — Agendera — La agenda que se maneja sola" },
      { property: "og:description", content: "Portal de pacientes: reservá, consultá, reprogramá o cancelá tu turno con tu profesional en pocos pasos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortalPage,
});

function PortalPage() {
  const { pro: proId } = Route.useSearch();
  const details = useServerFn(getProfessional);
  const [pro, setPro] = useState<Pro | null>(null);
  const [loadingPro, setLoadingPro] = useState(Boolean(proId));

  useEffect(() => {
    if (!proId) return;
    let alive = true;
    setLoadingPro(true);
    details({ data: { ownerId: proId } })
      .then((p: any) => {
        if (!alive) return;
        setPro({
          owner_id: p.owner_id,
          display_name: p.display_name,
          specialty: p.specialty ?? "",
          address: p.address ?? "",
        });
      })
      .catch(() => alive && toast.error("No pudimos abrir la agenda de ese profesional."))
      .finally(() => alive && setLoadingPro(false));
    return () => {
      alive = false;
    };
  }, [proId, details]);

  if (loadingPro)
    return (
      <Shell title="Gestioná tu turno">
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </Shell>
    );
  if (!pro)
    return (
      <Shell title="Gestioná tu turno" subtitle="Necesitás el link de tu profesional">
        <p className="text-muted-foreground">Pedile a tu profesional el link para reservar turnos.</p>
        <Link to="/" className="mt-4 inline-block text-sm text-primary underline">
          Ir al inicio
        </Link>
      </Shell>
    );
  return <ProfessionalPortal pro={pro} onExit={() => setPro(null)} lockedToPro={Boolean(proId)} />;
}

function Directory({ onPick }: { onPick: (p: Pro) => void }) {
  const search = useServerFn(listProfessionals);
  const specialties = useServerFn(listSpecialties);
  const [q, setQ] = useState("");
  const [specialty, setSpecialty] = useState("todas");
  const [rows, setRows] = useState<Pro[]>([]);
  const [opts, setOpts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    specialties({})
      .then(setOpts)
      .catch(() => setOpts([]));
  }, [specialties]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      search({ data: { q, specialty: specialty === "todas" ? "" : specialty } })
        .then((r) => alive && setRows(r as Pro[]))
        .catch(() => alive && setRows([]))
        .finally(() => alive && setLoading(false));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, specialty, search]);

  return (
    <Shell title="Gestioná tu turno" subtitle="Buscá a tu profesional para gestionar tus turnos.">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o profesión"
            className="pl-9"
          />
        </div>
        <Select value={specialty} onValueChange={setSpecialty}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="Profesión" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las profesiones</SelectItem>
            {opts.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">No encontramos profesionales con esa búsqueda.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((p) => (
            <button
              key={p.owner_id}
              onClick={() => onPick(p)}
              className="flex w-full items-center gap-3 portal-row text-left"
            >
              <div className="portal-avatar">
                {p.display_name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.display_name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {[p.specialty, p.address].filter(Boolean).join(" · ") || "Profesional"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </Shell>
  );
}


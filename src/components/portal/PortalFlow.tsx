import { Link } from "@tanstack/react-router";
import { PhoneInput } from "@/components/PhoneInput";
import "@/styles/landing.css";
import agenderaMark from "@/assets/agendera-mark.png";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, CalendarPlus, Search, Loader2, MapPin, Calendar, CalendarCheck, CalendarX2, CalendarClock, CircleCheck, type LucideIcon } from "lucide-react";
import { placeForSlot, type Place } from "@/components/agenda/slotLocation";
import { bookableLocations } from "@/lib/domain/dateBlocks";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateLong, formatTime } from "@/lib/domain/availability";
import {
  getProfessional,
  portalAppointmentTypes,
  portalAvailability,
  portalBook,
  portalCancel,
  portalLookupPatient,
  portalReschedule,
} from "@/lib/api/portal.functions";

/** Funciones del portal; la demo del profesional inyecta versiones ficticias. */
export type PortalApi = {
  availability: (a: { data: any }) => Promise<any>;
  types: (a: { data: any }) => Promise<any>;
  lookup: (a: { data: any }) => Promise<any>;
  book: (a: { data: any }) => Promise<any>;
  cancel: (a: { data: any }) => Promise<any>;
  reschedule: (a: { data: any }) => Promise<any>;
  details: (a: { data: any }) => Promise<any>;
};

// Embebido (demo): se muestra solo la tarjeta, sin la barra superior pública.
const EmbeddedCtx = createContext(false);

export type Pro = { owner_id: string; display_name: string; specialty: string; address: string };
type Slot = { startISO: string; endISO: string; label: string };
type Day = { date: string; slots: Slot[] };
type Appt = { id: string; start_at: string; end_at: string; appointment_type_id?: string | null };
type ApptType = { id: string; name: string; duration_minutes: number };
type ProExtra = { schedule: any[]; locations: any[]; timezone: string };
type Step =
  | "menu"
  | "sede"
  | "tipo"
  | "dni"
  | "datos"
  | "slots"
  | "resumen"
  | "appts"
  | "limite"
  | "confirmado"
  | "cancelado"
  | "como_llegar";
type Flow = "reservar" | "ver" | "cancelar" | "reprogramar";

const TITLES: Record<Flow, string> = {
  reservar: "Reservar un turno",
  ver: "Tus turnos",
  cancelar: "Cancelar un turno",
  reprogramar: "Reprogramar turno",
};

export function Shell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const embedded = useContext(EmbeddedCtx);
  const card = (
    <div className="portal-card">
      <div className="portal-card__head">
        <div className="portal-card__icon" aria-hidden="true">
          <Calendar />
        </div>
        <div className="min-w-0">
          <h1 className="portal-card__title">{title}</h1>
          {subtitle ? <p className="portal-card__subtitle">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </div>
  );
  if (embedded) return card;
  return (
    <div className="app-shell portal-shell">
      <header className="app-header">
        <div className="section-shell">
          <div className="app-header__row">
            <Link to="/" className="brand" aria-label="Ir al inicio">
              <img src={agenderaMark} alt="" className="brand__logo" />
              <span className="app-header__brand-text">
                <strong>Agendera</strong>
                <small>Portal de pacientes</small>
              </span>
            </Link>
            <Link to="/" className="button button--secondary button--sm">
              Inicio
            </Link>
          </div>
        </div>
      </header>
      <main className="portal-main">
        <div className="portal-card">
          <div className="portal-card__head">
            <div className="portal-card__icon" aria-hidden="true">
              <Calendar />
            </div>
            <div className="min-w-0">
              <h1 className="portal-card__title">{title}</h1>
              {subtitle ? <p className="portal-card__subtitle">{subtitle}</p> : null}
            </div>
          </div>
          {children}
        </div>
      </main>
      <footer className="flex flex-col items-center gap-1 px-4 pb-8 pt-2 text-center text-xs text-muted-foreground">
        <span>Agendera | Desarrollado por Martina Sanz</span>
        <span className="inline-flex items-center gap-1.5">
        Si te gustó este sistema, contáctame!
        <a
          href="https://wa.me/5492281565356"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Escribir a Martina Sanz por WhatsApp"
          className="inline-flex items-center transition-opacity hover:opacity-80"
          style={{ color: "#25D366" }}
        >
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true">
            <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.57.94.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.23-9.43 9.44-9.43 2.52 0 4.89.98 6.67 2.77a9.37 9.37 0 0 1 2.76 6.67c0 5.2-4.23 9.43-9.44 9.43zm8.03-17.46A11.27 11.27 0 0 0 12.05.72C5.8.72.7 5.8.7 12.06c0 2 .52 3.95 1.52 5.67L.6 23.28l5.68-1.49a11.3 11.3 0 0 0 5.77 1.47c6.26 0 11.35-5.09 11.35-11.34 0-3.03-1.18-5.88-3.32-8.02z" />
          </svg>
        </a>
        </span>
      </footer>
    </div>
  );
}

export function Row({
  label,
  description,
  icon: Icon,
  onClick,
  primary = false,
}: {
  label: string;
  description: string;
  icon: LucideIcon;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button onClick={onClick} className={`portal-action ${primary ? "portal-action--primary" : ""}`}>
      <span className="portal-action__icon" aria-hidden="true">
        <Icon strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="portal-action__label">{label}</span>
        <span className="portal-action__desc">{description}</span>
      </span>
      <ChevronRight className="portal-action__arrow" aria-hidden="true" />
    </button>
  );
}

export function ProfessionalPortal(props: {
  pro: Pro;
  onExit: () => void;
  lockedToPro?: boolean;
  api?: PortalApi;
  embedded?: boolean;
}) {
  return (
    <EmbeddedCtx.Provider value={Boolean(props.embedded)}>
      <ProfessionalPortalInner {...props} />
    </EmbeddedCtx.Provider>
  );
}

function ProfessionalPortalInner({
  pro,
  onExit,
  lockedToPro = false,
  api,
}: {
  pro: Pro;
  onExit: () => void;
  lockedToPro?: boolean;
  api?: PortalApi;
}) {
  const real: PortalApi = {
    availability: useServerFn(portalAvailability),
    types: useServerFn(portalAppointmentTypes),
    lookup: useServerFn(portalLookupPatient),
    book: useServerFn(portalBook),
    cancel: useServerFn(portalCancel),
    reschedule: useServerFn(portalReschedule),
    details: useServerFn(getProfessional),
  };
  const fns = api ?? real;
  const availability = fns.availability;
  const typesFn = fns.types;
  const lookup = fns.lookup;
  const book = fns.book;
  const cancel = fns.cancel;
  const reschedule = fns.reschedule;
  const details = fns.details;

  const [step, setStep] = useState<Step>("menu");
  const [flow, setFlow] = useState<Flow>("reservar");
  const [busy, setBusy] = useState(false);
  const [dni, setDni] = useState("");
  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", email: "" });
  const [patientName, setPatientName] = useState("");
  const who = { first_name: form.first_name, last_name: form.last_name, phone: form.phone };
  const whoReady = form.first_name.trim().length >= 2 && form.last_name.trim().length >= 2 && form.phone.length >= 6;
  const [appts, setAppts] = useState<Appt[]>([]);
  const [maxActive, setMaxActive] = useState(1);
  const [targetAppt, setTargetAppt] = useState<Appt | null>(null);
  const [days, setDays] = useState<Day[]>([]);
  const [nextFrom, setNextFrom] = useState<string | null>(null);
  const [currentFrom, setCurrentFrom] = useState<string | undefined>(undefined);
  const [fromHistory, setFromHistory] = useState<string[]>([]);
  const [confirmedISO, setConfirmedISO] = useState("");
  const [types, setTypes] = useState<ApptType[]>([]);
  const [selectedType, setSelectedType] = useState<ApptType | null>(null);
  const [place, setPlace] = useState<{ address: string; maps_url: string; name: string; city?: string } | null>(null);
  const [pendingSlot, setPendingSlot] = useState<Slot | null>(null);
  const [summaryPlace, setSummaryPlace] = useState<Place | null>(null);
  const [proExtra, setProExtra] = useState<ProExtra | null>(null);
  const [sedes, setSedes] = useState<any[]>([]);
  const [selectedLoc, setSelectedLoc] = useState<any | null>(null);
  const [dirLocs, setDirLocs] = useState<any[]>([]);

  const title = step === "menu" ? "Mis turnos" : step === "como_llegar" ? "Cómo llegar" : step === "resumen" ? "Resumen del turno" : TITLES[flow];

  function reset() {
    setStep("menu");
    setDni("");
    setForm({ first_name: "", last_name: "", phone: "", email: "" });
    setAppts([]);
    setTargetAppt(null);
    setDays([]);
    setNextFrom(null);
    setCurrentFrom(undefined);
    setFromHistory([]);
    setSelectedType(null);
    setPendingSlot(null);
    setSummaryPlace(null);
    setSelectedLoc(null);
  }

  async function loadExtra(): Promise<ProExtra> {
    if (proExtra) return proExtra;
    const d: any = await details({ data: { ownerId: pro.owner_id } });
    const extra = { schedule: d.schedule ?? [], locations: d.locations ?? [], timezone: d.timezone ?? "" };
    setProExtra(extra);
    return extra;
  }

  function afterSede(rows: ApptType[]) {
    if (rows.length === 0) {
      setSelectedType(null);
      setStep("dni");
    } else {
      setStep("tipo");
    }
  }

  async function startBooking() {
    setFlow("reservar");
    setBusy(true);
    try {
      const rows = (await typesFn({ data: { ownerId: pro.owner_id } })) as ApptType[];
      setTypes(rows);
      // Con más de una sede, el paciente elige primero dónde quiere el turno.
      let options: any[] = [];
      try {
        const extra = await loadExtra();
        const today = new Date().toLocaleDateString("en-CA", { timeZone: extra.timezone || "America/Argentina/Buenos_Aires" });
        options = bookableLocations(extra.locations, extra.schedule, today);
      } catch {
        options = [];
      }
      setSedes(options);
      setSelectedLoc(options.length === 1 ? options[0] : null);
      if (options.length > 1) setStep("sede");
      else afterSede(rows);
    } catch {
      setTypes([]);
      setStep("dni");
    } finally {
      setBusy(false);
    }
  }

  async function loadSlots(
    from?: string,
    direction: "forward" | "back" = "forward",
    opts?: { flow?: string; appt?: Appt | null },
  ) {
    // Flow/appt are passed explicitly when called right after setState, so a
    // reschedule never runs with the stale "reservar" flow of the closure.
    const f = opts?.flow ?? flow;
    const appt = opts && "appt" in opts ? opts.appt : targetAppt;
    const typeId = f === "reservar" ? selectedType?.id : f === "reprogramar" ? appt?.appointment_type_id ?? undefined : undefined;
    setBusy(true);
    try {
      const res = (await availability({
        data: {
          ownerId: pro.owner_id,
          count: 3,
          ...(from ? { from } : {}),
          ...(typeId ? { typeId } : {}),
          ...(f === "reservar" && selectedLoc ? { locationId: selectedLoc.id } : {}),
        },
      })) as {
        days: Day[];
        nextFrom: string | null;
      };
      setDays(res.days);
      setNextFrom(res.nextFrom);
      if (direction === "forward") {
        if (from) {
          setFromHistory((h) => [...h, currentFrom ?? ""]);
        }
      } else {
        setFromHistory((h) => h.slice(0, -1));
      }
      setCurrentFrom(from);
      setStep("slots");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos cargar los horarios.");
    } finally {
      setBusy(false);
    }
  }

  function goBackDates() {
    const prev = fromHistory[fromHistory.length - 1];
    if (prev === undefined) return;
    loadSlots(prev || undefined, "back");
  }

  async function submitDni() {
    setBusy(true);
    try {
      const res: any = await lookup({ data: { ownerId: pro.owner_id, who } });
      if (res.blocked) {
        if (res.absences) {
          toast.error("No podés reservar turnos online por ausencias sin aviso. Contactá al profesional.");
          return;
        }
        toast.error("Este profesional solo atiende pacientes habilitados. Contactalo directamente.");
        return;
      }
      if (!res.found) {
        if (flow === "reservar") {
          setStep("datos");
        } else {
          toast.error("No encontramos turnos con esos datos.");
        }
        return;
      }
      setPatientName(`${res.patient.first_name} ${res.patient.last_name}`);
      setAppts(res.appointments as Appt[]);
      setMaxActive(res.maxActive ?? 1);
      if (flow === "reservar") {
        if ((res.appointments as Appt[]).length >= (res.maxActive ?? 1)) {
          setStep("limite");
          return;
        }
        await loadSlots();
      } else {
        if ((res.appointments as Appt[]).length === 0) {
          toast.error("No tenés turnos activos con este profesional.");
          return;
        }
        setStep("appts");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Revisá los datos ingresados.");
    } finally {
      setBusy(false);
    }
  }

  async function chooseSlot(slot: Slot) {
    setBusy(true);
    try {
      const extra = await loadExtra();
      const duration =
        selectedType?.duration_minutes ||
        Math.max(5, Math.round((new Date(slot.endISO).getTime() - new Date(slot.startISO).getTime()) / 60000));
      // Lugar de atención del resumen: solo franjas del día elegido que cubren
      // la hora; luego la única ubicación registrada; luego la dirección.
      const resolved = placeForSlot({
        startIso: slot.startISO,
        durationMinutes: duration,
        schedule: extra.schedule,
        locations: extra.locations,
        timezone: extra.timezone,
        fallbackAddress: pro.address,
        dayKey: dayKeyOf(slot.startISO, extra.timezone),
      });
      setSummaryPlace(resolved);
      setPendingSlot(slot);
      setStep("resumen");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos preparar el resumen del turno.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmSlot() {
    const slot = pendingSlot;
    if (!slot) return;
    setBusy(true);
    try {
      if (flow === "reprogramar" && targetAppt) {
        await reschedule({
          data: {
            ownerId: pro.owner_id,
            who,
            appointmentId: targetAppt.id,
            startISO: slot.startISO,
            endISO: slot.endISO,
          },
        });
      } else {
        await book({
          data: {
            ownerId: pro.owner_id,
            who,
            startISO: slot.startISO,
            endISO: slot.endISO,
            ...(selectedType ? { typeId: selectedType.id } : {}),
            patient: { dni, email: form.email },
          },
        });
      }
      setConfirmedISO(slot.startISO);
      setPendingSlot(null);
      setSummaryPlace(null);
      setStep("confirmado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos confirmar el turno.");
    } finally {
      setBusy(false);
    }
  }

  async function doCancel(appt: Appt) {
    setBusy(true);
    try {
      await cancel({ data: { ownerId: pro.owner_id, who, appointmentId: appt.id } });
      setConfirmedISO(appt.start_at);
      setStep("cancelado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos cancelar el turno.");
    } finally {
      setBusy(false);
    }
  }

  async function openDirections() {
    setBusy(true);
    try {
      const d: any = await details({ data: { ownerId: pro.owner_id } });
      const locs: any[] = d.locations ?? [];
      setDirLocs(locs);
      if (locs.length > 1) {
        setPlace(null);
      } else {
        const loc = locs[0];
        setPlace({
          name: loc?.name ?? d.display_name,
          address: loc?.address || d.address || "",
          maps_url: loc?.maps_url || d.maps_url || "",
        });
      }
      setStep("como_llegar");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos cargar la dirección.");
    } finally {
      setBusy(false);
    }
  }

  function goBack() {
    if (step === "dni") {
      if (flow === "reservar" && types.length > 0) {
        setStep("tipo");
        return;
      }
      if (flow === "reservar" && sedes.length > 1) {
        setStep("sede");
        return;
      }
      reset();
      return;
    }
    if (step === "datos") {
      setStep("dni");
      return;
    }
    if (step === "resumen") {
      setStep("slots");
      return;
    }
    if (step === "slots") {
      if (flow === "reprogramar" && targetAppt) {
        setStep("appts");
        return;
      }
      setStep("dni");
      return;
    }
    if (step === "appts" || step === "limite") {
      setStep("dni");
      return;
    }
    if (step === "tipo" && sedes.length > 1) {
      setStep("sede");
      return;
    }
    if (step === "sede" || step === "tipo" || step === "como_llegar") {
      reset();
      return;
    }
    reset();
  }

  const back = (
    <button
      onClick={goBack}
      className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="h-4 w-4" /> Volver
    </button>
  );

  return (
    <Shell
      title={title}
      subtitle={`${pro.display_name}${pro.specialty ? ` · ${pro.specialty}` : ""}`}
    >
      {step === "menu" ? (
        <>
          <div className="space-y-2.5">
            <Row primary icon={CalendarPlus} label="Reservar un turno" description="Elegí día y horario disponible" onClick={startBooking} />
            <Row
              icon={CalendarCheck}
              label="Ver mis turnos"
              description="Consultá tus turnos reservados"
              onClick={() => {
                setFlow("ver");
                setStep("dni");
              }}
            />
            <Row
              icon={CalendarX2}
              label="Cancelar un turno"
              description="Liberá un turno que no vas a usar"
              onClick={() => {
                setFlow("cancelar");
                setStep("dni");
              }}
            />
            <Row
              icon={CalendarClock}
              label="Reprogramar un turno"
              description="Cambiá la fecha o el horario"
              onClick={() => {
                setFlow("reprogramar");
                setStep("dni");
              }}
            />
            <Row icon={MapPin} label="Cómo llegar" description="Dirección y mapa del consultorio" onClick={openDirections} />
          </div>
          {!lockedToPro ? (
            <Button variant="ghost" className="mt-5 w-full" onClick={onExit}>
              Elegir otro profesional
            </Button>
          ) : null}
        </>
      ) : null}

      {step === "sede" ? (
        <>
          {back}
          <p className="mb-3">¿Dónde querés tu turno?</p>
          <div className="space-y-3">
            {sedes.map((l) => (
              <button
                key={l.id}
                disabled={busy}
                onClick={() => {
                  setSelectedLoc(l);
                  afterSede(types);
                }}
                className="flex w-full items-center gap-3 portal-row text-left"
              >
                <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{l.city || l.name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {[l.city ? l.name : "", l.address].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </>
      ) : null}

      {step === "tipo" ? (
        <>
          {back}
          <p className="mb-3">¿Qué tipo de turno necesitás?</p>
          <div className="space-y-3">
            {types.map((t) => (
              <button
                key={t.id}
                disabled={busy}
                onClick={() => {
                  setSelectedType(t);
                  setStep("dni");
                }}
                className="flex w-full items-center gap-3 portal-row text-left"
              >
                <span className="flex-1 font-medium">{t.name}</span>
                <span className="text-sm text-muted-foreground">{t.duration_minutes} min</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </>
      ) : null}

      {step === "dni" ? (
        <>
          {back}
          <p className="mb-3">
            {flow === "reservar" ? "Ingresá tus datos para continuar." : "Ingresá tus datos para ver tus turnos."}
          </p>
          <div className="mb-4 space-y-3">
            <Field label="Nombre" required>
              <Input
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                className="h-12"
              />
            </Field>
            <Field label="Apellido" required>
              <Input
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                className="h-12"
              />
            </Field>
            <Field label="Teléfono" required>
              <PhoneInput value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            </Field>
            {flow === "reservar" ? (
              <Field label="DNI">
                <Input
                  inputMode="numeric"
                  value={dni}
                  onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
                  className="h-12"
                />
              </Field>
            ) : null}
          </div>
          <Button className="h-12 w-full" disabled={busy || !whoReady} onClick={submitDni}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : flow === "reservar" ? (
              "Continuar"
            ) : (
              "Buscar mis turnos"
            )}
          </Button>
        </>
      ) : null}

      {step === "datos" ? (
        <>
          {back}
          <p className="mb-4">Es tu primera reserva. Podés agregar estos datos si querés.</p>
          <div className="space-y-3">
            <Input
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <Button
            className="mt-4 h-12 w-full"
            disabled={busy}
            onClick={() => loadSlots()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ver horarios disponibles"}
          </Button>
        </>
      ) : null}

      {step === "appts" ? (
        <>
          {back}
          {patientName ? (
            <p className="mb-1">
              Hola, <span className="font-semibold">{patientName}</span>.
            </p>
          ) : null}
          <p className="mb-4 text-muted-foreground">Estos son tus turnos activos:</p>
          <div className="space-y-3">
            {appts.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 portal-row">
                <div className="flex-1">
                  <p className="font-medium capitalize">{formatDateLong(new Date(a.start_at))}</p>
                  <p className="text-sm text-muted-foreground">{formatTime(new Date(a.start_at))} hs</p>
                </div>
                {flow !== "cancelar" ? (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setFlow("reprogramar");
                      setTargetAppt(a);
                      loadSlots(undefined, "forward", { flow: "reprogramar", appt: a });
                    }}
                  >
                    Reprogramar
                  </Button>
                ) : null}
                {flow !== "ver" ? (
                  <Button variant="destructive" disabled={busy} onClick={() => doCancel(a)}>
                    Cancelar
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
          <Button variant="outline" className="mt-4 h-12 w-full" onClick={reset}>
            Volver al menú
          </Button>
        </>
      ) : null}

      {step === "limite" ? (
        <>
          {back}
          {patientName ? (
            <p className="mb-1">
              Hola, <span className="font-semibold">{patientName}</span>.
            </p>
          ) : null}
          <div className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
            Ya tenés {appts.length} turno{appts.length === 1 ? "" : "s"} reservado
            {appts.length === 1 ? "" : "s"}: podés reprogramar{appts.length === 1 ? "lo" : "los"} o cancelar
            {appts.length === 1 ? "lo" : "los"} para elegir otro horario.
          </div>
          <div className="space-y-3">
            {appts.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 portal-row">
                <div className="flex-1">
                  <p className="font-medium capitalize">{formatDateLong(new Date(a.start_at))}</p>
                  <p className="text-sm text-muted-foreground">{formatTime(new Date(a.start_at))} hs</p>
                </div>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setFlow("reprogramar");
                    setTargetAppt(a);
                    loadSlots(undefined, "forward", { flow: "reprogramar", appt: a });
                  }}
                >
                  Reprogramar
                </Button>
                <Button variant="destructive" disabled={busy} onClick={() => doCancel(a)}>
                  Cancelar
                </Button>
              </div>
            ))}
          </div>
          <Button variant="outline" className="mt-4 h-12 w-full" onClick={reset}>
            Volver al menú
          </Button>
        </>
      ) : null}

      {step === "slots" ? (
        <>
          {back}
          {flow === "reservar" && selectedType ? (
            <p className="mb-2 text-sm text-muted-foreground">
              Tipo de turno: <span className="font-medium text-foreground">{selectedType.name}</span> ·{" "}
              {selectedType.duration_minutes} min
            </p>
          ) : null}
          <p className="mb-4">Seleccioná un día y horario disponible.</p>
          {days.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">No hay horarios disponibles por ahora.</p>
          ) : (
            <div className="space-y-4">
              {days.map((d) => (
                <div key={d.date} className="portal-day">
                  <p className="mb-3 font-semibold capitalize">{formatDateLong(new Date(`${d.date}T00:00:00`))}</p>
                  <div className="flex flex-wrap gap-2">
                    {d.slots.map((s) => (
                      <Button key={s.startISO} variant="outline" size="sm" disabled={busy} onClick={() => chooseSlot(s)}>
                        {s.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {fromHistory.length > 0 ? (
            <Button variant="outline" className="mt-4 h-12 w-full" disabled={busy} onClick={goBackDates}>
              Ver fechas anteriores
            </Button>
          ) : null}
          {nextFrom ? (
            <Button variant="outline" className="mt-4 h-12 w-full" disabled={busy} onClick={() => loadSlots(nextFrom)}>
              Ver más fechas
            </Button>
          ) : null}
        </>
      ) : null}

      {step === "resumen" && pendingSlot ? (
        <>
          {back}
          <p className="mb-4">Revisá los datos de tu turno antes de confirmar.</p>
          <div className="portal-day px-4 py-3">
            <SummaryRow
              label="Profesional"
              value={`${pro.display_name}${pro.specialty ? ` · ${pro.specialty}` : ""}`}
            />
            {flow === "reprogramar" ? (
              <SummaryRow label="Cambio" value="Reprogramación de tu turno" />
            ) : selectedType ? (
              <SummaryRow
                label="Tipo de turno"
                value={`${selectedType.name} · ${selectedType.duration_minutes} min`}
              />
            ) : null}
            <SummaryRow label="Fecha" value={formatDateLong(new Date(pendingSlot.startISO))} capitalize />
            <SummaryRow label="Hora" value={`${formatTime(new Date(pendingSlot.startISO))} hs`} />
            {summaryPlace ? (
              <SummaryRow
                label="Lugar"
                value={summaryPlace.address ? `${summaryPlace.name} — ${summaryPlace.address}` : summaryPlace.name}
              />
            ) : null}
          </div>
          <Button className="mt-4 h-12 w-full" disabled={busy} onClick={confirmSlot}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : flow === "reprogramar" ? (
              "Confirmar cambio"
            ) : (
              "Confirmar turno"
            )}
          </Button>
          <Button variant="outline" className="mt-2 h-12 w-full" disabled={busy} onClick={() => setStep("slots")}>
            Volver a los horarios
          </Button>
        </>
      ) : null}

      {step === "confirmado" ? (
        <>
          <p className="mb-2 flex items-start gap-2 text-lg font-semibold">
            <CircleCheck className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <span>Turno reservado para <span className="capitalize">{formatDateLong(new Date(confirmedISO))}</span>{" "}
            {formatTime(new Date(confirmedISO))}</span>
          </p>
          <p className="mb-5 text-muted-foreground">Te esperamos. Si no podés asistir, cancelalo desde este portal.</p>
          <Button className="h-12 w-full" onClick={reset}>
            Volver al menú principal
          </Button>
        </>
      ) : null}

      {step === "cancelado" ? (
        <>
          <p className="mb-2 flex items-start gap-2 text-lg font-semibold">
            <CalendarX2 className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>Turno cancelado: <span className="capitalize">{formatDateLong(new Date(confirmedISO))}</span>{" "}
            {formatTime(new Date(confirmedISO))}</span>
          </p>
          <p className="mb-5 text-muted-foreground">Podés reservar uno nuevo cuando quieras.</p>
          <Button className="h-12 w-full" onClick={reset}>
            Volver al menú principal
          </Button>
        </>
      ) : null}

      {step === "como_llegar" ? (
        <>
          {place || dirLocs.length <= 1 ? (
            <>
              {dirLocs.length > 1 ? (
                <button
                  onClick={() => setPlace(null)}
                  className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="h-4 w-4" /> Volver
                </button>
              ) : (
                back
              )}
              <MapBlock place={place} />
            </>
          ) : (
            <>
              {back}
              <p className="mb-3">¿Qué sede querés ver?</p>
              <div className="space-y-3">
                {dirLocs.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setPlace({ name: l.city || l.name, address: l.address || "", city: l.city || "", maps_url: l.maps_url || "" })}
                    className="flex w-full items-center gap-3 portal-row text-left"
                  >
                    <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{l.city || l.name}</span>
                      <span className="block text-sm text-muted-foreground">
                        {[l.city ? l.name : "", l.address].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </>
          )}
          <Button variant="outline" className="mt-4 h-12 w-full" onClick={reset}>
            Volver al menú
          </Button>
        </>
      ) : null}
    </Shell>
  );
}

function MapBlock({ place }: { place: { address: string; maps_url: string; name: string; city?: string } | null }) {
  const query = [place?.address, place?.city].filter(Boolean).join(", ") + (place?.city ? ", Argentina" : "");
  const embed = useMemo(
    () => (place?.address ? `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed` : ""),
    [place?.address, query],
  );
  if (!place?.address)
    return <p className="text-muted-foreground">El profesional todavía no cargó la dirección del consultorio.</p>;
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 portal-row">
        <MapPin className="mt-0.5 h-5 w-5 text-primary" />
        <div>
          <p className="font-semibold">{place.name}</p>
          <p className="text-muted-foreground">{place.address}</p>
        </div>
      </div>
      <iframe
        title="Mapa del consultorio"
        src={embed}
        className="h-64 w-full rounded-2xl border"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <a
        href={place.maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`}
        target="_blank"
        rel="noreferrer"
        className="block"
      >
        <Button variant="outline" className="h-12 w-full">
          Abrir en Google Maps
        </Button>
      </a>
    </div>
  );
}

function SummaryRow({ label, value, capitalize = false }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-right text-sm font-medium ${capitalize ? "capitalize" : ""}`}>{value}</span>
    </div>
  );
}

/** Calendar day of an instant ("YYYY-MM-DD") in the professional's timezone. */
function dayKeyOf(iso: string, timezone?: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone || undefined }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/** Campo con etiqueta; el asterisco marca los obligatorios. */
function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="portal-field__label">
        {label}
        {required ? (
          <>
            <span className="portal-field__req" aria-hidden="true">
              {" "}
              *
            </span>
            <span className="sr-only"> (obligatorio)</span>
          </>
        ) : null}
      </span>
      {children}
    </label>
  );
}

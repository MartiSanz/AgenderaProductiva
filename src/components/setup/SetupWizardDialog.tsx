import { safeGet, safeSet } from "@/lib/safeStorage";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhoneInput } from "@/components/PhoneInput";
import { getMyConfig, updateMyConfig } from "@/lib/api/config.functions";
import { getMyLocations, saveLocation } from "@/lib/api/locations.functions";
import { getMyAppointmentTypes, saveAppointmentType } from "@/lib/api/appointmentTypes.functions";
import { getMySchedule, replaceMySchedule, getMyDateBlocks } from "@/lib/api/schedule.functions";
import { getCalendarConnectionStatus } from "@/lib/api/calendar.functions";
import { isSetupComplete, setupSteps, type SetupStepId } from "@/lib/setupStatus";

const STEPS: { id: SetupStepId; label: string }[] = [
  { id: "perfil", label: "1. Perfil" },
  { id: "lugar", label: "2. Lugar" },
  { id: "turnos", label: "3. Turnos" },
  { id: "horarios", label: "4. Horarios" },
  { id: "calendario", label: "5. Calendario" },
];
const WEEK = [
  { d: 1, l: "Lun" }, { d: 2, l: "Mar" }, { d: 3, l: "Mié" }, { d: 4, l: "Jue" },
  { d: 5, l: "Vie" }, { d: 6, l: "Sáb" }, { d: 0, l: "Dom" },
];
const SNOOZE_KEY = "agendera-setup-snoozed";

export function SetupWizardDialog() {
  const qc = useQueryClient();
  const cfgFn = useServerFn(getMyConfig);
  const locFn = useServerFn(getMyLocations);
  const typFn = useServerFn(getMyAppointmentTypes);
  const schFn = useServerFn(getMySchedule);
  const dbFn = useServerFn(getMyDateBlocks);
  const calFn = useServerFn(getCalendarConnectionStatus);
  const saveCfg = useServerFn(updateMyConfig);
  const saveLoc = useServerFn(saveLocation);
  const saveTyp = useServerFn(saveAppointmentType);
  const saveSch = useServerFn(replaceMySchedule);

  const q = useQuery({
    queryKey: ["setup-status"],
    queryFn: async () => {
      const [config, locations, types, schedule, dateBlocks, cal] = await Promise.all([
        cfgFn(), locFn(), typFn(), schFn(), dbFn().catch(() => [] as any[]), calFn().catch(() => ({ connected: false })),
      ]);
      return { config, locations, types, schedule, dateBlocks: (dateBlocks ?? []) as any[], calendarConnected: !!cal?.connected };
    },
  });

  const status = useMemo(() => {
    if (!q.data) return null;
    const input = {
      config: q.data.config as any,
      locations: q.data.locations.length,
      appointmentTypes: q.data.types.length,
      scheduleSlots: q.data.schedule.length,
      dateBlocks: q.data.dateBlocks.length,
      calendarConnected: q.data.calendarConnected,
    };
    return { steps: setupSteps(input), complete: isSetupComplete(input) };
  }, [q.data]);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [phone, setPhone] = useState("");
  const [locName, setLocName] = useState("");
  const [locAddress, setLocAddress] = useState("");
  const [typeName, setTypeName] = useState("Consulta");
  const [typeDuration, setTypeDuration] = useState("30");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [from, setFrom] = useState("09:00");
  const [to, setTo] = useState("17:00");

  useEffect(() => {
    if (!status || !q.data || initialized) return;
    setInitialized(true);
    const c: any = q.data.config ?? {};
    setName(c.display_name ?? "");
    setSpecialty(c.specialty ?? "");
    setPhone(c.phone ?? "");
    if (status.complete) return;
    if (safeGet("session", SNOOZE_KEY)) return;
    const first = STEPS.findIndex((s) => !status.steps[s.id]);
    setStep(first < 0 ? 0 : first);
    setOpen(true);
  }, [status, q.data, initialized]);

  useEffect(() => {
    const h = () => {
      if (!status) return;
      const first = STEPS.findIndex((s) => !status.steps[s.id]);
      setStep(first < 0 ? 0 : first);
      setOpen(true);
    };
    window.addEventListener("open-setup-wizard", h);
    return () => window.removeEventListener("open-setup-wizard", h);
  }, [status]);

  function later() {
    safeSet("session", SNOOZE_KEY, "1");
    setOpen(false);
  }

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["setup-status"] });
    qc.invalidateQueries();
  }

  async function next() {
    if (!q.data || !status) return;
    const id = (STEPS[step] ?? STEPS[0]).id;
    setSaving(true);
    try {
      if (id === "perfil") {
        if (!name.trim() || !specialty.trim() || phone.replace(/\D/g, "").length < 8) {
          toast.error("Completá nombre, profesión y teléfono.");
          return;
        }
        const c: any = q.data.config ?? {};
        await saveCfg({
          data: {
            display_name: name.trim(),
            specialty: specialty.trim(),
            phone,
            address: c.address ?? "",
            maps_url: c.maps_url ?? "",
            appointment_duration_minutes: [15, 20, 30, 45, 60].includes(c.appointment_duration_minutes)
              ? c.appointment_duration_minutes
              : 30,
            reminder_hour: Math.min(19, Math.max(9, c.reminder_hour ?? 9)),
            non_working_days: c.non_working_days ?? [],
            max_active_appointments_per_patient: c.max_active_appointments_per_patient ?? 1,
          },
        });
      } else if (id === "lugar" && !status.steps.lugar) {
        if (!locName.trim()) return void toast.error("Ingresá el nombre del lugar.");
        await saveLoc({ data: { name: locName.trim(), address: locAddress.trim(), maps_url: "" } });
      } else if (id === "turnos" && !status.steps.turnos) {
        if (!typeName.trim()) return void toast.error("Ingresá el nombre del tipo de turno.");
        await saveTyp({ data: { name: typeName.trim(), duration_minutes: Number(typeDuration) } });
      } else if (id === "horarios" && !status.steps.horarios) {
        if (!days.length) return void toast.error("Elegí al menos un día.");
        if (to <= from) return void toast.error("La hora de fin debe ser posterior a la de inicio.");
        const fresh = await locFn();
        const locationId = fresh[0]?.id;
        if (!locationId) return void toast.error("Primero cargá un lugar de atención.");
        await saveSch({
          data: { slots: days.map((d) => ({ day_of_week: d, start_time: from, end_time: to, location_id: locationId })) },
        });
      }
      await refresh();
      if (step < STEPS.length - 1) setStep(step + 1);
      else setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!status) return null;
  const id = (STEPS[step] ?? STEPS[0]).id;
  const done = status.steps[id];

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : later())}>
      <DialogContent className="np-dialog np-new-dialog max-h-[85vh] overflow-y-auto sm:max-w-[38rem]">
        <DialogHeader>
          <DialogTitle>Configurá tu agenda</DialogTitle>
          <DialogDescription className="sr-only">Completá los datos para empezar a recibir turnos.</DialogDescription>
        </DialogHeader>
        <div className="wizard-steps">
          {STEPS.map((s, i) => (
            <span key={s.id} className={i <= step ? "is-active" : ""}>{s.label}</span>
          ))}
        </div>

        {id === "perfil" && (
          <div className="wizard-panel">
            <p>Estos datos los ven tus pacientes en las confirmaciones y recordatorios.</p>
            <div className="space-y-2">
              <Label htmlFor="sw-name">Nombre y apellido *</Label>
              <Input id="sw-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sw-spec">Profesión / especialidad *</Label>
              <Input id="sw-spec" value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sw-phone">Teléfono de contacto *</Label>
              <PhoneInput id="sw-phone" value={phone} onChange={setPhone} />
            </div>
          </div>
        )}

        {id === "lugar" && (
          <div className="wizard-panel">
            {done ? (
              <p>Ya tenés {q.data!.locations.length} lugar(es) de atención cargado(s). Podés editarlos desde Configuración.</p>
            ) : (
              <>
                <p>¿Dónde atendés? Podés sumar más lugares después.</p>
                <div className="space-y-2">
                  <Label htmlFor="sw-loc">Nombre del lugar *</Label>
                  <Input id="sw-loc" placeholder="Consultorio Centro" value={locName} onChange={(e) => setLocName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sw-addr">Dirección</Label>
                  <Input id="sw-addr" value={locAddress} onChange={(e) => setLocAddress(e.target.value)} />
                </div>
              </>
            )}
          </div>
        )}

        {id === "turnos" && (
          <div className="wizard-panel">
            {done ? (
              <p>Ya tenés {q.data!.types.length} tipo(s) de turno cargado(s). Podés editarlos desde Configuración.</p>
            ) : (
              <>
                <p>Creá tu primer tipo de turno. Podés sumar más después.</p>
                <div className="space-y-2">
                  <Label htmlFor="sw-type">Nombre *</Label>
                  <Input id="sw-type" value={typeName} onChange={(e) => setTypeName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Duración *</Label>
                  <Select value={typeDuration} onValueChange={setTypeDuration}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[15, 20, 30, 45, 60].map((m) => (
                        <SelectItem key={m} value={String(m)}>{m} min</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        )}

        {id === "horarios" && (
          <div className="wizard-panel">
            {done ? (
              <p>Ya tenés horarios o jornadas cargados. Podés ajustarlos desde Configuración.</p>
            ) : (
              <>
                <p>Elegí los días y el horario en que atendés. Después podés agregar más franjas.</p>
                <div className="flex flex-wrap gap-2">
                  {WEEK.map((w) => {
                    const on = days.includes(w.d);
                    return (
                      <Button
                        key={w.d}
                        type="button"
                        size="sm"
                        variant={on ? "default" : "outline"}
                        aria-pressed={on}
                        onClick={() => setDays(on ? days.filter((x) => x !== w.d) : [...days, w.d])}
                      >
                        {w.l}
                      </Button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="sw-from">Desde *</Label>
                    <Input id="sw-from" type="time" value={from} onChange={(e) => setFrom(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sw-to">Hasta *</Label>
                    <Input id="sw-to" type="time" value={to} onChange={(e) => setTo(e.target.value)} />
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {id === "calendario" && (
          <div className="wizard-panel">
            {done ? (
              <p>Tu Google Calendar ya está conectado. ¡Listo para empezar!</p>
            ) : (
              <>
                <p>Conectá Google Calendar para ver tus turnos en tu calendario. Es opcional: podés hacerlo después.</p>
                <Button asChild variant="outline">
                  <Link to="/configuracion" search={{ tab: "integraciones" }} onClick={() => setOpen(false)}>
                    Conectar Google Calendar
                  </Link>
                </Button>
              </>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="ghost" onClick={later}>Configurar más tarde</Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button type="button" variant="outline" onClick={() => setStep(step - 1)} disabled={saving}>Atrás</Button>
            )}
            <Button type="button" onClick={next} disabled={saving}>
              {saving ? "Guardando…" : step === STEPS.length - 1 ? "Finalizar" : "Siguiente"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

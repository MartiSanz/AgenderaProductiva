import { getPortalSlugFor } from "@/lib/api/portalSlug.functions";
import { CityInput } from "@/components/CityInput";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneInput } from "@/components/PhoneInput";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SectionColorProvider, SectionButton, SectionCheckbox } from "@/components/section-color";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getMyConfig, updateMyConfig, updateBookingAccessMode } from "@/lib/api/config.functions";
import { useEntitlements } from "@/hooks/useEntitlements";
import {
  getMySchedule,
  replaceMySchedule,
  getMyDateBlocks,
  addDateBlock,
  deleteDateBlock,
} from "@/lib/api/schedule.functions";
import { DAYS_ES } from "@/lib/domain/types";
import { getMyLocations, saveLocation, deleteLocation } from "@/lib/api/locations.functions";
import {
  getMyAppointmentTypes,
  saveAppointmentType,
  deleteAppointmentType,
} from "@/lib/api/appointmentTypes.functions";
import {
  getCalendarConnectionStatus,
  startGoogleCalendarConnect,
  disconnectGoogleCalendar,
  completeGoogleCalendarConnect,
  getTurnosCalendarStatus,
  ensureTurnosCalendar,
  unlinkTurnosCalendar,
  getCalendarSyncStatus,
  updateCalendarSyncSettings,
  syncCalendarNow,
} from "@/lib/api/calendar.functions";
import {
  Calendar,
  Plus,
  Trash2,
  RefreshCw,
  X,
  UserCog,
  Plug,
  Briefcase,
  ExternalLink,
} from "lucide-react";
import { Download, Lock as LockIcon } from "lucide-react";
import {
  getRetentionStatus,
  updateRetentionYears,
  exportPatientsData,
  exportAppointmentsData,
} from "@/lib/api/retention.functions";
import { downloadCsv, stamped } from "@/lib/csv";
import { MessageCircle, Copy, PlayCircle } from "lucide-react";
import {
  getWhatsappAccount,
  saveWhatsappAccount,
  disconnectWhatsappAccount,
  sendWhatsappTest,
  refreshWhatsappStatus,
} from "@/lib/api/whatsapp.functions";

export type ConfigTab = "perfil" | "practica" | "agenda" | "integraciones" | "descargas";

export const CONFIG_TABS: Array<{ id: ConfigTab; label: string }> = [
  { id: "perfil", label: "Perfil profesional" },
  { id: "practica", label: "Mi Práctica" },
  { id: "integraciones", label: "Integraciones" },
  { id: "descargas", label: "Descargas" },
];

export const Route = createFileRoute("/_authenticated/configuracion")({
  validateSearch: (search: Record<string, unknown>): { tab: ConfigTab } => {
    const t = String(search.tab ?? "perfil");
    const valid = CONFIG_TABS.some((x) => x.id === t) || t === "agenda";
    return { tab: (valid ? t : "perfil") as ConfigTab };
  },
  head: () => ({
    meta: [
      { title: "Configuración del consultorio — Agendera — La agenda que se maneja sola" },
      {
        name: "description",
        content:
          "Configurá horarios de atención, tipos de turno, lugares e integraciones de tu agenda.",
      },
      { name: "robots", content: "noindex" },
      {
        property: "og:title",
        content: "Configuración del consultorio — Agendera — La agenda que se maneja sola",
      },
      {
        property: "og:description",
        content:
          "Configurá horarios de atención, tipos de turno, lugares e integraciones de tu agenda.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConfigPage,
});

const PRACTICE_SECTIONS = [
  { id: "dias", label: "Días laborables" },
  { id: "lugares", label: "Sedes de atención" },
  { id: "horarios", label: "Horarios" },
  { id: "jornadas", label: "Jornadas" },
  { id: "tipos", label: "Tipos de turno y aranceles" },
  { id: "link", label: "Link" },
] as const;
type PracticeSection = (typeof PRACTICE_SECTIONS)[number]["id"];

function ConfigPage() {
  const { has, isAdmin } = useEntitlements();
  const { tab } = Route.useSearch();
  const [practiceSection, setPracticeSection] = useState<PracticeSection>("dias");
  return (
    <div className="zip-ui warm-ui space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Gestioná los horarios, sedes, aranceles, integraciones y datos de tu consultorio.
        </p>
      </div>

      <div
        className="flex flex-wrap items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/50 max-w-fit"
        role="tablist"
        aria-label="Pestañas de configuración"
      >
        {CONFIG_TABS.map((t) => {
          const active = tab === t.id || (tab === "agenda" && t.id === "practica");
          const TabIcon =
            t.id === "practica"
              ? Briefcase
              : t.id === "perfil"
                ? UserCog
                : t.id === "descargas"
                  ? Download
                  : Plug;
          return (
            <Link
              key={t.id}
              to="/configuracion"
              search={{ tab: t.id }}
              role="tab"
              aria-selected={active}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all ${
                active
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50"
              }`}
            >
              <TabIcon className="h-4 w-4" />
              <span>{t.label}</span>
            </Link>
          );
        })}
      </div>

      {(tab === "practica" || tab === "agenda") && (
        <div className="space-y-6">
          <div className="mk-status-seg" role="tablist" aria-label="Secciones de Mi Práctica">
            {PRACTICE_SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={practiceSection === s.id}
                className={practiceSection === s.id ? "is-active" : undefined}
                onClick={() => setPracticeSection(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
          {practiceSection === "dias" && <WorkingDaysCard />}
          {practiceSection === "lugares" && <LocationsEditor />}
          {practiceSection === "horarios" && <ScheduleCard />}
          {practiceSection === "jornadas" && <DateBlocksCard />}
          {practiceSection === "tipos" && <AppointmentTypesEditor />}
          {practiceSection === "link" && (
            <div className="space-y-6">
              <ShareLinkCard />
              {has("patient_self_booking") && <BookingAccessCard />}
            </div>
          )}
        </div>
      )}

      {tab === "perfil" && (
        <div className="space-y-6">
          <ProfileCard />
        </div>
      )}
      {tab === "descargas" && (
        <div className="space-y-6">
          <MyDataCard />
        </div>
      )}
      {tab === "integraciones" && (
        <div className="space-y-6">
          <GoogleCalendarCard />
          {isAdmin && <WhatsappCard locked={!has("whatsapp_bot")} />}
        </div>
      )}
    </div>
  );
}

function MyDataCard() {
  const qc = useQueryClient();
  const statusFn = useServerFn(getRetentionStatus);
  const yearsFn = useServerFn(updateRetentionYears);
  const patientsFn = useServerFn(exportPatientsData);
  const apptFn = useServerFn(exportAppointmentsData);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: status } = useQuery({ queryKey: ["retention-status"], queryFn: () => statusFn() });

  const yearsM = useMutation({
    mutationFn: (years: number) => yearsFn({ data: { years } }),
    onSuccess: () => {
      toast.success("Plazo de conservación guardado");
      qc.invalidateQueries({ queryKey: ["retention-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patientsM = useMutation({
    mutationFn: () => patientsFn(),
    onSuccess: (rows) => {
      if (!rows?.length) return toast.info("No hay pacientes para exportar.");
      downloadCsv(stamped("pacientes"), rows);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const apptM = useMutation({
    mutationFn: () => apptFn({ data: { from: from || undefined, to: to || undefined } }),
    onSuccess: (rows) => {
      if (!rows?.length) return toast.info("No hay turnos para exportar.");
      downloadCsv(stamped("turnos"), rows);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SectionColorProvider color="day-6">
      <Card className="border-l-[6px] border-l-day-6">
        <CardHeader>
          <CardTitle className="text-day-6">Mis datos</CardTitle>
          <CardDescription>
            Descargá tu información en CSV (abre en Excel) y definí cuánto tiempo se conserva el
            historial.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-end gap-3">
            <SectionButton
              variant="outline"
              size="sm"
              onClick={() => patientsM.mutate()}
              disabled={patientsM.isPending}
            >
              <Download className="h-4 w-4 mr-1" />
              Pacientes.csv
            </SectionButton>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="csv-from">Desde</Label>
              <Input
                id="csv-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="csv-to">Hasta</Label>
              <Input id="csv-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <SectionButton
              variant="outline"
              size="sm"
              onClick={() => apptM.mutate()}
              disabled={apptM.isPending}
            >
              <Download className="h-4 w-4 mr-1" />
              Turnos.csv
            </SectionButton>
          </div>

          <div className="space-y-1">
            <Label>Plazo de conservación del historial</Label>
            <Select
              value={String(status?.years ?? 10)}
              onValueChange={(v) => yearsM.mutate(Number(v))}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 5, 10].map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y} año{y === 1 ? "" : "s"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Nada se borra automáticamente. Al cumplirse el plazo (Ley 26.529, art. 18) vas a ver
              un aviso en Agenda para descargar y depurar el historial.
            </p>
          </div>
        </CardContent>
      </Card>
    </SectionColorProvider>
  );
}

function WhatsappCard({ locked = false }: { locked?: boolean }) {
  const qc = useQueryClient();
  const fetchAccount = useServerFn(getWhatsappAccount);
  const save = useServerFn(saveWhatsappAccount);
  const disconnect = useServerFn(disconnectWhatsappAccount);
  const sendTest = useServerFn(sendWhatsappTest);
  const refreshStatus = useServerFn(refreshWhatsappStatus);

  const { data: account } = useQuery({
    queryKey: ["whatsapp-account"],
    queryFn: () => fetchAccount(),
  });
  const [form, setForm] = useState({
    phone_number_id: "",
    waba_id: "",
    access_token: "",
    app_secret: "",
    display_phone: "",
    reminder_template_name: "recordatorio_turno",
    reminder_template_lang: "es_AR",
  });
  const [testPhone, setTestPhone] = useState("");

  useEffect(() => {
    if (account) {
      setForm((prev) => ({
        ...prev,
        phone_number_id: account.phone_number_id ?? "",
        waba_id: account.waba_id ?? "",
        display_phone: account.display_phone ?? "",
        reminder_template_name: account.reminder_template_name ?? "recordatorio_turno",
        reminder_template_lang: account.reminder_template_lang ?? "es_AR",
      }));
    }
  }, [account]);

  const webhookUrl =
    typeof window !== "undefined" ? `${window.location.origin}/api/public/hooks/whatsapp` : "";
  const confirmButtonUrl = typeof window !== "undefined" ? `${window.location.origin}/c/{{1}}` : "";

  const saveM = useMutation({
    mutationFn: () => save({ data: form }),
    onSuccess: (res: any) => {
      if (res?.status === "connected") toast.success("WhatsApp conectado y verificado");
      else if (res?.status === "needs_registration")
        toast.warning(res?.message ?? "Falta registrar el número en la Cloud API.", {
          duration: 12000,
        });
      else toast.error(res?.message ?? "No se pudo verificar la conexión.", { duration: 12000 });
      setForm((prev) => ({ ...prev, access_token: "", app_secret: "" }));
      qc.invalidateQueries({ queryKey: ["whatsapp-account"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refreshM = useMutation({
    mutationFn: () => refreshStatus(),
    onSuccess: (res: any) => {
      if (res?.status === "connected") toast.success("Número verificado: listo para enviar");
      else if (res?.status === "needs_registration")
        toast.warning(res?.message ?? "Falta registrar el número.", { duration: 12000 });
      else toast.error(res?.message ?? "No se pudo verificar.", { duration: 12000 });
      qc.invalidateQueries({ queryKey: ["whatsapp-account"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disconnectM = useMutation({
    mutationFn: () => disconnect(),
    onSuccess: () => {
      toast.success("Cuenta desconectada");
      qc.invalidateQueries({ queryKey: ["whatsapp-account"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testM = useMutation({
    mutationFn: () => sendTest({ data: { phone: testPhone } }),
    onSuccess: (res) => {
      if (res?.ok) toast.success("Mensaje de prueba enviado");
      else
        toast.error(res?.message ?? "No se pudo enviar el mensaje de prueba", { duration: 12000 });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copy = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success("Copiado");
  };

  return (
    <SectionColorProvider color="day-5">
      <Card className="border-l-[6px] border-l-day-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-day-5">
            <MessageCircle className="h-5 w-5" /> WhatsApp
          </CardTitle>
          <CardDescription>
            Conectá tu número de WhatsApp Business (Meta Cloud API) para que los pacientes reserven
            por chat.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {locked && (
            <div className="rounded-lg border border-dashed bg-muted/40 p-3 text-sm">
              La vinculación de WhatsApp está incluida en el plan <strong>Pro</strong>. Podés ver
              los pasos, pero la conexión se habilita al activar la función en tu cuenta.
            </div>
          )}

          <details className="rounded-lg border bg-muted/30 p-3 text-sm" open={!account}>
            <summary className="cursor-pointer font-semibold text-day-5">
              Paso a paso para vincular tu número
            </summary>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground">
              <li>
                Entrá a <strong>developers.facebook.com</strong> con tu cuenta de Facebook y creá
                una app de tipo
                <strong> Business</strong>.
              </li>
              <li>
                En la app, agregá el producto <strong>WhatsApp</strong>. Se te crea automáticamente
                una cuenta de WhatsApp Business (WABA) y un número de prueba.
              </li>
              <li>
                En <em>WhatsApp → Configuración de la API</em> copiá el{" "}
                <strong>Phone number ID</strong> y el{" "}
                <strong>WhatsApp Business Account ID (WABA ID)</strong> y pegalos abajo.
              </li>
              <li>
                Para usar tu número real: en <em>Administrar números de teléfono</em> agregá tu
                número, verificalo por SMS o llamada y copiá el nuevo{" "}
                <strong>Phone number ID</strong>. El número no puede estar activo en la app común de
                WhatsApp; si lo está, primero borralo de esa app.
              </li>
              <li>
                Generá un <strong>access token permanente</strong>: en Business Manager creá un
                usuario del sistema con rol de administrador, asignale la app y la WABA, y generá un
                token con los permisos <code>whatsapp_business_messaging</code> y{" "}
                <code>whatsapp_business_management</code>. Pegalo abajo.
              </li>
              <li>
                Copiá el <strong>App secret</strong> desde <em>Configuración de la app → Básica</em>{" "}
                (sirve para validar que los mensajes vengan realmente de Meta).
              </li>
              <li>
                Guardá con <strong>Conectar WhatsApp</strong>. Recién ahí se generan la URL del
                webhook y el token de verificación que aparecen arriba.
              </li>
              <li>
                En <em>WhatsApp → Configuración → Webhooks</em> pegá la{" "}
                <strong>Callback URL</strong> y el <strong>Verify token</strong> que te mostramos,
                confirmá y suscribí el campo <strong>messages</strong>.
              </li>
              <li>
                Creá la plantilla de recordatorio en <em>Administrador de WhatsApp → Plantillas</em>{" "}
                con el nombre <code>recordatorio_turno</code> en español, y esperá su aprobación.
              </li>
              <li>
                En esa misma plantilla agregá un botón de tipo <strong>URL dinámica</strong> con el
                texto <strong>Confirmar turno</strong> y la URL base{" "}
                <code>{confirmButtonUrl || "https://tu-dominio/c/{{1}}"}</code>. Cuando el paciente
                lo toca, el turno queda confirmado automáticamente; si no lo toca, queda como
                “Recordatorio enviado” en tu agenda.
              </li>
              <li>
                Escribile un mensaje a tu número desde otro celular y usá <strong>Probar</strong>{" "}
                para confirmar que la conexión funciona (Meta solo permite mensajes libres dentro de
                las 24 h de la última respuesta del paciente).
              </li>
            </ol>
            <div className="mt-4 rounded-lg border bg-background/60 p-3">
              <p className="font-semibold text-day-5">Tutoriales en video</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Si preferís hacer el registro de WhatsApp mirando la pantalla, estos dos tutoriales
                te guían paso a paso.
              </p>
              <ul className="mt-2 space-y-2 text-sm">
                <li>
                  <a
                    href="https://www.youtube.com/watch?v=yR60HqvAgL0&t=1s"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-start gap-1.5 font-medium text-day-5 underline underline-offset-2"
                  >
                    <PlayCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Cómo registrar tu número en WhatsApp API y evitar baneos
                      <span className="block text-xs font-normal text-muted-foreground">
                        Javier Vrandecic
                      </span>
                    </span>
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.youtube.com/watch?v=vC46KzCWT6A"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-start gap-1.5 font-medium text-day-5 underline underline-offset-2"
                  >
                    <PlayCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Registrar número de teléfono en WhatsApp Business API
                      <span className="block text-xs font-normal text-muted-foreground">
                        Cero Absoluto
                      </span>
                    </span>
                  </a>
                </li>
              </ul>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Podés conocer la experiencia de autogestión incluida en Pro desde{" "}
              <strong>Conocé el Portal Pacientes</strong> en el menú de usuario.
            </p>
          </details>

          {account && (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p>
                Estado:{" "}
                <span
                  className={
                    account.status === "connected"
                      ? "font-semibold text-day-3"
                      : account.status === "error"
                        ? "font-semibold text-destructive"
                        : "font-semibold text-day-5"
                  }
                >
                  {account.status === "connected"
                    ? "Conectado"
                    : account.status === "error"
                      ? "Con errores"
                      : "Pendiente de registro"}
                </span>
                {account.display_phone ? ` · ${account.display_phone}` : ""}
              </p>
              {account.last_error ? (
                <p
                  className={`mt-1 ${account.status === "connected" ? "text-muted-foreground" : "text-destructive"}`}
                >
                  {account.last_error}
                </p>
              ) : null}
              <SectionButton
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => refreshM.mutate()}
                disabled={refreshM.isPending}
              >
                Revisar estado
              </SectionButton>
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input readOnly value={webhookUrl} className="text-xs" />
                  <SectionButton
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => copy(webhookUrl)}
                  >
                    <Copy className="h-4 w-4" />
                  </SectionButton>
                </div>
                <div className="flex items-center gap-2">
                  <Input readOnly value={account.verify_token ?? ""} className="text-xs" />
                  <SectionButton
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => copy(account.verify_token ?? "")}
                  >
                    <Copy className="h-4 w-4" />
                  </SectionButton>
                </div>
                <p className="text-xs text-muted-foreground">
                  Pegá la URL como “Callback URL” y el token como “Verify token” en la configuración
                  del webhook de Meta, y suscribí el campo <strong>messages</strong>.
                </p>
                <div className="flex items-center gap-2">
                  <Input readOnly value={confirmButtonUrl} className="text-xs" />
                  <SectionButton
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => copy(confirmButtonUrl)}
                  >
                    <Copy className="h-4 w-4" />
                  </SectionButton>
                </div>
                <p className="text-xs text-muted-foreground">
                  URL base del botón <strong>Confirmar turno</strong> (URL dinámica) de la plantilla
                  de recordatorio.
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Phone number ID</Label>
              <Input
                value={form.phone_number_id}
                onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>WABA ID</Label>
              <Input
                value={form.waba_id}
                onChange={(e) => setForm({ ...form, waba_id: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Access token permanente</Label>
              <Input
                type="password"
                placeholder={account ? "•••••• (guardado)" : ""}
                value={form.access_token}
                onChange={(e) => setForm({ ...form, access_token: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>App secret</Label>
              <Input
                type="password"
                placeholder={account ? "•••••• (guardado)" : ""}
                value={form.app_secret}
                onChange={(e) => setForm({ ...form, app_secret: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Número visible</Label>
              <Input
                value={form.display_phone}
                onChange={(e) => setForm({ ...form, display_phone: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Plantilla de recordatorio</Label>
              <Input
                value={form.reminder_template_name}
                onChange={(e) => setForm({ ...form, reminder_template_name: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <SectionButton onClick={() => saveM.mutate()} disabled={saveM.isPending || locked}>
              {account ? "Actualizar conexión" : "Conectar WhatsApp"}
            </SectionButton>
            {account && (
              <SectionButton
                variant="outline"
                onClick={() => disconnectM.mutate()}
                disabled={disconnectM.isPending}
              >
                Desconectar
              </SectionButton>
            )}
          </div>

          {account && (
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Enviar prueba a (con código de país)</Label>
                <PhoneInput value={testPhone} onChange={setTestPhone} />
              </div>
              <SectionButton
                variant="outline"
                onClick={() => testM.mutate()}
                disabled={
                  testM.isPending || testPhone.trim().length < 6 || account.status !== "connected"
                }
              >
                Probar
              </SectionButton>
            </div>
          )}
          {account && account.status !== "connected" && (
            <p className="text-xs text-muted-foreground">
              La prueba se habilita cuando el número figura registrado en la Cloud API.
            </p>
          )}
        </CardContent>
      </Card>
    </SectionColorProvider>
  );
}

function ProfileCard() {
  return <ProfileCardInner />;
}

function ShareLinkCard() {
  const { has } = useEntitlements();
  const locked = !has("patient_self_booking");
  const fetchCfg = useServerFn(getMyConfig);
  const { data } = useQuery({ queryKey: ["config"], queryFn: () => fetchCfg() });
  const ownerId = data?.owner_id ?? "";
  const fetchSlug = useServerFn(getPortalSlugFor);
  const { data: slugData } = useQuery({
    queryKey: ["portal-slug", ownerId, data?.display_name, data?.specialty],
    queryFn: () => fetchSlug({ data: { ownerId } }),
    enabled: !!ownerId && !locked,
  });
  const slug = slugData?.slug ?? "";
  const url = !locked && slug ? `https://agendera.lovable.app/${slug}` : "";

  return (
    <SectionColorProvider color="day-3">
      <Card className="border-l-[6px] border-l-day-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-day-3">
            {locked && <LockIcon className="h-4 w-4" />}
            Tu link de turnos
          </CardTitle>
          <CardDescription>
            Compartí este link con tus pacientes para que puedan reservar, cancelar o reprogramar
            turnos sin llamarte.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {locked ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/40 p-3 text-sm">
              <p className="font-semibold">Función exclusiva del Plan Pro</p>
              <p className="mt-1 text-muted-foreground">
                Mejorá tu plan para que tus pacientes puedan reservar turnos por su cuenta con tu
                link personal. Escribinos y lo habilitamos.
              </p>
            </div>
          ) : (
            <>
              <Input
                readOnly
                value={url}
                className="font-mono text-xs"
                onFocus={(e) => e.currentTarget.select()}
              />
              <div className="flex flex-wrap gap-2">
                <SectionButton
                  size="sm"
                  disabled={!url}
                  onClick={() => {
                    navigator.clipboard.writeText(url);
                    toast.success("Link copiado");
                  }}
                >
                  <Copy className="mr-1 h-4 w-4" /> Copiar link
                </SectionButton>
                <SectionButton
                  variant="outline"
                  size="sm"
                  disabled={!url}
                  onClick={() => window.open(url, "_blank")}
                >
                  <ExternalLink className="mr-1 h-3.5 w-3.5" /> Abrir enlace
                </SectionButton>
                <SectionButton variant="ghost" size="sm" asChild>
                  <Link
                    to="/simulador"
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <PlayCircle className="h-3.5 w-3.5 text-primary" /> Probar en Simulador
                  </Link>
                </SectionButton>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </SectionColorProvider>
  );
}

function ProfileCardInner() {
  const fetchCfg = useServerFn(getMyConfig);
  const updateCfg = useServerFn(updateMyConfig);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["config"], queryFn: () => fetchCfg() });
  const [form, setForm] = useState({
    display_name: "",
    specialty: "",
    address: "",
    phone: "",
    maps_url: "",
    appointment_duration_minutes: 30,
    reminder_hour: 17,
    max_active_appointments_per_patient: 1,
  });
  useEffect(() => {
    if (data)
      setForm({
        display_name: data.display_name ?? "",
        specialty: data.specialty ?? "",
        address: data.address ?? "",
        phone: data.phone ?? "",
        maps_url: data.maps_url ?? "",
        appointment_duration_minutes: data.appointment_duration_minutes ?? 30,
        reminder_hour: data.reminder_hour ?? 17,
        max_active_appointments_per_patient: data.max_active_appointments_per_patient ?? 1,
      });
  }, [data]);

  const m = useMutation({
    mutationFn: (payload: typeof form) =>
      updateCfg({ data: { ...payload, non_working_days: data?.non_working_days ?? [] } }),
    onSuccess: () => {
      toast.success("Configuración guardada");
      qc.invalidateQueries({ queryKey: ["config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SectionColorProvider color="day-1">
      <Card className="border-l-[6px] border-l-day-1">
        <CardHeader>
          <CardTitle className="text-day-1">Datos del profesional</CardTitle>
          <CardDescription>Se muestran en los mensajes al paciente.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Nombre para mostrar">
            <Input
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              placeholder="Nombre y apellido"
            />
          </Field>
          <Field label="Profesión">
            <Input
              value={form.specialty}
              onChange={(e) => setForm({ ...form, specialty: e.target.value })}
              placeholder="Nutricionista"
            />
          </Field>
          <Field label="Teléfono de contacto">
            <PhoneInput value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          </Field>
          <Field label="Hora del recordatorio (día previo)">
            <Select
              value={String(form.reminder_hour)}
              onValueChange={(v) => setForm({ ...form, reminder_hour: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 11 }, (_, k) => k + 9).map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {String(h).padStart(2, "0")}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Máx. turnos activos por paciente">
            <Input
              type="number"
              min={1}
              max={50}
              value={form.max_active_appointments_per_patient}
              onChange={(e) =>
                setForm({
                  ...form,
                  max_active_appointments_per_patient: Math.max(1, Number(e.target.value) || 1),
                })
              }
            />
          </Field>
          <div className="md:col-span-2 flex justify-end">
            <SectionButton onClick={() => m.mutate(form)} disabled={m.isPending}>
              {m.isPending ? "Guardando…" : "Guardar cambios"}
            </SectionButton>
          </div>
        </CardContent>
      </Card>
    </SectionColorProvider>
  );
}

function AppointmentTypesEditor() {
  const qc = useQueryClient();
  const listFn = useServerFn(getMyAppointmentTypes);
  const saveFn = useServerFn(saveAppointmentType);
  const delFn = useServerFn(deleteAppointmentType);
  const {
    data: types,
    isPending: typesPending,
    isError: typesError,
    refetch: refetchTypes,
  } = useQuery({ queryKey: ["appointment-types"], queryFn: () => listFn() });
  const [draft, setDraft] = useState({ name: "", duration_minutes: 30, price: "" });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const saveM = useMutation({
    mutationFn: (payload: {
      id?: string;
      name: string;
      duration_minutes: number;
      price_ars?: number | null;
    }) => saveFn({ data: payload }),
    onSuccess: () => {
      toast.success("Tipo de turno guardado");
      setDraft({ name: "", duration_minutes: 30, price: "" });
      qc.invalidateQueries({ queryKey: ["appointment-types"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Tipo de turno eliminado");
      qc.invalidateQueries({ queryKey: ["appointment-types"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-sm font-medium">Tipos de turno</p>
      <p className="text-xs text-muted-foreground">
        Definí cada tipo con su duración (ej. Control 30 min, Primera consulta 45 min). Al cargar un
        turno vas a poder elegir el tipo y también usar la opción “Otro” con una duración puntual.
      </p>
      {typesPending && (
        <p className="mt-3 text-xs text-muted-foreground">Cargando tipos de turno…</p>
      )}
      {typesError && (
        <p className="mt-3 text-xs text-destructive">
          No se pudieron cargar los tipos.{" "}
          <button type="button" className="underline" onClick={() => refetchTypes()}>
            Reintentar
          </button>
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-start gap-3">
        {(types ?? []).map((t: any) => (
          <div
            key={t.id}
            className="min-w-[13rem] flex-1 space-y-2 rounded-lg border border-border p-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">{t.name}</span>
              <SectionButton
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => setConfirmDeleteId(t.id)}
              >
                <Trash2 className="h-4 w-4" />
              </SectionButton>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre</Label>
              <Input
                defaultValue={t.name}
                placeholder="Nombre (ej. Control)"
                className="h-8"
                onBlur={(e) =>
                  e.target.value.trim() &&
                  e.target.value !== t.name &&
                  saveM.mutate({
                    id: t.id,
                    name: e.target.value.trim(),
                    duration_minutes: t.duration_minutes,
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Duración</Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  defaultValue={t.duration_minutes}
                  className="h-8 flex-1 px-1.5 text-right"
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (v >= 5 && v !== t.duration_minutes)
                      saveM.mutate({ id: t.id, name: t.name, duration_minutes: v });
                  }}
                />
                <span className="text-xs text-muted-foreground">min</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Precio</Label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">$</span>
                <Input
                  type="number"
                  min={0}
                  step={100}
                  inputMode="decimal"
                  defaultValue={t.price_ars ?? ""}
                  placeholder="Sin precio"
                  className="h-8 flex-1 px-1.5 text-right"
                  onBlur={(e) => {
                    const raw = e.target.value.trim();
                    const v = raw === "" ? null : Number(raw);
                    if (v !== null && (isNaN(v) || v < 0)) return;
                    if (v !== (t.price_ars === null ? null : Number(t.price_ars)))
                      saveM.mutate({
                        id: t.id,
                        name: t.name,
                        duration_minutes: t.duration_minutes,
                        price_ars: v,
                      });
                  }}
                />
                <span className="text-xs text-muted-foreground">ARS</span>
              </div>
            </div>
          </div>
        ))}
        <div className="min-w-[13rem] flex-1 space-y-2 rounded-lg border border-border p-2">
          <div className="text-sm font-semibold text-foreground">Agregar</div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nombre</Label>
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Ej. Primera consulta"
              className="h-8"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Duración</Label>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={5}
                max={480}
                step={5}
                value={draft.duration_minutes}
                onChange={(e) =>
                  setDraft({ ...draft, duration_minutes: Number(e.target.value) || 0 })
                }
                placeholder="Min"
                className="h-8 flex-1 px-1.5 text-right"
              />
              <span className="text-xs text-muted-foreground">min</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Precio</Label>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">$</span>
              <Input
                type="number"
                min={0}
                step={100}
                inputMode="decimal"
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                placeholder="Sin precio"
                className="h-8 flex-1 px-1.5 text-right"
              />
              <span className="text-xs text-muted-foreground">ARS</span>
            </div>
          </div>
          <SectionButton
            variant="outline"
            className="w-full"
            disabled={!draft.name.trim() || draft.duration_minutes < 5 || saveM.isPending}
            onClick={() =>
              saveM.mutate({
                name: draft.name.trim(),
                duration_minutes: draft.duration_minutes,
                price_ars: draft.price.trim() === "" ? null : Math.max(0, Number(draft.price) || 0),
              })
            }
          >
            <Plus className="mr-1 h-4 w-4" /> Agregar tipo
          </SectionButton>
        </div>
      </div>
      {(types ?? []).length === 0 && (
        <p className="mt-3 text-xs text-muted-foreground">Todavía no cargaste tipos de turno.</p>
      )}
      <Dialog
        open={!!confirmDeleteId}
        onOpenChange={(v) => {
          if (!v) setConfirmDeleteId(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-day-5">¿Eliminar tipo de turno?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. El tipo
              {(() => {
                const t = (types ?? []).find((x: any) => x.id === confirmDeleteId);
                return t ? ` "${t.name}"` : "";
              })()}
              {` `}se borrará definitivamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <SectionButton variant="outline" onClick={() => setConfirmDeleteId(null)}>
              <X className="mr-1 h-4 w-4" /> Cancelar
            </SectionButton>
            <SectionButton
              onClick={() => {
                if (confirmDeleteId) delM.mutate(confirmDeleteId);
                setConfirmDeleteId(null);
              }}
              disabled={delM.isPending || !confirmDeleteId}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              {delM.isPending ? "Eliminando…" : "Sí, eliminar"}
            </SectionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LocationsEditor() {
  const qc = useQueryClient();
  const listFn = useServerFn(getMyLocations);
  const saveFn = useServerFn(saveLocation);
  const delFn = useServerFn(deleteLocation);
  const { data: locations } = useQuery({ queryKey: ["locations"], queryFn: () => listFn() });
  const [draft, setDraft] = useState({ name: "", city: "", address: "", maps_url: "" });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const saveM = useMutation({
    mutationFn: (payload: {
      id?: string;
      name: string;
      city?: string;
      address: string;
      maps_url: string;
    }) => saveFn({ data: payload }),
    onSuccess: () => {
      toast.success("Lugar de atención guardado");
      setDraft({ name: "", city: "", address: "", maps_url: "" });
      qc.invalidateQueries({ queryKey: ["locations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Lugar eliminado");
      qc.invalidateQueries({ queryKey: ["locations"] });
      qc.invalidateQueries({ queryKey: ["schedule"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-sm font-medium">Lugares de atención</p>
      <p className="text-xs text-muted-foreground">
        Cargá cada consultorio con su link de Google Maps. Después vas a poder asignarlos a cada
        franja horaria.
      </p>
      <div className="mt-3 flex flex-wrap items-start gap-3">
        {(locations ?? []).map((l: any) => (
          <div
            key={l.id}
            className="min-w-[13rem] flex-1 space-y-2 rounded-lg border border-border p-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">{l.name}</span>
              <SectionButton
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => setConfirmDeleteId(l.id)}
              >
                <Trash2 className="h-4 w-4" />
              </SectionButton>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre</Label>
              <Input
                defaultValue={l.name}
                placeholder="Nombre (ej. Centro de atención)"
                className="h-8"
                onBlur={(e) =>
                  e.target.value.trim() &&
                  e.target.value !== l.name &&
                  saveM.mutate({
                    id: l.id,
                    name: e.target.value.trim(),
                    address: l.address,
                    maps_url: l.maps_url,
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ciudad</Label>
              <CityInput
                defaultValue={l.city ?? ""}
                placeholder="Ej. La Plata"
                className="h-8"
                onBlur={(e) =>
                  e.target.value !== (l.city ?? "") &&
                  saveM.mutate({
                    id: l.id,
                    name: l.name,
                    city: e.target.value,
                    address: l.address,
                    maps_url: l.maps_url,
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Dirección</Label>
              <Input
                defaultValue={l.address}
                placeholder="Dirección"
                className="h-8"
                onBlur={(e) =>
                  e.target.value !== l.address &&
                  saveM.mutate({
                    id: l.id,
                    name: l.name,
                    address: e.target.value,
                    maps_url: l.maps_url,
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Google Maps</Label>
              <Input
                defaultValue={l.maps_url}
                placeholder="https://maps.app.goo.gl/..."
                className="h-8"
                onBlur={(e) =>
                  e.target.value !== l.maps_url &&
                  saveM.mutate({
                    id: l.id,
                    name: l.name,
                    address: l.address,
                    maps_url: e.target.value,
                  })
                }
              />
            </div>
          </div>
        ))}
        <div className="min-w-[13rem] flex-1 space-y-2 rounded-lg border border-border p-2">
          <div className="text-sm font-semibold text-foreground">Agregar</div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nombre</Label>
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Ej. Sucursal Norte"
              className="h-8"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ciudad</Label>
            <CityInput
              value={draft.city}
              onValueChange={(v) => setDraft({ ...draft, city: v })}
              placeholder="Ej. La Plata"
              className="h-8"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Dirección</Label>
            <Input
              value={draft.address}
              onChange={(e) => setDraft({ ...draft, address: e.target.value })}
              placeholder="Dirección"
              className="h-8"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Google Maps</Label>
            <Input
              value={draft.maps_url}
              onChange={(e) => setDraft({ ...draft, maps_url: e.target.value })}
              placeholder="https://maps.app.goo.gl/..."
              className="h-8"
            />
          </div>
          <SectionButton
            variant="outline"
            className="w-full"
            disabled={!draft.name.trim() || saveM.isPending}
            onClick={() => saveM.mutate({ ...draft, name: draft.name.trim() })}
          >
            <Plus className="mr-1 h-4 w-4" /> Agregar
          </SectionButton>
        </div>
      </div>
      {(locations ?? []).length === 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Todavía no cargaste lugares de atención.
        </p>
      )}
      <Dialog
        open={!!confirmDeleteId}
        onOpenChange={(v) => {
          if (!v) setConfirmDeleteId(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-day-5">¿Eliminar lugar de atención?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. El lugar
              {(() => {
                const l = (locations ?? []).find((x: any) => x.id === confirmDeleteId);
                return l ? ` "${l.name}"` : "";
              })()}
              {` `}se borrará definitivamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <SectionButton variant="outline" onClick={() => setConfirmDeleteId(null)}>
              <X className="mr-1 h-4 w-4" /> Cancelar
            </SectionButton>
            <SectionButton
              onClick={() => {
                if (confirmDeleteId) delM.mutate(confirmDeleteId);
                setConfirmDeleteId(null);
              }}
              disabled={delM.isPending || !confirmDeleteId}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              {delM.isPending ? "Eliminando…" : "Sí, eliminar"}
            </SectionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function BookingAccessCard() {
  const fetchCfg = useServerFn(getMyConfig);
  const saveMode = useServerFn(updateBookingAccessMode);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["config"], queryFn: () => fetchCfg() });
  const [mode, setMode] = useState<"open" | "whitelist">("open");
  useEffect(() => {
    if (data) setMode(((data as any).booking_access_mode as "open" | "whitelist") ?? "open");
  }, [data]);

  const m = useMutation({
    mutationFn: () => saveMode({ data: { mode } }),
    onSuccess: () => {
      toast.success("Preferencia guardada");
      qc.invalidateQueries({ queryKey: ["config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SectionColorProvider color="day-4">
      <Card className="border-l-[6px] border-l-day-4">
        <CardHeader>
          <CardTitle className="text-day-4">Quién puede reservar turnos</CardTitle>
          <CardDescription>
            Definí si cualquier persona puede sacar turnos por el link o solo los pacientes de tu
            listado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border px-3 py-2 text-sm">
              <SectionCheckbox checked={mode === "open"} onCheckedChange={() => setMode("open")} />
              <span>
                <span className="font-medium">Abierto a cualquier persona</span>
                <span className="block text-xs text-muted-foreground">
                  Quien escriba por WhatsApp puede registrarse y reservar.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border px-3 py-2 text-sm">
              <SectionCheckbox
                checked={mode === "whitelist"}
                onCheckedChange={() => setMode("whitelist")}
              />
              <span>
                <span className="font-medium">Solo pacientes de mi listado</span>
                <span className="block text-xs text-muted-foreground">
                  Únicamente los pacientes habilitados en la sección Pacientes pueden reservar (se
                  valida DNI + teléfono).
                </span>
              </span>
            </label>
          </div>
          <div className="flex justify-end">
            <SectionButton onClick={() => m.mutate()} disabled={m.isPending}>
              {m.isPending ? "Guardando…" : "Guardar preferencia"}
            </SectionButton>
          </div>
        </CardContent>
      </Card>
    </SectionColorProvider>
  );
}

function WorkingDaysCard() {
  const fetchCfg = useServerFn(getMyConfig);
  const updateCfg = useServerFn(updateMyConfig);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["config"], queryFn: () => fetchCfg() });
  // workingDays guarda los índices [0..6] en los que el profesional atiende.
  // En la base de datos se almacena non_working_days (los días en los que NO atiende).
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  useEffect(() => {
    if (data) {
      const nonWorking = data.non_working_days ?? [];
      const working = [0, 1, 2, 3, 4, 5, 6].filter((d) => !nonWorking.includes(d));
      setWorkingDays(working);
    }
  }, [data]);

  const toggleWorkingDay = (d: number) =>
    setWorkingDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b),
    );

  const m = useMutation({
    mutationFn: () => {
      const nonWorking = [0, 1, 2, 3, 4, 5, 6].filter((d) => !workingDays.includes(d));
      return updateCfg({
        data: {
          display_name: data?.display_name ?? "",
          specialty: data?.specialty ?? "",
          address: data?.address ?? "",
          phone: data?.phone ?? "",
          maps_url: data?.maps_url ?? "",
          appointment_duration_minutes: data?.appointment_duration_minutes ?? 30,
          reminder_hour: data?.reminder_hour ?? 17,
          non_working_days: nonWorking,
          max_active_appointments_per_patient: data?.max_active_appointments_per_patient ?? 1,
        },
      });
    },
    onSuccess: () => {
      toast.success("Días laborables guardados");
      qc.invalidateQueries({ queryKey: ["config"] });
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Días de lunes a domingo
  const displayDays = [
    { label: "Lunes", index: 1 },
    { label: "Martes", index: 2 },
    { label: "Miércoles", index: 3 },
    { label: "Jueves", index: 4 },
    { label: "Viernes", index: 5 },
    { label: "Sábado", index: 6 },
    { label: "Domingo", index: 0 },
  ];

  return (
    <SectionColorProvider color="day-2">
      <Card className="border-l-[6px] border-l-day-2">
        <CardHeader>
          <CardTitle className="text-day-2">Días laborables</CardTitle>
          <CardDescription>
            Elegí los días de la semana en los que atendés pacientes. Los días desmarcados se
            considerarán no laborables y no se mostrarán en la agenda ni se ofrecerán en el portal
            de reservas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            {displayDays.map(({ label, index }) => (
              <label
                key={index}
                className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm cursor-pointer transition-colors ${
                  workingDays.includes(index)
                    ? "border-primary/40 bg-primary/5 font-medium text-foreground"
                    : "border-border bg-muted/40 text-muted-foreground"
                }`}
              >
                <SectionCheckbox
                  checked={workingDays.includes(index)}
                  onCheckedChange={() => toggleWorkingDay(index)}
                />
                {label}
              </label>
            ))}
          </div>
          <div className="flex justify-end">
            <SectionButton onClick={() => m.mutate()} disabled={m.isPending}>
              {m.isPending ? "Guardando…" : "Guardar días laborables"}
            </SectionButton>
          </div>
        </CardContent>
      </Card>
    </SectionColorProvider>
  );
}

function ScheduleCard() {
  const fetchSch = useServerFn(getMySchedule);
  const save = useServerFn(replaceMySchedule);
  const fetchCfg = useServerFn(getMyConfig);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["schedule"], queryFn: () => fetchSch() });
  const { data: cfg } = useQuery({ queryKey: ["config"], queryFn: () => fetchCfg() });
  const listLocations = useServerFn(getMyLocations);
  const { data: locations } = useQuery({ queryKey: ["locations"], queryFn: () => listLocations() });
  const nonWorking = cfg?.non_working_days ?? [];
  const availableDays = DAYS_ES.map((label, i) => ({ label, i })).filter(
    ({ i }) => !nonWorking.includes(i),
  );
  const [rows, setRows] = useState<
    Array<{ day_of_week: number; start_time: string; end_time: string; location_id: string | null }>
  >([]);
  const [confirmRemoveIndex, setConfirmRemoveIndex] = useState<number | null>(null);

  useEffect(() => {
    if (data)
      setRows(
        data.map((r: any) => ({
          day_of_week: r.day_of_week,
          start_time: (r.start_time as string).slice(0, 5),
          end_time: (r.end_time as string).slice(0, 5),
          location_id: r.location_id ?? null,
        })),
      );
  }, [data]);

  const removeConfirmed = (index: number) => {
    setRows(rows.filter((_, ix) => ix !== index));
    setConfirmRemoveIndex(null);
  };

  const m = useMutation({
    mutationFn: (slots: typeof rows) => save({ data: { slots } }),
    onSuccess: () => {
      toast.success("Horarios guardados");
      qc.invalidateQueries({ queryKey: ["schedule"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSave = () => {
    const seen = new Set<string>();
    for (const r of rows) {
      const key = `${r.day_of_week}|${r.start_time}|${r.end_time}`;
      if (seen.has(key)) {
        toast.error("No se puede guardar dos veces el mismo día con la misma franja horaria");
        return;
      }
      seen.add(key);
    }
    if (rows.some((r) => nonWorking.includes(r.day_of_week))) {
      toast.error("Hay franjas asignadas a días no laborables");
      return;
    }
    if (rows.some((r) => !r.location_id)) {
      toast.error("Cada franja horaria debe tener un lugar de atención asignado");
      return;
    }
    m.mutate(rows);
  };

  const weekOrder = (d: number) => (d + 6) % 7;
  const dayGroups = Array.from(new Set(rows.map((r) => r.day_of_week)))
    .sort((a, b) => weekOrder(a) - weekOrder(b))
    .map((day) => ({
      day,
      items: rows
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => row.day_of_week === day)
        .sort((a, b) => a.row.start_time.localeCompare(b.row.start_time)),
    }));

  return (
    <SectionColorProvider color="day-3">
      <Card className="border-l-[6px] border-l-day-3">
        <CardHeader>
          <CardTitle className="text-day-3-deep">Horarios de atención</CardTitle>
          <CardDescription>
            Bandas horarias por día y lugar de atención. Podés agregar varias por día (ej. mañana y
            tarde).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {dayGroups.map((group) => (
              <div key={group.day} className="w-full space-y-2 rounded-lg border border-border p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-day-3-deep">
                    {DAYS_ES[group.day]}
                  </span>
                  <SectionButton
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setRows([
                        ...rows,
                        {
                          day_of_week: group.day,
                          start_time: "09:00",
                          end_time: "13:00",
                          location_id: (locations?.[0] as any)?.id ?? null,
                        },
                      ])
                    }
                  >
                    <Plus className="h-4 w-4" />
                  </SectionButton>
                </div>
                {group.items.map(({ row: r, index: i }) => (
                  <div key={i} className="flex items-start gap-2 rounded-md bg-muted/40 p-2">
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="time"
                          value={r.start_time}
                          onChange={(e) =>
                            setRows(
                              rows.map((x, ix) =>
                                ix === i ? { ...x, start_time: e.target.value } : x,
                              ),
                            )
                          }
                          className="h-8 flex-1 px-1.5 text-xs"
                        />
                        <Input
                          type="time"
                          value={r.end_time}
                          onChange={(e) =>
                            setRows(
                              rows.map((x, ix) =>
                                ix === i ? { ...x, end_time: e.target.value } : x,
                              ),
                            )
                          }
                          className="h-8 flex-1 px-1.5 text-xs"
                        />
                      </div>
                      <Select
                        value={r.location_id ?? ""}
                        onValueChange={(v) =>
                          setRows(rows.map((x, ix) => (ix === i ? { ...x, location_id: v } : x)))
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Lugar de atención" />
                        </SelectTrigger>
                        <SelectContent>
                          {(locations ?? []).map((l: any) => (
                            <SelectItem key={l.id} value={l.id}>
                              {l.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <SectionButton
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => setConfirmRemoveIndex(i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </SectionButton>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Select
              value=""
              onValueChange={(v) =>
                setRows([
                  ...rows,
                  {
                    day_of_week: Number(v),
                    start_time: "09:00",
                    end_time: "13:00",
                    location_id: (locations?.[0] as any)?.id ?? null,
                  },
                ])
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Agregar día" />
              </SelectTrigger>
              <SelectContent>
                {availableDays.map(({ label, i: ix }) => (
                  <SelectItem key={ix} value={String(ix)}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <SectionButton onClick={handleSave} disabled={m.isPending}>
              {m.isPending ? "Guardando…" : "Guardar horarios"}
            </SectionButton>
          </div>
        </CardContent>
        <Dialog
          open={confirmRemoveIndex !== null}
          onOpenChange={(open) => !open && setConfirmRemoveIndex(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>¿Eliminar franja horaria?</DialogTitle>
              <DialogDescription>
                {confirmRemoveIndex !== null && (
                  <>
                    Se quitará la franja de{" "}
                    <span className="font-medium text-foreground">
                      {DAYS_ES[rows[confirmRemoveIndex].day_of_week]} de{" "}
                      {rows[confirmRemoveIndex].start_time} a {rows[confirmRemoveIndex].end_time}
                    </span>
                    . Guardá los horarios para que el cambio surta efecto.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:justify-end">
              <SectionButton variant="outline" onClick={() => setConfirmRemoveIndex(null)}>
                Cancelar
              </SectionButton>
              <SectionButton
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => confirmRemoveIndex !== null && removeConfirmed(confirmRemoveIndex)}
              >
                Eliminar
              </SectionButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    </SectionColorProvider>
  );
}

function GoogleCalendarCard() {
  const status = useServerFn(getCalendarConnectionStatus);
  const start = useServerFn(startGoogleCalendarConnect);
  const disconnect = useServerFn(disconnectGoogleCalendar);
  const complete = useServerFn(completeGoogleCalendarConnect);
  const turnosStatus = useServerFn(getTurnosCalendarStatus);
  const ensureCal = useServerFn(ensureTurnosCalendar);
  const unlinkCal = useServerFn(unlinkTurnosCalendar);
  const syncStatusFn = useServerFn(getCalendarSyncStatus);
  const saveSyncFn = useServerFn(updateCalendarSyncSettings);
  const syncNowFn = useServerFn(syncCalendarNow);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["calendar-status"], queryFn: () => status() });
  const { data: cal } = useQuery({
    queryKey: ["turnos-calendar"],
    queryFn: () => turnosStatus(),
    enabled: !!data?.connected,
  });
  const [calName, setCalName] = useState("Turnos");
  useEffect(() => {
    if (cal?.calendarName) setCalName(cal.calendarName);
  }, [cal?.calendarName]);

  const { data: sync } = useQuery({
    queryKey: ["calendar-sync"],
    queryFn: () => syncStatusFn(),
    enabled: !!data?.connected,
  });
  const [mode, setMode] = useState<"app_only" | "two_way">("app_only");
  const [interval, setIntervalMin] = useState(10);
  useEffect(() => {
    if (sync) {
      setMode((sync.mode as "app_only" | "two_way") ?? "app_only");
      setIntervalMin(sync.intervalMinutes ?? 10);
    }
  }, [sync?.mode, sync?.intervalMinutes]);

  const saveSync = useMutation({
    mutationFn: () =>
      saveSyncFn({ data: { mode, intervalMinutes: interval as 5 | 10 | 15 | 30 | 60 } }),
    onSuccess: () => {
      toast.success("Preferencias de sincronización guardadas");
      qc.invalidateQueries({ queryKey: ["calendar-sync"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runSync = useMutation({
    mutationFn: () => syncNowFn(),
    onSuccess: (r: any) => {
      if (!r?.ok) {
        toast.error(r?.error ?? "No se pudo sincronizar");
        return;
      }
      const changes =
        (r.eventsRestored ?? 0) +
        (r.eventsCreated ?? 0) +
        (r.eventsMovedBack ?? 0) +
        (r.appointmentsCancelled ?? 0) +
        (r.appointmentsRescheduled ?? 0);
      toast.success(changes === 0 ? "Todo sincronizado" : `Sincronizado: ${changes} cambio(s)`);
      (r.conflicts ?? []).forEach((c: string) => toast.warning(c));
      qc.invalidateQueries({ queryKey: ["calendar-sync"] });
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createCal = useMutation({
    mutationFn: () => ensureCal({ data: { name: calName } }),
    onSuccess: () => {
      toast.success("Calendario de turnos listo en tu cuenta de Google");
      qc.invalidateQueries({ queryKey: ["turnos-calendar"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unlink = useMutation({
    mutationFn: () => unlinkCal(),
    onSuccess: () => {
      toast.success("Calendario desvinculado (no se borró en Google)");
      qc.invalidateQueries({ queryKey: ["turnos-calendar"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function connect() {
    try {
      const popup = window.open("", "lovable-oauth", "width=600,height=720");
      if (!popup) {
        toast.error("El navegador bloqueó la ventana. Permití popups y probá de nuevo.");
        return;
      }
      const { authorizationUrl } = await start({ data: { origin: window.location.origin } });
      const completion = waitForOAuthCompletion(popup, "google_calendar");
      popup.location.href = authorizationUrl;
      const code = await completion;
      if (code) await complete({ data: { code } });
      toast.success("Google Calendar conectado");
      qc.invalidateQueries({ queryKey: ["calendar-status"] });
      qc.invalidateQueries({ queryKey: ["turnos-calendar"] });
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo conectar Google Calendar");
    }
  }

  async function onDisconnect() {
    try {
      await disconnect();
      toast.success("Google Calendar desconectado");
      qc.invalidateQueries({ queryKey: ["calendar-status"] });
      qc.invalidateQueries({ queryKey: ["turnos-calendar"] });
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo desconectar");
    }
  }

  return (
    <SectionColorProvider color="day-5">
      <Card className="border-l-[6px] border-l-day-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-day-5">
            <Calendar className="h-5 w-5" />
            Google Calendar
          </CardTitle>
          <CardDescription>
            Sincronizá tu calendario de Google para bloquear automáticamente los turnos ocupados y
            reflejar los turnos de la app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : data?.connected ? (
            <div className="space-y-4">
              {cal?.needsReauth && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
                  <p className="text-sm font-medium text-destructive">
                    El permiso de Google venció: la sincronización está detenida.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Los turnos nuevos no se están escribiendo en tu calendario. Reconectá tu cuenta
                    y se van a sincronizar automáticamente los turnos pendientes.
                  </p>
                  <SectionButton size="sm" className="mt-2" onClick={connect}>
                    Reconectar Google Calendar
                  </SectionButton>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <p
                  className={`text-sm font-medium ${cal?.needsReauth ? "text-destructive" : "text-green-600"}`}
                >
                  {cal?.needsReauth ? "⚠ Conexión vencida" : "✓ Conectado con Google Calendar"}
                </p>
                <SectionButton variant="outline" size="sm" onClick={onDisconnect}>
                  Desconectar
                </SectionButton>
              </div>
              <div className="rounded-md border border-border p-3 space-y-3">
                <div>
                  <p className="text-sm font-medium">Calendario dedicado de turnos</p>
                  <p className="text-xs text-muted-foreground">
                    Los turnos se guardan en un calendario propio dentro de tu cuenta de Google,
                    separado de tu calendario personal.
                  </p>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nombre del calendario</Label>
                    <Input
                      className="w-56"
                      value={calName}
                      onChange={(e) => setCalName(e.target.value)}
                      placeholder="Turnos"
                    />
                  </div>
                  <SectionButton
                    size="sm"
                    onClick={() => createCal.mutate()}
                    disabled={createCal.isPending}
                  >
                    {createCal.isPending
                      ? "Creando…"
                      : cal?.calendarId
                        ? "Actualizar nombre / recrear"
                        : "Crear calendario de turnos"}
                  </SectionButton>
                  {cal?.calendarId && (
                    <SectionButton
                      variant="outline"
                      size="sm"
                      onClick={() => unlink.mutate()}
                      disabled={unlink.isPending}
                    >
                      Desvincular
                    </SectionButton>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {cal?.calendarId
                    ? `✓ Activo: "${cal.calendarName}". Ya aparece en Google Calendar bajo "Mis calendarios".`
                    : "Todavía no está creado. Al crearlo, los próximos turnos se escriben ahí automáticamente."}
                </p>
              </div>
              <div className="rounded-md border border-border p-3 space-y-3">
                <div>
                  <p className="text-sm font-medium">Sincronización</p>
                  <p className="text-xs text-muted-foreground">
                    Elegí desde dónde querés manejar la agenda. La app revisa el calendario
                    periódicamente y mantiene todo alineado.
                  </p>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Modo</Label>
                    <Select
                      value={mode}
                      onValueChange={(v) => setMode(v as "app_only" | "two_way")}
                    >
                      <SelectTrigger className="w-64">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="app_only">Manejo la agenda solo desde la app</SelectItem>
                        <SelectItem value="two_way">
                          Manejo la agenda desde ambas plataformas
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cada</Label>
                    <Select
                      value={String(interval)}
                      onValueChange={(v) => setIntervalMin(Number(v))}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[5, 10, 15, 30, 60].map((v) => (
                          <SelectItem key={v} value={String(v)}>
                            {v} min
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <SectionButton
                    size="sm"
                    onClick={() => saveSync.mutate()}
                    disabled={saveSync.isPending}
                  >
                    {saveSync.isPending ? "Guardando…" : "Guardar"}
                  </SectionButton>
                  <SectionButton
                    variant="outline"
                    size="sm"
                    onClick={() => runSync.mutate()}
                    disabled={runSync.isPending}
                  >
                    <RefreshCw
                      className={`h-4 w-4 mr-1 ${runSync.isPending ? "animate-spin" : ""}`}
                    />
                    Sincronizar ahora
                  </SectionButton>
                </div>
                <p className="text-xs text-muted-foreground">
                  {mode === "app_only"
                    ? "Si borrás o movés un evento en Google Calendar, la app lo restaura automáticamente."
                    : "Si agregás un evento en Google Calendar, se toma como bloqueo de agenda; si borrás el evento de un turno, el turno se cancela; si lo movés, el turno se reprograma, siempre que el nuevo horario sea válido."}
                </p>
                <p className="text-xs text-muted-foreground">
                  {sync?.lastSyncAt
                    ? `Última sincronización: ${new Date(sync.lastSyncAt).toLocaleString("es-AR").replace(", ", " ")}`
                    : "Todavía no se sincronizó."}
                </p>
              </div>
            </div>
          ) : (
            <SectionButton size="sm" onClick={connect}>
              Conectar Google Calendar
            </SectionButton>
          )}
        </CardContent>
      </Card>
    </SectionColorProvider>
  );
}

function waitForOAuthCompletion(popup: Window, connectorId: string) {
  return new Promise<string | null>((resolve, reject) => {
    let poll: number | undefined;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (poll !== undefined) window.clearInterval(poll);
    };
    const onMessage = (event: MessageEvent) => {
      const type = event.data?.type;
      if (
        event.origin !== window.location.origin ||
        event.source !== popup ||
        event.data?.connectorId !== connectorId ||
        (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed")
      )
        return;
      cleanup();
      if (type === "appUserConnectorOAuthComplete") {
        resolve(typeof event.data?.code === "string" ? event.data.code : null);
        return;
      }
      popup.close();
      reject(new Error(event.data?.error || "La conexión no se completó."));
    };
    window.addEventListener("message", onMessage);
    poll = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      reject(
        new Error(
          "La ventana se cerró antes de completar la conexión. Si Google mostró un error de redirect_uri_mismatch, hay que registrar la URI de redireccionamiento del conector en Google Cloud Console.",
        ),
      );
    }, 500);
  });
}

function fmtDay(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

const DOW_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function DateBlocksCard() {
  const qc = useQueryClient();
  const listFn = useServerFn(getMyDateBlocks);
  const addFn = useServerFn(addDateBlock);
  const delFn = useServerFn(deleteDateBlock);
  const listLocations = useServerFn(getMyLocations);
  const blocksQ = useQuery({ queryKey: ["date-blocks"], queryFn: () => listFn() });
  const blocks = blocksQ.data ?? [];
  const locQ = useQuery({ queryKey: ["locations"], queryFn: () => listLocations() });
  const locations = locQ.data ?? [];
  const emptyBand = { start_time: "09:00", end_time: "13:00" };
  const [form, setForm] = useState({ location_id: "", start_date: "", end_date: "" });
  // Horarios por día de la semana dentro de la jornada.
  const [dayBands, setDayBands] = useState<
    Record<number, { on: boolean; bands: { start_time: string; end_time: string }[] }>
  >({});
  const rangeDows = useMemo(() => {
    if (!form.start_date) return [] as number[];
    const end = form.end_date && form.end_date >= form.start_date ? form.end_date : form.start_date;
    const [y, m, d] = form.start_date.split("-").map(Number);
    const cur = new Date(y, m - 1, d);
    const set = new Set<number>();
    let days = 0;
    while (days < 400) {
      const ymd = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
      if (ymd > end) break;
      set.add(cur.getDay());
      cur.setDate(cur.getDate() + 1);
      days++;
    }
    const order = [1, 2, 3, 4, 5, 6, 0];
    return order.filter((x) => set.has(x)).map((x) => x);
  }, [form.start_date, form.end_date]);
  const rangeLen = useMemo(() => {
    if (!form.start_date) return 0;
    const end = form.end_date && form.end_date >= form.start_date ? form.end_date : form.start_date;
    return (
      Math.round(
        (new Date(end + "T12:00:00").getTime() -
          new Date(form.start_date + "T12:00:00").getTime()) /
          86400000,
      ) + 1
    );
  }, [form.start_date, form.end_date]);
  const dayState = (dow: number) =>
    dayBands[dow] ?? { on: rangeLen < 7 || (dow >= 1 && dow <= 5), bands: [emptyBand] };
  const setDay = (
    dow: number,
    v: { on: boolean; bands: { start_time: string; end_time: string }[] },
  ) => setDayBands((prev) => ({ ...prev, [dow]: v }));
  const chosenDays = rangeDows
    .map((dow) => ({ day_of_week: dow, ...dayState(dow) }))
    .filter((d) => d.on);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["date-blocks"] });
    qc.invalidateQueries({ queryKey: ["booking-schedule"] });
    qc.invalidateQueries({ queryKey: ["availability-panel"] });
  };
  const mAdd = useMutation({
    mutationFn: () =>
      addFn({
        data: {
          ...form,
          end_date: form.end_date || form.start_date,
          days: chosenDays.map((d) => ({ day_of_week: d.day_of_week, bands: d.bands })),
        },
      }),
    onSuccess: () => {
      toast.success("Jornada guardada");
      setForm((f) => ({ ...f, start_date: "", end_date: "" }));
      setDayBands({});
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo guardar"),
  });
  const mDel = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: refresh,
    onError: (e: any) => toast.error(e?.message ?? "No se pudo eliminar"),
  });
  const locName = (id: string) => {
    const l = (locations as any[]).find((x) => x.id === id);
    return l ? [l.city, l.name].filter(Boolean).join(" · ") : "Sede eliminada";
  };
  const canSave =
    !!form.location_id &&
    !!form.start_date &&
    chosenDays.length > 0 &&
    chosenDays.every((d) => d.bands.length > 0 && d.bands.every((b) => b.start_time < b.end_time));
  // Agrupa las franjas de una misma sede y rango de fechas.
  const groups = useMemo(() => {
    const m = new Map<
      string,
      { location_id: string; start_date: string; end_date: string; rows: any[] }
    >();
    for (const b of blocks as any[]) {
      const k = `${b.location_id}|${b.start_date}|${b.end_date}`;
      if (!m.has(k))
        m.set(k, {
          location_id: b.location_id,
          start_date: b.start_date,
          end_date: b.end_date,
          rows: [],
        });
      m.get(k)!.rows.push(b);
    }
    const dk = (d: number | null) => (d == null ? -1 : (d + 6) % 7);
    for (const g of m.values())
      g.rows.sort(
        (x, y) =>
          dk(x.day_of_week) - dk(y.day_of_week) ||
          String(x.start_time).localeCompare(String(y.start_time)),
      );
    return [...m.values()].sort((x, y) => x.start_date.localeCompare(y.start_date));
  }, [blocks]);

  return (
    <SectionColorProvider color="day-3">
      <Card className="border-l-[6px] border-l-day-3">
        <CardHeader>
          <CardTitle className="text-day-3-deep">Jornadas por fecha y sede</CardTitle>
          <CardDescription>
            Para quienes trabajan por días puntuales en distintas ciudades. Un día con jornada tiene
            prioridad: solo se ofrecen turnos en esa sede y en sus franjas, y no se usan los
            horarios semanales. Cada día o rango puede tener varias franjas horarias.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(blocksQ.isError || locQ.isError) && (
            <p className="text-sm text-destructive">
              No se pudieron cargar las jornadas.{" "}
              <button
                type="button"
                className="underline"
                onClick={() => {
                  blocksQ.refetch();
                  locQ.refetch();
                }}
              >
                Reintentar
              </button>
            </p>
          )}
          {(blocksQ.isPending || locQ.isPending) && !(blocksQ.isError || locQ.isError) ? (
            <p className="text-sm text-muted-foreground">Cargando jornadas…</p>
          ) : locQ.isError ? null : (locations as any[]).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Primero cargá tus sedes en la solapa «Lugares».
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Sede *</Label>
                <Select
                  value={form.location_id}
                  onValueChange={(v) => setForm({ ...form, location_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Elegí la sede" />
                  </SelectTrigger>
                  <SelectContent>
                    {(locations as any[]).map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {locName(l.id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="db-from">Desde *</Label>
                <Input
                  id="db-from"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="db-to">Hasta</Label>
                <Input
                  id="db-to"
                  type="date"
                  min={form.start_date}
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
              <div className="space-y-3 sm:col-span-2">
                <Label>Horarios de cada día *</Label>
                {rangeDows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Elegí las fechas y te mostramos los días de la semana que incluye la jornada.
                  </p>
                ) : (
                  rangeDows.map((dow) => {
                    const st = dayState(dow);
                    return (
                      <div key={dow} className="rounded-lg border border-border p-2">
                        <label className="flex items-center gap-2 text-sm font-semibold">
                          <input
                            type="checkbox"
                            checked={st.on}
                            onChange={(e) => setDay(dow, { ...st, on: e.target.checked })}
                          />
                          {DOW_NAMES[dow]}
                          {!st.on && (
                            <span className="font-normal text-muted-foreground">· no atiende</span>
                          )}
                        </label>
                        {st.on && (
                          <div className="mt-2 space-y-2">
                            {st.bands.map((b, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <Input
                                  type="time"
                                  aria-label={`${DOW_NAMES[dow]} inicio franja ${i + 1}`}
                                  value={b.start_time}
                                  onChange={(e) =>
                                    setDay(dow, {
                                      ...st,
                                      bands: st.bands.map((x, j) =>
                                        j === i ? { ...x, start_time: e.target.value } : x,
                                      ),
                                    })
                                  }
                                />
                                <span className="text-sm text-muted-foreground">a</span>
                                <Input
                                  type="time"
                                  aria-label={`${DOW_NAMES[dow]} fin franja ${i + 1}`}
                                  value={b.end_time}
                                  onChange={(e) =>
                                    setDay(dow, {
                                      ...st,
                                      bands: st.bands.map((x, j) =>
                                        j === i ? { ...x, end_time: e.target.value } : x,
                                      ),
                                    })
                                  }
                                />
                                {st.bands.length > 1 && (
                                  <SectionButton
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Quitar franja ${i + 1} del ${DOW_NAMES[dow]}`}
                                    onClick={() =>
                                      setDay(dow, {
                                        ...st,
                                        bands: st.bands.filter((_, j) => j !== i),
                                      })
                                    }
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </SectionButton>
                                )}
                              </div>
                            ))}
                            {st.bands.length < 6 && (
                              <SectionButton
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setDay(dow, {
                                    ...st,
                                    bands: [
                                      ...st.bands,
                                      { start_time: "16:00", end_time: "20:00" },
                                    ],
                                  })
                                }
                              >
                                <Plus className="mr-1 h-4 w-4" /> Agregar franja
                              </SectionButton>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              <div className="sm:col-span-2">
                <SectionButton onClick={() => mAdd.mutate()} disabled={!canSave || mAdd.isPending}>
                  <Plus className="mr-1 h-4 w-4" />{" "}
                  {mAdd.isPending ? "Guardando…" : "Guardar jornada"}
                </SectionButton>
              </div>
            </div>
          )}
          {groups.length > 0 && (
            <ul className="space-y-2">
              {groups.map((g) => (
                <li
                  key={`${g.location_id}|${g.start_date}|${g.end_date}`}
                  className="rounded-lg border border-border p-2 text-sm"
                >
                  <div className="font-semibold text-day-3-deep">{locName(g.location_id)}</div>
                  <div className="text-muted-foreground">
                    {g.start_date === g.end_date
                      ? fmtDay(g.start_date)
                      : `${fmtDay(g.start_date)} al ${fmtDay(g.end_date)}`}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {g.rows.map((b) => (
                      <span
                        key={b.id}
                        className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5"
                      >
                        {b.day_of_week != null && (
                          <strong className="font-semibold">
                            {DOW_NAMES[b.day_of_week].slice(0, 3)}
                          </strong>
                        )}
                        {String(b.start_time).slice(0, 5)} a {String(b.end_time).slice(0, 5)}
                        <button
                          type="button"
                          aria-label="Eliminar franja"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => mDel.mutate(b.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </SectionColorProvider>
  );
}

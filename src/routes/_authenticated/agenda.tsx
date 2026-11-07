import { safeGet, safeSet } from "@/lib/safeStorage";
import { createFileRoute } from "@tanstack/react-router";
import { PhoneInput } from "@/components/PhoneInput";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmBadge } from "@/components/agenda/ConfirmBadge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  listAppointmentsBetween,
  cancelAppointment,
  rescheduleAppointment,
  markAttendance,
  updateAppointmentNotes,
} from "@/lib/api/appointments.functions";
import { createAppointment } from "@/lib/api/appointments.functions";
import { findOrCreatePatient, listMyPatients } from "@/lib/api/patients.functions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
import { getMyConfig } from "@/lib/api/config.functions";
import { getPatientLastVisit } from "@/lib/api/appointments.functions";
import {
  getMyTimeOff,
  getMyBookingSchedule,
  addTimeOff,
  deleteTimeOff,
} from "@/lib/api/schedule.functions";
import { getMyLocations } from "@/lib/api/locations.functions";
import { bookableLocations } from "@/lib/domain/dateBlocks";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CalendarX2,
  MessageCircle,
  Phone,
  MoreHorizontal,
  RefreshCw,
  Check,
  AlertCircle,
  PhoneOff,
  Plus,
  Trash2,
  ChevronsUpDown,
  ListOrdered,
  MapPin,
} from "lucide-react";
import {
  syncCalendarNow,
  listGoogleCalendarEvents,
  getCalendarBusyRanges,
} from "@/lib/api/calendar.functions";
import { formatTime, formatDateLong, computeAvailableSlots } from "@/lib/domain/availability";
import { calendarDayInTz, wallClockToUtc } from "@/lib/domain/timezone";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Popover, PopoverTrigger, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarOff as TimeOffIcon, Trash2 as TimeOffTrash } from "lucide-react";
import { WeekGrid } from "@/components/agenda/WeekGrid";
import { UpcomingPanel } from "@/components/agenda/UpcomingPanel";
import { RetentionNotice } from "@/components/RetentionNotice";
import { getMyAppointmentTypes } from "@/lib/api/appointmentTypes.functions";
import { sendAppointmentReminder } from "@/lib/api/whatsapp.functions";
import { MobileSlotList } from "@/components/agenda/MobileSlotList";
import { mobileSlotsKey } from "@/components/agenda/mobileSlots";
import { placeForSlot } from "@/components/agenda/slotLocation";
import { visibleRangeFor } from "@/lib/agendaRange";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda de turnos — Agendera — La agenda que se maneja sola" },
      {
        name: "description",
        content: "Gestioná tu agenda de turnos por semana, grilla o mes desde un solo panel.",
      },
      { name: "robots", content: "noindex" },
      {
        property: "og:title",
        content: "Agenda de turnos — Agendera — La agenda que se maneja sola",
      },
      {
        property: "og:description",
        content: "Gestioná tu agenda de turnos por semana, grilla o mes desde un solo panel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700;12..96,800&display=swap",
      },
    ],
  }),
  component: AgendaPage,
});

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  // Weeks start on Monday so the week view, the grid and the fetched range agree.
  x.setDate(x.getDate() - ((day + 6) % 7));
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}
function startOfMonth(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfMonth(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  active: { label: "Activo", className: "bg-emerald-100/80 text-emerald-700 border-emerald-200" },
  pending: { label: "Pendiente", className: "bg-amber-100/80 text-amber-700 border-amber-200" },
  rescheduled: {
    label: "Reprogramado",
    className: "bg-secondary text-secondary-foreground border-border",
  },
  cancelled: { label: "Cancelado", className: "bg-rose-100/80 text-rose-700 border-rose-200" },
  completed: { label: "Finalizado", className: "bg-muted text-muted-foreground border-border" },
  inactive: { label: "Inactivo", className: "bg-muted text-muted-foreground border-border" },
};

// Color-coded left-border tints for day cards (matches the reference design).
const DAY_TINTS = [
  { border: "border-l-day-1", title: "text-day-1", icon: "text-day-1", soft: "bg-day-1-soft" },
  { border: "border-l-day-2", title: "text-day-2", icon: "text-day-2", soft: "bg-day-2-soft" },
  { border: "border-l-day-3", title: "text-day-3-deep", icon: "text-day-3", soft: "bg-day-3-soft" },
  { border: "border-l-day-4", title: "text-day-4", icon: "text-day-4", soft: "bg-day-4-soft" },
  { border: "border-l-day-5", title: "text-day-5", icon: "text-day-5", soft: "bg-day-5-soft" },
  { border: "border-l-day-6", title: "text-day-6", icon: "text-day-6", soft: "bg-day-6-soft" },
];

const ATTENDANCE_META: Record<string, { label: string; className: string }> = {
  attended: {
    label: "Asistió",
    className: "bg-emerald-100/80 text-emerald-700 border-emerald-200",
  },
  absent_notified: {
    label: "Ausente c/aviso",
    className: "bg-amber-100/80 text-amber-700 border-amber-200",
  },
  absent_no_notice: {
    label: "Ausente s/aviso",
    className: "bg-rose-100/80 text-rose-700 border-rose-200",
  },
};

function digitsOnly(s?: string | null) {
  return (s ?? "").replace(/\D/g, "");
}

function AgendaPage() {
  const list = useServerFn(listAppointmentsBetween);
  const cancel = useServerFn(cancelAppointment);
  const reschedule = useServerFn(rescheduleAppointment);
  const setAttendance = useServerFn(markAttendance);
  const saveNotes = useServerFn(updateAppointmentNotes);
  const fetchCfg = useServerFn(getMyConfig);
  const fetchTimeOff = useServerFn(getMyTimeOff);
  const qc = useQueryClient();
  const syncCalendar = useServerFn(syncCalendarNow);
  const syncNow = useMutation({
    mutationFn: () => syncCalendar(),
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
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const [anchor, setAnchor] = useState(new Date());
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [view, setView] = useState<"week" | "grid" | "month">(() => {
    if (typeof window === "undefined") return "week";
    const saved = safeGet("local", "agenda-view");
    return saved === "week" || saved === "grid" || saved === "month" ? saved : "week";
  });
  useEffect(() => {
    safeSet("local", "agenda-view", view);
  }, [view]);
  const [detail, setDetail] = useState<any | null>(null);
  const [blockDetail, setBlockDetail] = useState<any | null>(null);
  const [toCancel, setToCancel] = useState<any | null>(null);
  const [toReschedule, setToReschedule] = useState<any | null>(null);
  const [toNotes, setToNotes] = useState<any | null>(null);
  const [notesText, setNotesText] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [npStep, setNpStep] = useState(0);
  const emptyForm = {
    first_name: "",
    last_name: "",
    dni: "",
    phone: "",
    email: "",
    start: "",
    notes: "",
    type_id: "" as string,
    custom_minutes: 30,
  };
  const [form, setForm] = useState(emptyForm);
  // Time-off dialog
  const [timeOffOpen, setTimeOffOpen] = useState(false);
  const [toDeleteTimeOff, setToDeleteTimeOff] = useState<{ id: string; reason?: string } | null>(
    null,
  );
  const [timeOffForm, setTimeOffForm] = useState({
    start_date: "",
    end_date: "",
    reason: "",
    partial: false,
    start_time: "09:00",
    end_time: "12:00",
  });
  const createAppt = useServerFn(createAppointment);
  const upsertPatient = useServerFn(findOrCreatePatient);
  const fetchPatients = useServerFn(listMyPatients);
  const fetchSchedule = useServerFn(getMyBookingSchedule);
  const fetchBusy = useServerFn(getCalendarBusyRanges);
  const addTimeOffFn = useServerFn(addTimeOff);
  const deleteTimeOffFn = useServerFn(deleteTimeOff);
  const week = useMemo(() => startOfWeek(anchor), [anchor]);
  const monthStart = useMemo(() => startOfMonth(anchor), [anchor]);
  const monthEnd = useMemo(() => endOfMonth(anchor), [anchor]);
  // Single source of truth: visible first day (inclusive) and end (exclusive).
  // Header, columns/cells and the appointments query all derive from it.
  const visibleRange = useMemo(() => visibleRangeFor(view, anchor), [view, anchor]);
  void monthEnd;
  const from = visibleRange.start.toISOString();
  const to = visibleRange.end.toISOString();

  const apptQuery = useQuery({
    queryKey: ["appointments", from, to],
    queryFn: () => list({ data: { from, to } }),
    placeholderData: keepPreviousData,
  });
  const appointmentRows = apptQuery.data ?? [];
  // Rows from a previous range are kept on screen while the new range loads,
  // but an "empty day" is only stated once this exact range has answered.
  const apptConfirmed = apptQuery.isSuccess && !apptQuery.isPlaceholderData;
  const data = useMemo(
    () => appointmentRows.filter((appointment: any) => appointment.status !== "cancelled"),
    [appointmentRows],
  );
  const { data: cfg } = useQuery({ queryKey: ["config"], queryFn: () => fetchCfg() });
  const listEvents = useServerFn(listGoogleCalendarEvents);
  const calQuery = useQuery({
    queryKey: ["calendar-events", from, to],
    queryFn: () => listEvents({ data: { timeMin: from, timeMax: to } }),
    retry: false,
    placeholderData: keepPreviousData,
  });
  const calendarEvents = calQuery.data ?? [];
  // Events created by hand in Google are blocks, not appointments.
  const blocks = useMemo(() => {
    const appointmentEventIds = new Set(
      (appointmentRows as any[]).map((a) => a.calendar_event_id).filter(Boolean),
    );
    return (calendarEvents as any[]).filter((e) => !appointmentEventIds.has(e.id));
  }, [calendarEvents, appointmentRows]);
  const nonWorking = cfg?.non_working_days ?? [];
  const { data: timeOff = [] } = useQuery({
    queryKey: ["time_off"],
    queryFn: () => fetchTimeOff(),
  });
  const timeOffFor = (d: Date) => {
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);
    return (timeOff as any[]).find((t) => {
      if (t.start_time) return false;
      const s = new Date(t.start_date);
      s.setHours(0, 0, 0, 0);
      const e = new Date(t.end_date);
      e.setHours(0, 0, 0, 0);
      return day.getTime() >= s.getTime() && day.getTime() <= e.getTime();
    });
  };
  const isBlocked = (d: Date) => !!timeOffFor(d);
  // Partial-day absences rendered as timed blocks in the week grid.
  const timeOffRangesFor = (d: Date) => {
    const ymd = d.toLocaleDateString("en-CA");
    return (timeOff as any[])
      .filter((t) => t.start_time && t.end_time && ymd >= t.start_date && ymd <= t.end_date)
      .map((t) => {
        const [sh, sm] = String(t.start_time).split(":").map(Number);
        const [eh, em] = String(t.end_time).split(":").map(Number);
        const s = new Date(d);
        s.setHours(sh, sm, 0, 0);
        const e = new Date(d);
        e.setHours(eh, em, 0, 0);
        return {
          id: t.id,
          reason: t.reason,
          start: s.toISOString(),
          end: e.toISOString(),
          summary: `Ausencia${t.reason ? ` · ${t.reason}` : ""}`,
        };
      });
  };

  const mCancel = useMutation({
    mutationFn: (id: string) => cancel({ data: { id } }),
    onSuccess: async () => {
      toast.success("Turno eliminado");
      setToCancel(null);
      await qc.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mAttendance = useMutation({
    mutationFn: (v: { id: string; attendance: string }) => setAttendance({ data: v as any }),
    onSuccess: async (_r, v) => {
      toast.success("Asistencia registrada");
      setDetail((prev: any) =>
        prev && prev.id === v.id ? { ...prev, attendance: v.attendance } : prev,
      );
      await qc.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendReminder = useServerFn(sendAppointmentReminder);
  const mReminder = useMutation({
    mutationFn: (id: string) => sendReminder({ data: { appointmentId: id } }),
    onSuccess: async (_r, id) => {
      toast.success("Recordatorio enviado por WhatsApp");
      setDetail((prev: any) =>
        prev && prev.id === id ? { ...prev, reminder_sent_at: new Date().toISOString() } : prev,
      );
      await qc.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const today = new Date();

  // Prompt to mark attendance for past appointments still pending
  const [attendanceSkipped, setAttendanceSkipped] = useState<string[]>([]);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const pendingAttendance = useMemo(
    () =>
      (data as any[]).filter(
        (a) =>
          new Date(a.end_at ?? a.start_at).getTime() < Date.now() &&
          (!a.attendance || a.attendance === "pending") &&
          !attendanceSkipped.includes(a.id),
      ),
    [data, attendanceSkipped],
  );
  useEffect(() => {
    setAttendanceOpen(pendingAttendance.length > 0);
  }, [pendingAttendance.length]);

  const mReschedule = useMutation({
    mutationFn: async () => {
      if (!toReschedule || !form.start) throw new Error("Elegí un día y un horario.");
      const start = new Date(form.start);
      const end = new Date(start.getTime() + slotMinutes * 60_000);
      return reschedule({
        data: {
          id: toReschedule.id,
          start_at: start.toISOString(),
          end_at: end.toISOString(),
          notes: form.notes.trim(),
          appointment_type_id: form.type_id && form.type_id !== "other" ? form.type_id : null,
          appointment_type_name: selectedTypeName,
        },
      });
    },
    onSuccess: async () => {
      toast.success("Turno reprogramado");
      closeNewDialog();
      await qc.invalidateQueries({ queryKey: ["appointments"] });
      await qc.invalidateQueries({ queryKey: ["availability-panel"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openReschedule(a: any) {
    const d = new Date(a.start_at);
    const minutes = Math.max(
      5,
      Math.round((new Date(a.end_at).getTime() - d.getTime()) / 60_000) || 30,
    );
    const typeId = a.appointment_type_id ?? (a.appointment_type_name ? "other" : "");
    setForm({
      ...emptyForm,
      first_name: a.patient?.first_name ?? "",
      last_name: a.patient?.last_name ?? "",
      notes: a.notes ?? "",
      type_id: typeId,
      custom_minutes: minutes,
    });
    resetCustomTime();
    setPickedMonth("");
    setPickedDay(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
    setToReschedule(a);
    setNpStep(1);
    setNewOpen(true);
  }

  function closeNewDialog() {
    setNewOpen(false);
    setNpStep(0);
    setForm(emptyForm);
    setPatientSearch("");
    setPatientPickerOpen(false);
    resetCustomTime();
    setToReschedule(null);
    setNpLocation("");
  }

  const mNotes = useMutation({
    mutationFn: async () => {
      if (!toNotes) throw new Error("Turno no encontrado.");
      return saveNotes({ data: { id: toNotes.id, notes: notesText } });
    },
    onSuccess: async () => {
      toast.success("Notas guardadas");
      setToNotes(null);
      await qc.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lastVisitFn = useServerFn(getPatientLastVisit);
  const lastVisitQuery = useQuery({
    queryKey: ["last-visit", detail?.patient?.id, detail?.start_at],
    enabled: !!detail?.patient?.id,
    queryFn: () =>
      lastVisitFn({ data: { patient_id: detail!.patient!.id, before: detail!.start_at } }),
  });

  function openNotes(a: any) {
    setNotesText(a.notes ?? "");
    setToNotes(a);
  }

  const fetchTypes = useServerFn(getMyAppointmentTypes);
  const {
    data: apptTypes = [],
    isPending: typesPending,
    isError: typesError,
    refetch: refetchTypes,
  } = useQuery({
    queryKey: ["appointment-types"],
    queryFn: () => fetchTypes(),
  });
  const fetchLocations = useServerFn(getMyLocations);
  const { data: locations = [] } = useQuery({
    queryKey: ["locations"],
    queryFn: () => fetchLocations(),
  });
  const { data: scheduleRows = [] } = useQuery({
    queryKey: ["booking-schedule"],
    queryFn: () => fetchSchedule(),
  });
  // Sede elegida para el turno: con más de una, solo se ofrecen sus días y horarios.
  const [npLocation, setNpLocation] = useState("");
  const npSedes = useMemo(
    () =>
      bookableLocations(
        locations as any[],
        scheduleRows as any[],
        new Date().toLocaleDateString("en-CA"),
      ),
    [locations, scheduleRows],
  );
  // Con una sola sede se toma por defecto; con varias, el lugar es el primer paso obligatorio.
  useEffect(() => {
    if (npSedes.length === 1 && npLocation !== (npSedes[0] as any).id)
      setNpLocation((npSedes[0] as any).id);
  }, [npSedes, npLocation]);
  const selectedType = (apptTypes as any[]).find((t) => t.id === form.type_id);
  const isOtherType = form.type_id === "other";
  const slotMinutes = isOtherType
    ? Math.max(5, form.custom_minutes || 0)
    : (selectedType?.duration_minutes ?? cfg?.appointment_duration_minutes ?? 30);
  const selectedTypeName = isOtherType ? "Otro" : (selectedType?.name ?? "");
  // Where the picked time is attended: the schedule band that covers it.
  const appointmentPlace = useMemo(
    () =>
      placeForSlot({
        startIso: form.start,
        durationMinutes: slotMinutes,
        schedule: (scheduleRows as any[]).map((r) => ({
          ...r,
          start_time: String(r.start_time).slice(0, 5),
          end_time: String(r.end_time).slice(0, 5),
        })),
        locations: locations as any[],
        timezone: (cfg as any)?.timezone || undefined,
        fallbackAddress: (cfg as any)?.address ?? "",
      }),
    [form.start, slotMinutes, scheduleRows, locations, cfg],
  );
  // Where the appointment opened in the detail dialog is attended.
  const detailPlace = useMemo(() => {
    if (!detail?.start_at) return null;
    const start = new Date(detail.start_at);
    if (Number.isNaN(start.getTime())) return null;
    const end = new Date(detail.end_at ?? detail.start_at);
    const minutes = Number.isNaN(end.getTime())
      ? slotMinutes
      : Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
    const tz = (cfg as any)?.timezone;
    return placeForSlot({
      startIso: detail.start_at,
      durationMinutes: minutes,
      schedule: (scheduleRows as any[]).map((r) => ({
        ...r,
        start_time: String(r.start_time).slice(0, 5),
        end_time: String(r.end_time).slice(0, 5),
      })),
      locations: locations as any[],
      timezone: tz || undefined,
      fallbackAddress: (cfg as any)?.address ?? "",
      dayKey: tz ? calendarDayInTz(start, tz).ymd : undefined,
    });
  }, [detail?.start_at, detail?.end_at, slotMinutes, scheduleRows, locations, cfg]);

  const mCreate = useMutation({
    mutationFn: async () => {
      if (!form.first_name.trim() || !form.last_name.trim())
        throw new Error("Ingresá nombre y apellido.");
      if (!form.phone.trim()) throw new Error("Ingresá el teléfono.");
      if (!form.start) throw new Error("Elegí un día y un horario disponible.");
      const patient: any = await upsertPatient({
        data: {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          dni: form.dni.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
        },
      });
      const start = new Date(form.start);
      const minutes = slotMinutes;
      const end = new Date(start.getTime() + minutes * 60_000);
      return createAppt({
        data: {
          patient_id: patient.id,
          start_at: start.toISOString(),
          end_at: end.toISOString(),
          notes: form.notes.trim(),
          appointment_type_id: form.type_id && form.type_id !== "other" ? form.type_id : null,
          appointment_type_name: selectedTypeName,
        },
      });
    },
    onSuccess: async () => {
      toast.success("Turno creado");
      setNewOpen(false);
      setNpStep(0);
      setForm(emptyForm);
      resetCustomTime();
      await qc.invalidateQueries({ queryKey: ["appointments"] });
      await qc.invalidateQueries({ queryKey: ["availability-panel"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mAddTimeOff = useMutation({
    mutationFn: () => {
      const { partial, start_time, end_time, ...rest } = timeOffForm;
      return addTimeOffFn({
        data: {
          ...rest,
          start_time: partial ? start_time : null,
          end_time: partial ? end_time : null,
        },
      });
    },
    onSuccess: async () => {
      toast.success("Ausencia agregada");
      setTimeOffForm({
        start_date: "",
        end_date: "",
        reason: "",
        partial: false,
        start_time: "09:00",
        end_time: "12:00",
      });
      await qc.invalidateQueries({ queryKey: ["time_off"] });
      await qc.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mDeleteTimeOff = useMutation({
    mutationFn: (id: string) => deleteTimeOffFn({ data: { id } }),
    onSuccess: async () => {
      toast.success("Ausencia eliminada");
      await qc.invalidateQueries({ queryKey: ["time_off"] });
      await qc.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: knownPatients = [] } = useQuery({
    queryKey: ["patients-active"],
    queryFn: () => fetchPatients(),
    enabled: newOpen,
  });

  const [patientSearch, setPatientSearch] = useState("");
  const [patientPickerOpen, setPatientPickerOpen] = useState(false);
  const patientPickerRef = useRef<HTMLDivElement>(null);

  const filteredPatients = useMemo(() => {
    const q = patientSearch.trim().toLowerCase();
    const list = knownPatients as any[];
    if (!q) return list;
    return list.filter((p) =>
      `${p.first_name} ${p.last_name} ${p.dni} ${p.phone}`.toLowerCase().includes(q),
    );
  }, [knownPatients, patientSearch]);

  // Available days/slots for the manual booking panel
  const [pickedDay, setPickedDay] = useState<string>("");
  const { data: availability = [], isLoading: loadingAvailability } = useQuery({
    queryKey: ["availability-panel", slotMinutes, toReschedule?.id ?? null, npLocation],
    enabled: newOpen && !!cfg,
    queryFn: async () => {
      const lookahead = 120;
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + lookahead);
      end.setHours(23, 59, 59, 999);
      const [scheduleRows, offRows, apptsAll, busyAll] = await Promise.all([
        fetchSchedule(),
        fetchTimeOff(),
        list({ data: { from: start.toISOString(), to: end.toISOString() } }),
        fetchBusy({ data: { timeMin: start.toISOString(), timeMax: end.toISOString() } }).catch(
          () => [],
        ),
      ]);
      // When rescheduling, the appointment's own current time counts as free.
      const ownId = toReschedule?.id;
      const ownStart = toReschedule ? new Date(toReschedule.start_at).getTime() : NaN;
      const ownEnd = toReschedule ? new Date(toReschedule.end_at).getTime() : NaN;
      const appts = ownId ? (apptsAll as any[]).filter((a) => a.id !== ownId) : apptsAll;
      const busy = ownId
        ? ((busyAll as any[]) ?? []).filter(
            (b) =>
              !(new Date(b.start).getTime() === ownStart && new Date(b.end).getTime() === ownEnd),
          )
        : busyAll;
      const normalized = (scheduleRows as any[]).map((r) => ({
        ...r,
        start_time: String(r.start_time).slice(0, 5),
        end_time: String(r.end_time).slice(0, 5),
      }));
      const out: {
        date: string;
        label: string;
        dayNum: number;
        dowShort: string;
        monthLabel: string;
        slots: { value: string; label: string }[];
        overrideSlots: { value: string; label: string }[];
      }[] = [];
      for (let i = 0; i < lookahead; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const slots = computeAvailableSlots(
          d,
          {
            appointment_duration_minutes: slotMinutes,
            non_working_days: cfg?.non_working_days ?? [],
            timezone: (cfg as any)?.timezone || undefined,
          },
          normalized as any,
          offRows as any,
          appts as any,
          (busy as any) ?? [],
          npLocation || null,
        );
        // Slots the professional can force on non-working / blocked days.
        let overrideSlots: { value: string; label: string }[] = [];
        const dowHere = d.getDay();
        const ymdHere = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        // With a chosen location, a day only exists if that location works it:
        // a jornada counts only inside its date range and on its weekdays.
        const locationWorksDay =
          !npLocation ||
          (normalized as any[]).some(
            (b) =>
              b.location_id === npLocation &&
              (b.start_date && b.end_date
                ? ymdHere >= b.start_date &&
                  ymdHere <= b.end_date &&
                  (b.dated_dow == null || b.dated_dow === dowHere)
                : b.day_of_week === dowHere),
          );
        if (!locationWorksDay && slots.length === 0) continue;
        if (slots.length === 0) {
          const dow = dowHere;
          const sameDowBands = (normalized as any[]).filter((r) => r.day_of_week === dow);
          const uniqueBands = new Map<string, { start_time: string; end_time: string }>();
          for (const b of sameDowBands.length > 0 ? sameDowBands : (normalized as any[])) {
            uniqueBands.set(`${b.start_time}-${b.end_time}`, {
              start_time: b.start_time,
              end_time: b.end_time,
            });
          }
          const bands =
            uniqueBands.size > 0
              ? [...uniqueBands.values()]
              : [{ start_time: "08:00", end_time: "20:00" }];
          const forced = computeAvailableSlots(
            d,
            {
              appointment_duration_minutes: slotMinutes,
              non_working_days: [],
              timezone: (cfg as any)?.timezone || undefined,
            },
            bands.map((b, idx) => ({ id: String(idx), day_of_week: dow, ...b })) as any,
            [],
            appts as any,
            (busy as any) ?? [],
          );
          const seen = new Set<string>();
          overrideSlots = forced
            .map((s) => ({ value: s.start.toISOString(), label: formatTime(s.start) }))
            .filter((s) => (seen.has(s.value) ? false : (seen.add(s.value), true)))
            .sort((a, b) => a.value.localeCompare(b.value));
        }
        out.push({
          date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
          label: formatDateLong(d).replace(",", ""),
          dayNum: d.getDate(),
          dowShort: d.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", ""),
          monthLabel: d.toLocaleDateString("es-AR", { month: "long", year: "numeric" }),
          slots: slots.map((s) => ({ value: s.start.toISOString(), label: formatTime(s.start) })),
          overrideSlots,
        });
      }
      return out;
    },
  });
  const pickedDayInfo = (availability as any[]).find((d) => d.date === pickedDay);
  const isOverrideDay = !!pickedDayInfo && (pickedDayInfo.slots?.length ?? 0) === 0;
  const daySlots = isOverrideDay
    ? (pickedDayInfo?.overrideSlots ?? [])
    : (pickedDayInfo?.slots ?? []);
  const [confirmOverride, setConfirmOverride] = useState(false);
  // Custom time: book outside the scheduled working hours (with a warning).
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [customTime, setCustomTime] = useState("");
  function customStartIso(time: string): string {
    if (!pickedDay || !time) return "";
    const [y, m, d] = pickedDay.split("-").map(Number);
    const [hh, mm] = time.split(":").map(Number);
    const tz = (cfg as any)?.timezone || undefined;
    const dt = tz ? wallClockToUtc(y, m, d, hh, mm, tz) : new Date(y, m - 1, d, hh, mm);
    return dt.toISOString();
  }
  const isOutsideHours = isOverrideDay || useCustomTime;
  function resetCustomTime() {
    setUseCustomTime(false);
    setCustomTime("");
  }
  const [pickedMonth, setPickedMonth] = useState<string>("");
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const yearOptions = useMemo(
    () => [currentYear, currentYear + 1, currentYear + 2].map(String),
    [currentYear],
  );
  const defaultMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
  const activeMonth = pickedMonth || pickedDay.slice(0, 7) || defaultMonth;
  const activeYear = activeMonth.slice(0, 4);
  const monthsOfYear = useMemo(() => {
    const y = Number(activeYear);
    const startM = y === currentYear ? currentMonth : 0;
    const out: { value: string; label: string }[] = [];
    for (let m = startM; m <= 11; m++) {
      out.push({
        value: `${y}-${String(m + 1).padStart(2, "0")}`,
        label: new Date(y, m, 1).toLocaleDateString("es-AR", { month: "long" }),
      });
    }
    return out;
  }, [activeYear, currentYear, currentMonth]);
  const availByDate = useMemo(() => {
    const m = new Map<string, any>();
    for (const d of availability as any[]) m.set(d.date, d);
    return m;
  }, [availability]);
  const monthDays = useMemo(() => {
    const [y, m] = activeMonth.split("-").map(Number);
    if (!y || !m) return [] as any[];
    const days: any[] = [];
    const total = new Date(y, m, 0).getDate();
    const todayKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    for (let dd = 1; dd <= total; dd++) {
      const key = `${y}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
      if (key < todayKey) continue;
      const found = availByDate.get(key);
      const d = new Date(y, m - 1, dd);
      days.push(
        found ?? {
          date: key,
          label: formatDateLong(d).replace(",", ""),
          dayNum: dd,
          dowShort: d.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", ""),
          monthLabel: d.toLocaleDateString("es-AR", { month: "long", year: "numeric" }),
          slots: [],
          overrideSlots: [],
        },
      );
    }
    return days;
  }, [activeMonth, availByDate, currentYear, currentMonth]);
  function selectMonthValue(v: string) {
    setPickedMonth(v);
    setPickedDay("");
    resetCustomTime();
    setForm((f) => ({ ...f, start: "" }));
  }

  function openNew(date?: Date) {
    setForm(emptyForm);
    resetCustomTime();
    setPickedDay(
      date
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
        : "",
    );
    setNewOpen(true);
  }
  const isCurrentWeek = sameDay(week, startOfWeek(today));
  const isCurrentMonth =
    today.getFullYear() === monthStart.getFullYear() && today.getMonth() === monthStart.getMonth();

  // Week view: list of working days (unchanged behaviour)
  const days = useMemo(() => {
    const out: { date: Date; items: any[]; blocks: any[] }[] = [];
    for (const d of visibleRange.days) {
      const items = data
        .filter((a: any) => sameDay(new Date(a.start_at), d))
        .sort((a: any, b: any) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
      const dayBlocks = blocks
        .filter((b: any) => sameDay(new Date(b.start), d))
        .sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime());
      out.push({ date: d, items, blocks: dayBlocks });
    }
    return out;
  }, [data, visibleRange, blocks]);

  // Month view: full calendar grid including all days
  const monthCells = useMemo(() => {
    const out: { date: Date; inMonth: boolean; items: any[] }[] = [];
    const first = monthStart;
    for (const d of visibleRangeFor("month", monthStart).days) {
      const inMonth = d.getMonth() === first.getMonth();
      const items = data
        .filter((a: any) => sameDay(new Date(a.start_at), d))
        .sort((a: any, b: any) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
      out.push({ date: d, inMonth, items });
    }
    return out;
  }, [data, monthStart]);

  const label =
    view !== "month"
      ? `${visibleRange.start.toLocaleDateString("es-AR", { day: "numeric", month: "short" })} — ${addDays(visibleRange.end, -1).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}`
      : monthStart.toLocaleDateString("es-AR", { month: "long", year: "numeric" });

  const goPrev = () => setAnchor(view === "month" ? addMonths(anchor, -1) : addDays(anchor, -7));
  const goNext = () => setAnchor(view === "month" ? addMonths(anchor, 1) : addDays(anchor, 7));

  // Grid view: every day of the week, Monday to Sunday
  const gridDays = useMemo(() => {
    const out: { date: Date; items: any[]; blocks: any[] }[] = [];
    for (const d of visibleRange.days) {
      const items = data.filter((a: any) => sameDay(new Date(a.start_at), d));
      const dayBlocks = blocks.filter((b: any) => sameDay(new Date(b.start), d));
      out.push({ date: d, items, blocks: dayBlocks });
    }
    return out;
  }, [data, visibleRange, blocks]);

  return (
    <div className="agenda-page mx-auto max-w-6xl space-y-6">
      <RetentionNotice />
      <div className="agenda-toolbar space-y-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Agenda</h1>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
        <div className="agenda-toolbar__views">
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(v) => {
              if (v) {
                setView(v as "week" | "grid" | "month");
                setShowUpcoming(false);
              }
            }}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="week">Semana</ToggleGroupItem>
            <ToggleGroupItem value="grid">Grilla</ToggleGroupItem>
            <ToggleGroupItem value="month">Mes</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="agenda-toolbar__actions">
            <div className="agenda-toolbar__dates order-last ml-auto">
              <Button variant="outline" size="icon" onClick={goPrev} aria-label="Período anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setAnchor(new Date())}>
                Hoy
              </Button>
              <Button variant="outline" size="icon" onClick={goNext} aria-label="Período siguiente">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button
              size="default"
              className="h-9 px-4 font-semibold shadow-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98]"
              onClick={() => openNew()}
              aria-label="Nuevo turno"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>Nuevo turno</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTimeOffOpen(true)}>
              <CalendarX2 className="mr-2 h-4 w-4" /> Ausencias
            </Button>
            <Button
              className="lg:hidden"
              variant={showUpcoming ? "default" : "outline"}
              size="sm"
              aria-pressed={showUpcoming}
              onClick={() => setShowUpcoming((shown) => !shown)}
            >
              <ListOrdered className="mr-2 h-4 w-4" /> Próximos turnos
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncNow.mutate()}
              disabled={syncNow.isPending}
              title="Sincronizar con Google Calendar"
              aria-label="Sincronizar con Google Calendar"
            >
              <RefreshCw className={`h-4 w-4 ${syncNow.isPending ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {showUpcoming && (
          <div className="min-w-0 lg:hidden">
            <UpcomingPanel appointments={data} onSelect={setDetail} confirmed={apptConfirmed} />
          </div>
        )}
        <div className={`min-w-0 ${showUpcoming ? "hidden lg:block" : ""}`}>
          {/* Botón flotante primario para mobile */}
          <div
            className="fixed md:hidden z-30 right-4 pointer-events-auto"
            style={{ bottom: "calc(4.75rem + env(safe-area-inset-bottom))" }}
          >
            <Button
              size="icon"
              className="h-12 w-12 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 border border-primary/20 transition-transform active:scale-95"
              onClick={() => openNew()}
              aria-label="Registrar nuevo turno"
              title="Nuevo turno"
            >
              <Plus className="h-6 w-6 stroke-[2.5]" />
            </Button>
          </div>
          <div aria-live="polite" className="space-y-2 empty:hidden">
            {apptQuery.isError && (
              <div
                role="alert"
                className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                <span className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {apptQuery.data
                    ? "No se pudo actualizar este período; mostramos lo último cargado."
                    : "No pudimos cargar los turnos de este período."}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => apptQuery.refetch()}
                  disabled={apptQuery.isFetching}
                >
                  Reintentar
                </Button>
              </div>
            )}
            {!apptQuery.isError && !apptConfirmed && (
              <p className="mb-3 text-xs text-muted-foreground">
                {apptQuery.data ? "Actualizando turnos del período…" : "Cargando turnos…"}
              </p>
            )}
            {calQuery.isError && (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-2 text-xs text-muted-foreground">
                <span>
                  No pudimos leer Google Calendar: los bloqueos de ese calendario no se muestran.
                  Tus turnos sí.
                </span>
                <Button size="sm" variant="ghost" onClick={() => calQuery.refetch()}>
                  Reintentar
                </Button>
              </div>
            )}
          </div>
          {view === "week" ? (
            <div className="min-w-0 space-y-3">
              {days.length === 0 && (
                <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
                  No hay días laborables para mostrar.
                </div>
              )}
              {days.map(({ date, items, blocks: dayBlocks }, dayIdx) => {
                const isToday = sameDay(date, today);
                const dayLabel = date
                  .toLocaleDateString("es-AR", { weekday: "long", day: "numeric" })
                  .replace(", ", " ");
                const monthLabel = date
                  .toLocaleDateString("es-AR", { month: "long" })
                  .toUpperCase();
                const tint = DAY_TINTS[dayIdx % DAY_TINTS.length];
                const dayTimeOff = timeOffFor(date);
                return (
                  <section
                    key={date.toISOString()}
                    className={`rounded-2xl border border-border bg-card shadow-sm overflow-hidden ${tint.border} border-l-[6px]`}
                  >
                    <div className="agenda-day-header grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-4 sm:px-5">
                      <div className="flex min-w-0 items-center gap-2">
                        <CalendarIcon className={`h-5 w-5 shrink-0 ${tint.icon}`} />
                        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                          <h2 className={`text-lg font-bold capitalize ${tint.title}`}>
                            {dayLabel}
                          </h2>
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {monthLabel}
                          </span>
                          {isToday && (
                            <Badge className="rounded-full bg-primary px-2 text-[10px] font-bold text-primary-foreground hover:bg-primary">
                              HOY
                            </Badge>
                          )}
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {items.length === 0
                          ? apptConfirmed
                            ? "Sin turnos"
                            : apptQuery.isError
                              ? "—"
                              : "Cargando…"
                          : `${items.length} ${items.length === 1 ? "turno" : "turnos"}`}
                      </span>
                    </div>
                    {dayTimeOff && (
                      <div className="mx-4 mb-2 flex items-center justify-between gap-2 rounded-lg border border-dashed border-rose-300 bg-rose-50 px-3 py-1.5 text-xs text-rose-800 sm:mx-5 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                        <span className="truncate">
                          Ausencia{dayTimeOff.reason ? ` · ${dayTimeOff.reason}` : ""}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-rose-700 hover:text-rose-900 dark:text-rose-200"
                          title="Eliminar ausencia"
                          onClick={() =>
                            setToDeleteTimeOff({ id: dayTimeOff.id, reason: dayTimeOff.reason })
                          }
                          disabled={mDeleteTimeOff.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                    <div className="flex items-center gap-2 px-4 pb-2 sm:px-5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground"
                        onClick={() => openNew(date)}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" /> Agregar turno
                      </Button>
                    </div>

                    {items.length === 0 && dayBlocks.length === 0 ? null : (
                      <div className="px-4 pb-4 sm:px-5">
                        <ul className="space-y-2">
                          {[
                            ...dayBlocks.map((b: any) => ({
                              kind: "block" as const,
                              at: new Date(b.start).getTime(),
                              row: b,
                            })),
                            ...items.map((a: any) => ({
                              kind: "appt" as const,
                              at: new Date(a.start_at).getTime(),
                              row: a,
                            })),
                          ]
                            .sort((x, y) => x.at - y.at)
                            .map((entry) => {
                              if (entry.kind === "block") {
                                const b = entry.row;
                                return (
                                  <li
                                    key={`block-${b.id}`}
                                    className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 rounded-xl border border-dashed bg-card/70 px-4 py-3"
                                  >
                                    <div className="min-w-14 font-mono text-lg font-semibold tabular-nums text-muted-foreground">
                                      {b.start?.length > 10
                                        ? formatTime(new Date(b.start))
                                        : "Todo el día"}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="truncate text-sm font-medium text-muted-foreground">
                                        {b.summary || "Bloqueado"}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        Bloqueado en Google Calendar
                                      </div>
                                    </div>
                                  </li>
                                );
                              } else {
                                const a = entry.row;
                                const name =
                                  `${a.patient?.first_name ?? ""} ${a.patient?.last_name ?? ""}`.trim() ||
                                  "Sin nombre";
                                const phone = a.patient?.phone as string | undefined;
                                const wa = digitsOnly(phone);
                                const cancelled = a.status === "cancelled";
                                const isPast = new Date(a.end_at).getTime() < Date.now();
                                const att = ATTENDANCE_META[a.attendance as string];
                                return (
                                  <li
                                    key={a.id}
                                    className={`agenda-appointment group grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-xl border border-transparent bg-card/80 px-3 py-3 transition-colors hover:bg-card ${cancelled ? "opacity-60" : ""}`}
                                  >
                                    <div className="min-w-14 pt-0.5 text-left">
                                      <div
                                        className={`text-base font-semibold tabular-nums text-foreground ${cancelled ? "line-through" : ""}`}
                                      >
                                        {formatTime(new Date(a.start_at))}
                                      </div>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div
                                        className={`truncate font-medium ${cancelled ? "line-through" : ""}`}
                                      >
                                        {name}
                                      </div>
                                      {phone && (
                                        <div className="truncate text-xs text-muted-foreground">
                                          {phone}
                                        </div>
                                      )}
                                      {a.notes && (
                                        <details className="mt-1 text-xs text-muted-foreground">
                                          <summary className="cursor-pointer select-none font-medium text-foreground/70 hover:text-foreground">
                                            Notas
                                          </summary>
                                          <p className="mt-1 whitespace-pre-wrap break-words">
                                            {a.notes}
                                          </p>
                                        </details>
                                      )}
                                      <ConfirmBadge appointment={a} className="mt-1" />
                                      {isPast && att && (
                                        <span
                                          className={`mt-1 inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${att.className}`}
                                        >
                                          {att.label}
                                        </span>
                                      )}
                                    </div>
                                    <div className="agenda-appointment__actions flex flex-wrap items-center justify-end gap-1">
                                      {wa && (
                                        <Button
                                          asChild
                                          variant="ghost"
                                          size="icon"
                                          title="WhatsApp"
                                        >
                                          <a
                                            href={`https://wa.me/${wa}`}
                                            target="_blank"
                                            rel="noreferrer"
                                          >
                                            <MessageCircle className="h-4 w-4" />
                                          </a>
                                        </Button>
                                      )}
                                      {phone && (
                                        <Button asChild variant="ghost" size="icon" title="Llamar">
                                          <a href={`tel:${phone}`}>
                                            <Phone className="h-4 w-4" />
                                          </a>
                                        </Button>
                                      )}
                                      {isPast && (
                                        <>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            title="Asistió"
                                            className={
                                              a.attendance === "attended"
                                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 hover:text-emerald-800"
                                                : "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                                            }
                                            onClick={() =>
                                              mAttendance.mutate({
                                                id: a.id,
                                                attendance: "attended",
                                              })
                                            }
                                          >
                                            <Check className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            title="Ausente con aviso"
                                            className={
                                              a.attendance === "absent_notified"
                                                ? "bg-amber-100 text-amber-700 hover:bg-amber-200 hover:text-amber-800"
                                                : "text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                                            }
                                            onClick={() =>
                                              mAttendance.mutate({
                                                id: a.id,
                                                attendance: "absent_notified",
                                              })
                                            }
                                          >
                                            <AlertCircle className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            title="Ausente sin aviso"
                                            className={
                                              a.attendance === "absent_no_notice"
                                                ? "bg-rose-100 text-rose-700 hover:bg-rose-200 hover:text-rose-800"
                                                : "text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                            }
                                            onClick={() =>
                                              mAttendance.mutate({
                                                id: a.id,
                                                attendance: "absent_no_notice",
                                              })
                                            }
                                          >
                                            <PhoneOff className="h-4 w-4" />
                                          </Button>
                                        </>
                                      )}
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" title="Más acciones">
                                            <MoreHorizontal className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem onClick={() => setDetail(a)}>
                                            Ver detalle
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => openNotes(a)}>
                                            {a.notes ? "Editar notas" : "Agregar notas"}
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => openReschedule(a)}>
                                            Reprogramar
                                          </DropdownMenuItem>
                                          {!cancelled && (
                                            <>
                                              <DropdownMenuSeparator />
                                              <DropdownMenuItem
                                                className="text-destructive focus:text-destructive"
                                                onClick={() => setToCancel(a)}
                                              >
                                                Cancelar
                                              </DropdownMenuItem>
                                            </>
                                          )}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </li>
                                );
                              }
                            })}
                        </ul>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          ) : view === "grid" ? (
            <WeekGrid
              days={gridDays}
              today={today}
              onSelect={setDetail}
              onBlockSelect={setBlockDetail}
              timeOffFor={timeOffFor}
              timeOffRangesFor={timeOffRangesFor}
              onDeleteTimeOff={(id: string) => setToDeleteTimeOff({ id })}
            />
          ) : (
            <MonthGrid
              cells={monthCells}
              today={today}
              nonWorking={nonWorking}
              timeOffFor={timeOffFor}
              onDeleteTimeOff={(id: string) => setToDeleteTimeOff({ id })}
              onCancel={setToCancel}
              onDetail={setDetail}
              onNotes={openNotes}
              onReschedule={openReschedule}
              onAttendance={(id, attendance) => mAttendance.mutate({ id, attendance })}
            />
          )}
        </div>
        <aside className="upcoming-sidebar hidden min-w-0 self-start lg:sticky lg:top-4 lg:block">
          <UpcomingPanel
            appointments={data}
            onSelect={setDetail}
            variant="sidebar"
            confirmed={apptConfirmed}
          />
        </aside>
      </div>

      <Dialog open={attendanceOpen} onOpenChange={(o) => !o && setAttendanceOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar asistencia</DialogTitle>
            <DialogDescription>
              Hay turnos que ya pasaron sin registrar la asistencia del paciente.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-3 overflow-y-auto">
            {pendingAttendance.map((a: any) => (
              <div key={a.id} className="rounded-lg border p-3">
                <p className="font-medium">
                  {a.patient?.first_name} {a.patient?.last_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {new Date(a.start_at).toLocaleString("es-AR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                    onClick={() => mAttendance.mutate({ id: a.id, attendance: "attended" })}
                  >
                    <Check className="h-4 w-4" /> Asistió
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                    onClick={() => mAttendance.mutate({ id: a.id, attendance: "absent_notified" })}
                  >
                    <AlertCircle className="h-4 w-4" /> Ausente con aviso
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    onClick={() => mAttendance.mutate({ id: a.id, attendance: "absent_no_notice" })}
                  >
                    <AlertCircle className="h-4 w-4" /> Ausente sin aviso
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setAttendanceSkipped((prev) => [
                  ...prev,
                  ...pendingAttendance.map((a: any) => a.id),
                ])
              }
            >
              Más tarde
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalle del turno</DialogTitle>
            <DialogDescription className="sr-only">
              Información del turno seleccionado
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-day-2-soft text-xl font-semibold text-day-2">
                  {patientInitials(detail.patient)}
                </div>
                <div className="leading-tight">
                  <div className="text-lg font-bold text-foreground">
                    {detail.patient?.first_name} {detail.patient?.last_name}
                  </div>
                  {ageFrom(detail.patient?.birth_date) !== null && (
                    <div className="text-sm text-muted-foreground">
                      {ageFrom(detail.patient?.birth_date)} años
                    </div>
                  )}
                </div>
              </div>

              <dl className="divide-y divide-border text-sm">
                {detail.appointment_type_name && (
                  <DetailRow label="Tipo" value={detail.appointment_type_name} />
                )}
                <DetailRow
                  label="Hora"
                  value={`${new Date(detail.start_at).toLocaleTimeString("es-AR", { hour: "numeric", minute: "2-digit" })} hs`}
                />
                <DetailRow
                  label="Día"
                  value={new Date(detail.start_at)
                    .toLocaleDateString("es-AR", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })
                    .replace(",", "")}
                />
                <DetailRow
                  label="Duración"
                  value={`${Math.max(
                    0,
                    Math.round(
                      (new Date(detail.end_at).getTime() - new Date(detail.start_at).getTime()) /
                        60000,
                    ),
                  )} min`}
                />
                {detailPlace && (
                  <DetailRow
                    label="Lugar"
                    value={
                      detailPlace.address
                        ? `${detailPlace.name} · ${detailPlace.address}`
                        : detailPlace.name
                    }
                  />
                )}
                {detail.patient?.phone && (
                  <DetailRow label="Teléfono" value={detail.patient.phone} />
                )}
                <DetailRow
                  label="Última visita"
                  value={
                    lastVisitQuery.isLoading
                      ? "…"
                      : lastVisitQuery.data?.last_visit
                        ? new Date(lastVisitQuery.data.last_visit)
                            .toLocaleDateString("es-AR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                            .replace(",", "")
                        : "Primera visita"
                  }
                />
                {(() => {
                  const isPast = new Date(detail.end_at ?? detail.start_at).getTime() < Date.now();
                  const statusKey = isPast ? "inactive" : detail.status;
                  return (
                    <DetailRow
                      label="Estado"
                      value={(STATUS_META[statusKey] ?? STATUS_META.active).label}
                    />
                  );
                })()}
                <div className="flex items-center justify-between gap-2 py-1">
                  <span className="text-sm text-muted-foreground">Confirmación</span>
                  <ConfirmBadge appointment={detail} />
                </div>
              </dl>

              <div className="space-y-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Asistencia
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-8 gap-1 ${detail.attendance === "attended" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 hover:text-emerald-800" : "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"}`}
                    onClick={() => mAttendance.mutate({ id: detail.id, attendance: "attended" })}
                  >
                    <Check className="h-4 w-4" /> Asistió
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-8 gap-1 ${detail.attendance === "absent_notified" ? "bg-amber-100 text-amber-700 hover:bg-amber-200 hover:text-amber-800" : "text-amber-600 hover:bg-amber-50 hover:text-amber-700"}`}
                    onClick={() =>
                      mAttendance.mutate({ id: detail.id, attendance: "absent_notified" })
                    }
                  >
                    <AlertCircle className="h-4 w-4" /> Ausente con aviso
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-8 gap-1 ${detail.attendance === "absent_no_notice" ? "bg-rose-100 text-rose-700 hover:bg-rose-200 hover:text-rose-800" : "text-rose-600 hover:bg-rose-50 hover:text-rose-700"}`}
                    onClick={() =>
                      mAttendance.mutate({ id: detail.id, attendance: "absent_no_notice" })
                    }
                  >
                    <PhoneOff className="h-4 w-4" /> Ausente sin aviso
                  </Button>
                  {detail.attendance && detail.attendance !== "pending" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-muted-foreground"
                      onClick={() => mAttendance.mutate({ id: detail.id, attendance: "pending" })}
                    >
                      Limpiar
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {detail.patient?.notes && (
                  <div className="rounded-md bg-muted/60 p-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Notas del paciente
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
                      {detail.patient.notes}
                    </p>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Notas del turno
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const a = detail;
                      setDetail(null);
                      openNotes(a);
                    }}
                  >
                    {detail.notes ? "Editar" : "Agregar"}
                  </Button>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                  {detail.notes || <span className="text-muted-foreground">Sin notas</span>}
                </p>
              </div>
            </div>
          )}
          {detail && (
            <DialogFooter className="gap-2 sm:justify-between">
              {(() => {
                const isPast = new Date(detail.end_at ?? detail.start_at).getTime() < Date.now();
                if (isPast) return <span />;
                return detail.status !== "cancelled" ? (
                  <Button
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      const a = detail;
                      setDetail(null);
                      setToCancel(a);
                    }}
                  >
                    Cancelar turno
                  </Button>
                ) : (
                  <span />
                );
              })()}
              {(() => {
                const isPast = new Date(detail.end_at ?? detail.start_at).getTime() < Date.now();
                if (isPast) return null;
                return (
                  <div className="flex flex-wrap items-center gap-2">
                    {detail.status === "active" && detail.patient?.phone && (
                      <Button
                        variant="outline"
                        className="gap-1"
                        disabled={mReminder.isPending}
                        onClick={() => mReminder.mutate(detail.id)}
                      >
                        <MessageCircle className="h-4 w-4" />
                        {mReminder.isPending ? "Enviando…" : "Enviar recordatorio"}
                      </Button>
                    )}
                    <Button
                      onClick={() => {
                        const a = detail;
                        setDetail(null);
                        openReschedule(a);
                      }}
                    >
                      Reprogramar
                    </Button>
                  </div>
                );
              })()}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!blockDetail} onOpenChange={(o) => !o && setBlockDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloqueo de agenda</DialogTitle>
            <DialogDescription className="sr-only">
              Información del bloqueo seleccionado
            </DialogDescription>
          </DialogHeader>
          {blockDetail && (
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Motivo
                </span>
                <p className="font-medium text-foreground">{blockDetail.summary || "Bloqueado"}</p>
              </div>
              <div>
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Inicio
                </span>
                <p className="text-foreground">
                  {new Date(blockDetail.start).toLocaleString("es-AR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Fin
                </span>
                <p className="text-foreground">
                  {new Date(blockDetail.end).toLocaleString("es-AR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!toNotes} onOpenChange={(o) => !o && setToNotes(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notas del turno</DialogTitle>
            <DialogDescription>
              {toNotes &&
                `${toNotes.patient?.first_name ?? ""} ${toNotes.patient?.last_name ?? ""}`.trim()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="appt-notes">Notas</Label>
            <Textarea
              id="appt-notes"
              rows={5}
              placeholder="Motivo de consulta, observaciones, indicaciones…"
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setToNotes(null)}>
              Cancelar
            </Button>
            <Button onClick={() => mNotes.mutate()} disabled={mNotes.isPending}>
              Guardar notas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={newOpen}
        onOpenChange={(o) => {
          if (o) setNewOpen(true);
          else closeNewDialog();
        }}
      >
        <DialogContent className="np-dialog np-new-dialog max-h-[85vh] overflow-y-auto sm:max-w-[38rem]">
          <DialogHeader>
            <DialogTitle>{toReschedule ? "Reprogramar turno" : "Nuevo turno"}</DialogTitle>
            <DialogDescription className="sr-only">
              {toReschedule
                ? "Elegí el nuevo día y horario del turno."
                : "Cargá un turno manualmente."}
            </DialogDescription>
          </DialogHeader>
          {toReschedule ? (
            <div className="wizard-steps np-steps-two">
              <span className={npStep >= 1 ? "is-active" : ""}>1. Horario</span>
              <span className={npStep >= 2 ? "is-active" : ""}>2. Confirmar</span>
            </div>
          ) : (
            <div className="wizard-steps">
              <span className={npStep >= 0 ? "is-active" : ""}>1. Paciente</span>
              <span className={npStep >= 1 ? "is-active" : ""}>2. Horario</span>
              <span className={npStep >= 2 ? "is-active" : ""}>3. Confirmar</span>
            </div>
          )}
          {toReschedule && (
            <div className="np-current-appt rounded-xl border border-border bg-muted/40 p-3 text-sm">
              <p className="text-xs font-semibold text-muted-foreground">Turno actual</p>
              <p className="font-semibold text-foreground">
                {toReschedule.patient?.first_name} {toReschedule.patient?.last_name}
              </p>
              <p className="capitalize text-muted-foreground">
                {formatDateLong(new Date(toReschedule.start_at)).replace(",", "")} ·{" "}
                {formatTime(new Date(toReschedule.start_at), (cfg as any)?.timezone || undefined)}{" "}
                hs
                {toReschedule.appointment_type_name
                  ? ` · ${toReschedule.appointment_type_name}`
                  : ""}
              </p>
            </div>
          )}
          {npStep === 0 && (
            <div className="wizard-panel">
              <p>
                Elegí una persona existente o creá una ficha nueva. Si el paciente ya existe (mismo
                DNI y teléfono) se reutiliza su ficha.
              </p>
              {(knownPatients as any[]).length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="np-patient-search">Pacientes</Label>
                  <Popover open={patientPickerOpen} onOpenChange={setPatientPickerOpen}>
                    <PopoverAnchor asChild>
                      <div ref={patientPickerRef} className="relative">
                        <Input
                          id="np-patient-search"
                          placeholder="Buscar por nombre, DNI o teléfono"
                          value={patientSearch}
                          onChange={(e) => {
                            setPatientSearch(e.target.value);
                            setPatientPickerOpen(true);
                          }}
                          onFocus={() => setPatientPickerOpen(true)}
                          role="combobox"
                          aria-expanded={patientPickerOpen}
                          aria-controls="np-patient-options"
                          className="pr-9"
                        />
                        <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    </PopoverAnchor>
                    <PopoverContent
                      id="np-patient-options"
                      align="start"
                      sideOffset={6}
                      className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-1"
                      onOpenAutoFocus={(e) => e.preventDefault()}
                      onCloseAutoFocus={(e) => e.preventDefault()}
                      onInteractOutside={(e) => {
                        if (patientPickerRef.current?.contains(e.target as Node))
                          e.preventDefault();
                      }}
                    >
                      <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                        {filteredPatients.length === 0 ? (
                          <p className="py-2 text-sm text-muted-foreground">
                            Sin resultados para esa búsqueda.
                          </p>
                        ) : (
                          filteredPatients.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setForm((f) => ({
                                  ...f,
                                  first_name: p.first_name,
                                  last_name: p.last_name,
                                  dni: p.dni,
                                  phone: p.phone,
                                  email: p.email ?? "",
                                }));
                                setPatientPickerOpen(false);
                              }}
                              className={`w-full rounded-xl border px-4 py-3 text-left transition hover:border-primary/60 ${
                                form.phone === p.phone &&
                                form.first_name === p.first_name &&
                                form.last_name === p.last_name
                                  ? "border-primary bg-primary/10"
                                  : "border-border bg-muted/40"
                              }`}
                            >
                              <p className="font-semibold">
                                {p.last_name}, {p.first_name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {p.dni ? `DNI ${p.dni} · ` : ""}
                                {p.phone}
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="np-first">Nombre</Label>
                  <Input
                    id="np-first"
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="np-last">Apellido</Label>
                  <Input
                    id="np-last"
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="np-dni">DNI</Label>
                  <Input
                    id="np-dni"
                    value={form.dni}
                    onChange={(e) => setForm({ ...form, dni: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="np-phone">Teléfono</Label>
                  <PhoneInput
                    id="np-phone"
                    value={form.phone}
                    onChange={(v) => setForm({ ...form, phone: v })}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="np-email">Email</Label>
                  <Input
                    id="np-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setNewOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => setNpStep(1)}
                  disabled={!form.first_name.trim() || !form.last_name.trim() || !form.phone.trim()}
                >
                  Elegir horario
                </Button>
              </DialogFooter>
            </div>
          )}
          {npStep === 1 && (
            <div className="wizard-panel">
              <div className="grid gap-4 sm:grid-cols-2">
                {npSedes.length > 1 && (
                  <div className="space-y-2 sm:col-span-2">
                    <Label>¿Dónde es el turno?</Label>
                    <div className="flex flex-wrap gap-2">
                      {npSedes.map((l: any) => (
                        <button
                          key={l.id}
                          type="button"
                          aria-pressed={npLocation === l.id}
                          onClick={() => {
                            setNpLocation(l.id);
                            setPickedDay("");
                            setForm((f) => ({ ...f, start: "" }));
                          }}
                          className={`rounded-full border px-3 py-1.5 text-sm ${npLocation === l.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"}`}
                        >
                          {l.city || l.name}
                        </button>
                      ))}
                    </div>
                    {!npLocation && (
                      <p className="text-xs text-muted-foreground">
                        Elegí la ciudad para ver solo sus días y horarios.
                      </p>
                    )}
                  </div>
                )}
                <div className="space-y-2 sm:col-span-2">
                  <Label>Tipo de turno</Label>
                  <div className="sm:hidden">
                    <Select
                      value={form.type_id}
                      onValueChange={(value) =>
                        setForm((f) => ({ ...f, type_id: value, start: "" }))
                      }
                    >
                      <SelectTrigger aria-label="Tipo de turno" className="w-full min-w-0">
                        <SelectValue placeholder="Elegí el tipo de turno" />
                      </SelectTrigger>
                      <SelectContent className="max-w-[calc(100vw-2rem)]">
                        {(apptTypes as any[]).map((t) => (
                          <SelectItem key={t.id} value={t.id} className="whitespace-normal">
                            {t.name} · {t.duration_minutes} min
                          </SelectItem>
                        ))}
                        <SelectItem value="other">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="hidden flex-wrap gap-2 sm:flex">
                    {(apptTypes as any[]).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, type_id: t.id, start: "" }))}
                        className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                          form.type_id === t.id
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border hover:border-primary/60"
                        }`}
                      >
                        {t.name} · {t.duration_minutes} min
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, type_id: "other", start: "" }))}
                      className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                        isOtherType
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border hover:border-primary/60"
                      }`}
                    >
                      Otro
                    </button>
                  </div>
                  {isOtherType && (
                    <div className="flex items-center gap-2">
                      <Label htmlFor="np-custom-min" className="text-xs text-muted-foreground">
                        Duración (minutos)
                      </Label>
                      <Input
                        id="np-custom-min"
                        type="number"
                        min={5}
                        max={480}
                        step={5}
                        className="w-28"
                        value={form.custom_minutes}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            custom_minutes: Number(e.target.value) || 0,
                            start: "",
                          }))
                        }
                      />
                    </div>
                  )}
                  {typesPending && (
                    <p className="text-xs text-muted-foreground">Cargando tipos de turno…</p>
                  )}
                  {typesError && (
                    <p className="text-xs text-destructive">
                      No se pudieron cargar los tipos.{" "}
                      <button type="button" className="underline" onClick={() => refetchTypes()}>
                        Reintentar
                      </button>
                    </p>
                  )}
                  {!typesPending && !typesError && (apptTypes as any[]).length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Podés crear tus tipos de turno en Configuración → Datos del profesional.
                    </p>
                  )}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Elegí el horario</Label>
                  {npSedes.length > 1 && !npLocation ? (
                    <p className="text-sm text-muted-foreground">
                      Primero elegí el lugar para ver los días disponibles.
                    </p>
                  ) : loadingAvailability ? (
                    <p className="text-sm text-muted-foreground">Buscando disponibilidad…</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="np-date-selectors grid grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)] gap-2 sm:flex">
                        <Select value={activeMonth} onValueChange={selectMonthValue}>
                          <SelectTrigger className="w-[150px] rounded-xl text-base font-semibold capitalize">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {monthsOfYear.map((m) => (
                              <SelectItem key={m.value} value={m.value} className="capitalize">
                                {m.label.split(" de ")[0]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={activeYear}
                          onValueChange={(y) => {
                            const minM = Number(y) === currentYear ? currentMonth + 1 : 1;
                            const wanted = Math.max(Number(activeMonth.slice(5, 7)) || minM, minM);
                            selectMonthValue(`${y}-${String(wanted).padStart(2, "0")}`);
                          }}
                        >
                          <SelectTrigger className="w-[110px] rounded-xl text-base font-semibold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {yearOptions.map((y) => (
                              <SelectItem key={y} value={y}>
                                {y}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="np-day-strip flex w-full min-w-0 gap-3 overflow-x-auto pb-2">
                        {monthDays.map((d: any) => {
                          const blocked = d.slots.length === 0;
                          const selected = pickedDay === d.date;
                          return (
                            <button
                              key={d.date}
                              type="button"
                              onClick={() => {
                                setPickedDay(d.date);
                                resetCustomTime();
                                setForm((f) => ({ ...f, start: "" }));
                              }}
                              className="flex shrink-0 flex-col items-center gap-1"
                            >
                              <span
                                className={`grid h-10 w-10 place-items-center rounded-full border text-sm font-semibold tabular-nums transition ${
                                  selected
                                    ? blocked
                                      ? "border-dashed border-destructive bg-destructive/10 text-foreground"
                                      : "border-2 border-primary bg-primary text-primary-foreground shadow-sm"
                                    : blocked
                                      ? "border-dashed border-destructive/60 text-muted-foreground hover:border-destructive"
                                      : "border-2 border-primary bg-primary/15 text-foreground hover:bg-primary/25"
                                }`}
                              >
                                {d.dayNum}
                              </span>
                              <span className="text-xs capitalize text-muted-foreground">
                                {d.dowShort}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                {pickedDay && (
                  <div className="space-y-2 sm:col-span-2">
                    <p className="text-base font-semibold capitalize">{pickedDayInfo?.label}</p>
                    {isOverrideDay && daySlots.length > 0 && (
                      <p className="rounded-lg border border-dashed border-destructive/60 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                        Este día es no laborable o está bloqueado. Solo vos podés cargar un turno
                        acá.
                      </p>
                    )}
                    {daySlots.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin horarios libres ese día.</p>
                    ) : (
                      <>
                        <MobileSlotList
                          key={mobileSlotsKey(newOpen, pickedDay, form.type_id, slotMinutes)}
                          slots={daySlots}
                          selected={useCustomTime ? "" : form.start}
                          onSelect={(value) => {
                            resetCustomTime();
                            setForm((f) => ({ ...f, start: value }));
                          }}
                        />
                        <div className="hidden gap-3 sm:grid sm:grid-cols-3">
                          {daySlots.map((s: any) => (
                            <Button
                              variant="outline"
                              key={s.value}
                              type="button"
                              onClick={() => {
                                resetCustomTime();
                                setForm((f) => ({ ...f, start: s.value }));
                              }}
                              className={`h-auto rounded-xl border px-3 py-3 text-sm font-medium transition ${
                                !useCustomTime && form.start === s.value
                                  ? "border-primary bg-primary/10 text-foreground"
                                  : "border-border hover:border-primary/60"
                              }`}
                            >
                              {s.label} hs
                            </Button>
                          ))}
                        </div>
                      </>
                    )}
                    <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
                      <button
                        type="button"
                        onClick={() => {
                          const next = !useCustomTime;
                          setUseCustomTime(next);
                          setCustomTime("");
                          setForm((f) => ({ ...f, start: "" }));
                        }}
                        className="text-sm font-medium text-day-5 hover:underline"
                      >
                        {useCustomTime
                          ? "← Volver a los horarios de mi agenda"
                          : "Elegir otro horario (fuera de mi agenda)"}
                      </button>
                      {useCustomTime && (
                        <div className="flex flex-wrap items-center gap-3">
                          <Input
                            type="time"
                            className="w-32"
                            value={customTime}
                            onChange={(e) => {
                              const v = e.target.value;
                              setCustomTime(v);
                              setForm((f) => ({ ...f, start: v ? customStartIso(v) : "" }));
                            }}
                          />
                          <p className="text-xs text-muted-foreground">
                            Este horario está fuera de tu horario de atención habitual.
                          </p>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Duración: {slotMinutes} minutos
                      {selectedTypeName ? ` · ${selectedTypeName}` : ""}.
                    </p>
                  </div>
                )}
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="np-notes">Notas</Label>
                  <Input
                    id="np-notes"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                {toReschedule ? (
                  <Button variant="secondary" onClick={closeNewDialog}>
                    Cancelar
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => setNpStep(0)}>
                    Atrás
                  </Button>
                )}
                <Button onClick={() => setNpStep(2)} disabled={!form.start}>
                  Revisar
                </Button>
              </DialogFooter>
            </div>
          )}
          {npStep === 2 && (
            <div className="wizard-panel review-box">
              <span>
                <CalendarIcon className="h-6 w-6" />
              </span>
              <h3>
                {form.first_name} {form.last_name}
              </h3>
              <p className="capitalize">
                {pickedDayInfo?.label}
                {form.start
                  ? ` · ${formatTime(new Date(form.start), (cfg as any)?.timezone || undefined)} hs`
                  : ""}
              </p>
              <span className="np-badge">
                {selectedTypeName || "Turno"} · {slotMinutes} min
              </span>
              {appointmentPlace && (
                <p className="np-place">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {appointmentPlace.name}
                    {appointmentPlace.address ? ` · ${appointmentPlace.address}` : ""}
                  </span>
                </p>
              )}
              {form.notes.trim() && (
                <p className="text-sm text-muted-foreground">“{form.notes.trim()}”</p>
              )}
              <DialogFooter>
                <Button variant="secondary" onClick={() => setNpStep(1)}>
                  Editar
                </Button>
                <Button
                  onClick={() =>
                    isOutsideHours
                      ? setConfirmOverride(true)
                      : toReschedule
                        ? mReschedule.mutate()
                        : mCreate.mutate()
                  }
                  disabled={mCreate.isPending || mReschedule.isPending}
                >
                  <Check className="mr-2 h-4 w-4" />{" "}
                  {toReschedule ? "Confirmar reprogramación" : "Confirmar turno"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOverride} onOpenChange={setConfirmOverride}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Turno fuera del horario del consultorio</AlertDialogTitle>
            <AlertDialogDescription>
              Estás por cargar un turno el {pickedDayInfo?.label}
              {form.start
                ? ` a las ${formatTime(new Date(form.start), (cfg as any)?.timezone || undefined)} hs`
                : ""}
              , fuera de tu horario de atención habitual (día no laborable, bloqueado o fuera de tu
              franja horaria). ¿Confirmás que querés agendarlo igual?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOverride(false);
                if (toReschedule) mReschedule.mutate();
                else mCreate.mutate();
              }}
            >
              {toReschedule ? "Sí, reprogramar" : "Sí, cargar turno"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={timeOffOpen}
        onOpenChange={(o) => {
          setTimeOffOpen(o);
          if (!o)
            setTimeOffForm({
              start_date: "",
              end_date: "",
              reason: "",
              partial: false,
              start_time: "09:00",
              end_time: "12:00",
            });
        }}
      >
        <DialogContent className="np-dialog max-h-[90vh] overflow-y-auto sm:max-w-[38rem]">
          <DialogHeader>
            <DialogTitle>Ausencias y vacaciones</DialogTitle>
            <DialogDescription>
              Bloqueá los días en los que no vas a atender. No se podrán reservar turnos esas
              fechas.
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const fmt = (iso: string) =>
              new Date(`${iso}T12:00:00`)
                .toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" })
                .replace(/\./g, "");
            const daysBetween = (a: string, b: string) =>
              Math.round(
                (new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) /
                  86_400_000,
              ) + 1;
            const f = timeOffForm;
            const invalid = !!f.start_date && !!f.end_date && f.end_date < f.start_date;
            const invalidHours = f.partial && !(f.end_time > f.start_time);
            const count =
              f.start_date && f.end_date && !invalid ? daysBetween(f.start_date, f.end_date) : 0;
            const todayIso = new Date().toLocaleDateString("en-CA");
            const upcoming = (timeOff as any[]).filter((t) => t.end_date >= todayIso);
            return (
              <div className="space-y-6">
                <section className="wizard-panel">
                  <div className="wizard-steps">
                    <span className="is-active">Programar ausencia</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Desde</Label>
                      <Input
                        type="date"
                        min={todayIso}
                        value={f.start_date}
                        onChange={(e) =>
                          setTimeOffForm({
                            ...f,
                            start_date: e.target.value,
                            end_date:
                              f.end_date && f.end_date < e.target.value
                                ? e.target.value
                                : f.end_date || e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Hasta</Label>
                      <Input
                        type="date"
                        min={f.start_date || todayIso}
                        value={f.end_date}
                        onChange={(e) => setTimeOffForm({ ...f, end_date: e.target.value })}
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--primary)]"
                      checked={f.partial}
                      onChange={(e) => setTimeOffForm({ ...f, partial: e.target.checked })}
                    />
                    Solo una franja horaria
                  </label>
                  {f.partial && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Desde la hora</Label>
                        <Input
                          type="time"
                          step={300}
                          value={f.start_time}
                          onChange={(e) => setTimeOffForm({ ...f, start_time: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Hasta la hora</Label>
                        <Input
                          type="time"
                          step={300}
                          value={f.end_time}
                          onChange={(e) => setTimeOffForm({ ...f, end_time: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label>Motivo</Label>
                    <Input
                      placeholder="Vacaciones, congreso, etc."
                      value={f.reason}
                      onChange={(e) => setTimeOffForm({ ...f, reason: e.target.value })}
                    />
                  </div>
                  {invalid ? (
                    <p className="text-sm text-destructive">
                      La fecha "Hasta" debe ser igual o posterior a "Desde".
                    </p>
                  ) : invalidHours ? (
                    <p className="text-sm text-destructive">
                      La hora de fin debe ser posterior a la de inicio.
                    </p>
                  ) : count > 0 ? (
                    <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
                      <TimeOffIcon className="h-5 w-5 shrink-0 text-primary" />
                      <div className="text-sm">
                        <div className="font-semibold capitalize">
                          {count === 1
                            ? fmt(f.start_date)
                            : `${fmt(f.start_date)} al ${fmt(f.end_date)}`}
                        </div>
                        <div className="text-muted-foreground">
                          {f.partial
                            ? `Vas a bloquear de ${f.start_time} a ${f.end_time} ${count === 1 ? "ese día" : `durante ${count} días`}`
                            : `Vas a bloquear ${count} ${count === 1 ? "día" : "días"} de atención`}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div className="flex justify-end">
                    <Button
                      onClick={() => mAddTimeOff.mutate()}
                      disabled={!count || invalidHours || mAddTimeOff.isPending}
                    >
                      {mAddTimeOff.isPending
                        ? "Guardando…"
                        : f.partial
                          ? "Bloquear franja"
                          : "Bloquear días"}
                    </Button>
                  </div>
                </section>

                <section className="wizard-panel">
                  <div className="wizard-steps">
                    <span className="is-active">Ausencias programadas</span>
                  </div>
                  {upcoming.length === 0 ? (
                    <p>No tenés ausencias programadas.</p>
                  ) : (
                    <ul className="space-y-2">
                      {upcoming.map((t) => {
                        const n = daysBetween(t.start_date, t.end_date);
                        return (
                          <li
                            key={t.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
                          >
                            <div className="min-w-0 text-sm">
                              <div className="font-semibold capitalize">
                                {n === 1
                                  ? fmt(t.start_date)
                                  : `${fmt(t.start_date)} al ${fmt(t.end_date)}`}
                              </div>
                              <div className="truncate text-muted-foreground">
                                {t.start_time
                                  ? `${String(t.start_time).slice(0, 5)} a ${String(t.end_time).slice(0, 5)} · `
                                  : ""}
                                {n} {n === 1 ? "día" : "días"}
                                {t.reason ? ` · ${t.reason}` : ""}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="shrink-0 text-destructive hover:text-destructive"
                              onClick={() => setToDeleteTimeOff({ id: t.id, reason: t.reason })}
                              aria-label="Eliminar ausencia"
                            >
                              <TimeOffTrash className="h-4 w-4" />
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDeleteTimeOff} onOpenChange={(o) => !o && setToDeleteTimeOff(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar ausencia</AlertDialogTitle>
            <AlertDialogDescription>
              La ausencia{toDeleteTimeOff?.reason ? ` "${toDeleteTimeOff.reason}"` : ""} se
              eliminará definitivamente y esos días volverán a estar disponibles para reservar
              turnos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toDeleteTimeOff) mDeleteTimeOff.mutate(toDeleteTimeOff.id);
                setToDeleteTimeOff(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!toCancel} onOpenChange={(o) => !o && setToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar turno</AlertDialogTitle>
            <AlertDialogDescription>
              El turno se eliminará definitivamente. El paciente será notificado por WhatsApp cuando
              la integración esté activa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={() => toCancel && mCancel.mutate(toCancel.id)}>
              Cancelar turno
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MonthGrid({
  cells,
  today,
  nonWorking,
  timeOffFor,
  onDeleteTimeOff,
  onCancel,
  onDetail,
  onNotes,
  onReschedule,
  onAttendance,
}: {
  cells: { date: Date; inMonth: boolean; items: any[] }[];
  today: Date;
  nonWorking: number[];
  timeOffFor: (d: Date) => any;
  onDeleteTimeOff: (id: string) => void;
  onCancel: (a: any) => void;
  onDetail: (a: any) => void;
  onNotes: (a: any) => void;
  onReschedule: (a: any) => void;
  onAttendance: (id: string, attendance: string) => void;
}) {
  const weekdayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  return (
    <div
      className="overflow-x-auto rounded-lg border bg-card"
      role="region"
      aria-label="Calendario mensual"
      tabIndex={0}
    >
      <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
        {weekdayLabels.map((w) => (
          <div key={w} className="px-0.5 py-2 sm:px-2">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map(({ date, inMonth, items }, i) => {
          const isToday = sameDay(date, today);
          const nonLab = nonWorking.includes(date.getDay());
          const dayTimeOff = timeOffFor(date);
          const blocked = !!dayTimeOff;
          return (
            <div
              key={i}
              className={`min-h-20 min-w-0 border-b border-r p-0.5 last:border-r-0 sm:min-h-28 sm:p-2 ${(i + 1) % 7 === 0 ? "border-r-0" : ""} ${!inMonth ? "bg-muted/20 text-muted-foreground/60" : nonLab || blocked ? "bg-muted/30" : "bg-background"} ${isToday ? "ring-1 ring-inset ring-primary" : ""}`}
            >
              <div className="mb-1 flex items-center justify-between gap-1">
                <span
                  className={`text-xs font-semibold ${isToday ? "flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground" : ""}`}
                >
                  {date.getDate()}
                </span>
                <div className="flex flex-wrap items-center gap-1">
                  {blocked && (
                    <button
                      type="button"
                      title={`Eliminar ausencia${dayTimeOff.reason ? `: ${dayTimeOff.reason}` : ""}`}
                      onClick={() => onDeleteTimeOff(dayTimeOff.id)}
                      className="flex items-center gap-0.5 rounded bg-rose-100 px-0.5 text-[0px] sm:px-1 sm:text-[9px] font-medium text-rose-800 hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-300"
                    >
                      Ausencia
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  )}
                  {nonLab && !blocked && (
                    <span className="hidden rounded bg-muted px-1 text-[9px] font-medium text-muted-foreground sm:inline">
                      No laboral
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                {items.map((a: any) => (
                  <MonthAppointment
                    key={a.id}
                    a={a}
                    onCancel={onCancel}
                    onDetail={onDetail}
                    onNotes={onNotes}
                    onReschedule={onReschedule}
                    onAttendance={onAttendance}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthAppointment({
  a,
  onCancel,
  onDetail,
  onNotes,
  onReschedule,
  onAttendance,
}: {
  a: any;
  onCancel: (a: any) => void;
  onDetail: (a: any) => void;
  onNotes: (a: any) => void;
  onReschedule: (a: any) => void;
  onAttendance: (id: string, attendance: string) => void;
}) {
  const name =
    `${a.patient?.first_name ?? ""} ${a.patient?.last_name ?? ""}`.trim() || "Sin nombre";
  const phone = a.patient?.phone as string | undefined;
  const wa = digitsOnly(phone);
  const cancelled = a.status === "cancelled";
  const startAt = new Date(a.start_at);
  const isPast = startAt.getTime() < Date.now();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`flex w-full min-w-0 cursor-pointer items-center gap-1 overflow-hidden rounded border border-emerald-200 bg-emerald-50 px-0.5 py-0.5 text-left text-[10px] text-emerald-700 transition-colors hover:bg-accent/60 sm:px-1.5 sm:text-[11px] ${cancelled ? "line-through opacity-70" : ""}`}
        >
          <span className="font-mono font-semibold tabular-nums">{formatTime(startAt)}</span>
          <span className="hidden truncate sm:inline">{name}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0 sm:w-80">
        <div className="space-y-2 p-4">
          <div className="min-w-0">
            <div
              className={`truncate text-sm font-semibold ${cancelled ? "line-through opacity-70" : ""}`}
            >
              {name}
            </div>
            <div className="text-xs text-muted-foreground">
              {startAt
                .toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })
                .replace(", ", " ")}{" "}
              · {formatTime(startAt)}
            </div>
          </div>

          {phone && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{phone}</span>
            </div>
          )}
          {a.notes && (
            <details className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer select-none font-medium text-foreground">
                Notas
              </summary>
              <p className="mt-1 whitespace-pre-wrap break-words">{a.notes}</p>
            </details>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            {wa && (
              <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </a>
              </Button>
            )}
            {phone && (
              <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <a href={`tel:${phone}`}>
                  <Phone className="h-3.5 w-3.5" /> Llamar
                </a>
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              className="h-8 text-xs"
              onClick={() => onDetail(a)}
            >
              Detalle
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onNotes(a)}>
              {a.notes ? "Editar notas" : "Notas"}
            </Button>
            {!cancelled && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => onReschedule(a)}
              >
                Reprogramar
              </Button>
            )}
            {!cancelled && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onCancel(a)}
              >
                Cancelar
              </Button>
            )}
          </div>
          {isPast && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-xs text-muted-foreground">Asistencia:</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 ${a.attendance === "attended" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 hover:text-emerald-800" : "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"}`}
                  title="Asistió"
                  onClick={() => onAttendance(a.id, "attended")}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 ${a.attendance === "absent_notified" ? "bg-amber-100 text-amber-700 hover:bg-amber-200 hover:text-amber-800" : "text-amber-600 hover:bg-amber-50 hover:text-amber-700"}`}
                  title="Ausente con aviso"
                  onClick={() => onAttendance(a.id, "absent_notified")}
                >
                  <AlertCircle className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 ${a.attendance === "absent_no_notice" ? "bg-rose-100 text-rose-700 hover:bg-rose-200 hover:text-rose-800" : "text-rose-600 hover:bg-rose-50 hover:text-rose-700"}`}
                  title="Ausente sin aviso"
                  onClick={() => onAttendance(a.id, "absent_no_notice")}
                >
                  <PhoneOff className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function patientInitials(p: any) {
  const a = (p?.first_name ?? "").trim()[0] ?? "";
  const b = (p?.last_name ?? "").trim()[0] ?? "";
  return `${a}${b}`.toUpperCase() || "P";
}

function ageFrom(birthDate?: string | null) {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

import { computeAvailableSlots, formatTime } from "@/lib/domain/availability";
import { resolveFeatures, type PlanId } from "@/lib/entitlements";

export type PortalSlot = { startISO: string; endISO: string; label: string };
export type PortalDay = { date: string; slots: PortalSlot[] };

const SCAN_LIMIT = 60;

export async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Owners whose plan (or admin override) includes `patient_self_booking`.
 * Only these professionals can be found/booked from the patient portal.
 */
export async function listedOwnerIds(ownerIds: string[]): Promise<Set<string>> {
  const allowed = new Set<string>();
  if (ownerIds.length === 0) return allowed;
  const client = await db();
  const [{ data: plans }, { data: overrides }] = await Promise.all([
    client.from("account_plans").select("user_id, plan, status").in("user_id", ownerIds),
    client.from("plan_feature_overrides").select("user_id, feature, enabled").in("user_id", ownerIds),
  ]);
  const planByUser = new Map<string, { plan: PlanId; status: string }>();
  for (const p of (plans ?? []) as any[]) planByUser.set(p.user_id, { plan: p.plan as PlanId, status: p.status });
  for (const id of ownerIds) {
    const row = planByUser.get(id);
    if (row && row.status !== "active") continue;
    const userOverrides = ((overrides ?? []) as any[]).filter((o) => o.user_id === id);
    const features = resolveFeatures((row?.plan ?? "basic") as PlanId, userOverrides);
    // Booking link access follows the admin-visible feature `patient_self_booking`.
    if (features.includes("patient_self_booking")) allowed.add(id);
  }
  return allowed;
}

/** Public directory of professionals (safe columns only). */
export async function listProfessionalsRaw(q: string, specialty: string) {
  const client = await db();
  let query = client
    .from("professional_config")
    .select("owner_id, display_name, specialty, address, maps_url, phone")
    .order("display_name");
  if (specialty) query = query.eq("specialty", specialty);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const term = q.trim().toLowerCase();
  const rows = ((data ?? []) as any[])
    .filter((p) => (p.display_name ?? "").trim().length > 0)
    .filter((p) =>
      term
        ? `${p.display_name} ${p.specialty} ${p.address}`.toLowerCase().includes(term)
        : true,
    );
  const allowed = await listedOwnerIds(rows.map((p) => p.owner_id));
  return rows.filter((p) => allowed.has(p.owner_id));
}

export async function getProfessionalRaw(ownerId: string) {
  const client = await db();
  const allowed = await listedOwnerIds([ownerId]);
  if (!allowed.has(ownerId)) throw new Error("Este profesional no recibe turnos por el portal.");
  const [{ data: config }, { data: locations }, { data: schedule }] = await Promise.all([
    client
      .from("professional_config")
      .select("owner_id, display_name, specialty, address, maps_url, phone, timezone, booking_access_mode, max_active_appointments_per_patient")
      .eq("owner_id", ownerId)
      .maybeSingle(),
    client.from("locations").select("id, name, city, address, maps_url").eq("owner_id", ownerId).order("name"),
    client.from("weekly_schedule").select("day_of_week, start_time, end_time, location_id").eq("owner_id", ownerId),
  ]);
  if (!config) throw new Error("Profesional no encontrado.");
  const { data: dated } = await client.from("schedule_date_blocks").select("*").eq("owner_id", ownerId);
  const { dateBlocksAsBands } = await import("@/lib/domain/dateBlocks");
  return { config, locations: locations ?? [], schedule: [...(schedule ?? []), ...dateBlocksAsBands(dated ?? [])] };
}

/**
 * Next `count` days with availability starting at `fromISODate` (inclusive).
 * Returns a cursor so the patient can ask for more dates.
 */
export async function listAppointmentTypesRaw(ownerId: string) {
  const client = await db();
  const allowed = await listedOwnerIds([ownerId]);
  if (!allowed.has(ownerId)) return [] as { id: string; name: string; duration_minutes: number }[];
  const { data } = await client
    .from("appointment_types")
    .select("id, name, duration_minutes")
    .eq("owner_id", ownerId)
    .order("name");
  return (data ?? []) as { id: string; name: string; duration_minutes: number }[];
}

export async function availabilityFrom(
  ownerId: string,
  fromISODate: string | undefined,
  count: number,
  durationMinutes?: number,
  locationId?: string,
) {
  const client = await db();
  const allowed = await listedOwnerIds([ownerId]);
  if (!allowed.has(ownerId)) return { days: [] as PortalDay[], nextFrom: null as string | null };
  const { data: config } = await client
    .from("professional_config")
    .select("appointment_duration_minutes, non_working_days, timezone")
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (!config) return { days: [] as PortalDay[], nextFrom: null as string | null };

  const start = fromISODate ? new Date(`${fromISODate}T00:00:00`) : new Date();
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (start < today) start.setTime(today.getTime());

  const to = new Date(start);
  to.setDate(to.getDate() + SCAN_LIMIT);
  to.setHours(23, 59, 59, 999);

  const { busyRanges } = await import("@/server/botActions.server");
  const [schedule, timeOff, appts, dated, calendarBusy] = await Promise.all([
    client.from("weekly_schedule").select("*").eq("owner_id", ownerId),
    client.from("time_off").select("*").eq("owner_id", ownerId),
    client
      .from("appointments")
      .select("*")
      .eq("owner_id", ownerId)
      .eq("status", "active")
      .gte("start_at", start.toISOString())
      .lte("start_at", to.toISOString()),
    client.from("schedule_date_blocks").select("*").eq("owner_id", ownerId),
    busyRanges(client, ownerId, start.toISOString(), to.toISOString()),
  ]);

  const { dateBlocksAsBands } = await import("@/lib/domain/dateBlocks");
  const normalized = [
    ...(schedule.data ?? []).map((r: any) => ({
      ...r,
      start_time: String(r.start_time).slice(0, 5),
      end_time: String(r.end_time).slice(0, 5),
    })),
    ...dateBlocksAsBands(dated.data ?? []),
  ];

  const days: PortalDay[] = [];
  let nextFrom: string | null = null;
  for (let i = 0; i < SCAN_LIMIT; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    d.setHours(12, 0, 0, 0); // midday anchor so tz conversion keeps the same calendar day
    const slots = computeAvailableSlots(
      d,
      {
        appointment_duration_minutes: durationMinutes ?? config.appointment_duration_minutes,
        non_working_days: config.non_working_days ?? [],
        timezone: (config as any).timezone || "America/Argentina/Buenos_Aires",
      },
      normalized as any,
      (timeOff.data ?? []) as any,
      (appts.data ?? []) as any,
      calendarBusy as any,
      locationId,
    );
    if (slots.length === 0) continue;
    if (days.length === count) {
      nextFrom = ymd(d);
      break;
    }
    days.push({
      date: ymd(d),
      slots: slots.map((s) => ({
        startISO: s.start.toISOString(),
        endISO: s.end.toISOString(),
        label: formatTime(s.start, (config as any).timezone || "America/Argentina/Buenos_Aires"),
      })),
    });
  }
  return { days, nextFrom };
}

export async function findPatientByIdentity(
  ownerId: string,
  who: { first_name: string; last_name: string; phone: string },
) {
  const { matchPatient } = await import("@/lib/patientIdentity");
  const { normalizeArPhone } = await import("@/lib/phone");
  const client = await db();
  const { data } = await client
    .from("patients")
    .select("id, first_name, last_name, dni, phone, email, is_allowed, is_blocked")
    .eq("owner_id", ownerId)
    .eq("phone", normalizeArPhone(who.phone))
    .order("created_at");
  return matchPatient((data ?? []) as any[], who);
}

export async function upcomingForPatientId(ownerId: string, patientId: string) {
  const client = await db();
  const { data } = await client
    .from("appointments")
    .select("id, start_at, end_at, appointment_type_id")
    .eq("owner_id", ownerId)
    .eq("patient_id", patientId)
    .eq("status", "active")
    .gte("start_at", new Date().toISOString())
    .order("start_at");
  return (data ?? []) as { id: string; start_at: string; end_at: string; appointment_type_id: string | null }[];
}

/** The slot must still be free when the patient confirms. */
export async function assertSlotFree(ownerId: string, startISO: string, endISO: string, ignoreId?: string) {
  const client = await db();
  const { data } = await client
    .from("appointments")
    .select("id, start_at, end_at")
    .eq("owner_id", ownerId)
    .eq("status", "active")
    .lt("start_at", endISO)
    .gt("end_at", startISO);
  const clash = (data ?? []).filter((a: any) => a.id !== ignoreId);
  if (clash.length > 0) throw new Error("Ese horario ya fue tomado. Elegí otro, por favor.");
}

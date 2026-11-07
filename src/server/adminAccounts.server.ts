import { resolveFeatures, type PlanId } from "@/lib/entitlements";
import { accountState, isInactive, monthKeyAR, setupComplete, type SetupChecks } from "@/lib/adminMetrics";

export type ConnState = "ok" | "unverified" | "problem" | "disconnected";

export type AdminAccount = {
  user_id: string;
  email: string;
  display_name: string;
  phone: string;
  created_at: string;
  approved_at: string | null;
  requested_at: string | null;
  last_sign_in_at: string | null;
  plan: PlanId;
  state: "pending" | "active" | "suspended";
  status: "active" | "suspended";
  payment_status: "paid" | "pending" | "overdue";
  expires_at: string | null;
  last_payment_at: string | null;
  notes: string | null;
  expired: boolean;
  overrides: { feature: string; enabled: boolean }[];
  features: string[];
  is_admin: boolean;
  setup: SetupChecks;
  setup_done: boolean;
  inactive: boolean;
  metrics: {
    patients: number;
    activeAppointments: number;
    monthCreated: number;
    lastCreatedAt: string | null;
    lastScheduledAt: string | null;
  };
  reminders: {
    attempts: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    legacySent: number;
    lastSentAt: string | null;
  };
  whatsapp: { state: ConnState; detail: string; lastOkAt: string | null };
  calendar: { state: ConnState; detail: string; lastOkAt: string | null };
};

function inMonth(value: string | null | undefined, month: string) {
  return !!value && monthKeyAR(new Date(value)) === month;
}

const AUTH_ERR = /401|invalid_grant|unauthori|reauth|reconect|expir/i;

export async function listAdminAccounts(month: string): Promise<AdminAccount[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;

  const { data: usersPage, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 500 });
  if (usersError) throw new Error(usersError.message);
  const users = usersPage?.users ?? [];

  const [plans, overrides, configs, roles, patients, appointments, wa, cal, sched, locs, types, requests, attempts, connEvents] =
    await Promise.all([
      db.from("account_plans").select("*"),
      db.from("plan_feature_overrides").select("user_id, feature, enabled"),
      db.from("professional_config").select("owner_id, display_name, specialty, phone, calendar_last_sync_at, calendar_last_sync_summary"),
      db.from("user_roles").select("user_id, role").eq("role", "admin"),
      db.from("patients").select("owner_id"),
      db.from("appointments").select("id, owner_id, status, start_at, created_at, reminder_sent_at"),
      db.from("whatsapp_accounts").select("owner_id, status, last_error, updated_at"),
      db.from("app_user_connections").select("user_id, connector_id").eq("connector_id", "google_calendar"),
      db.from("weekly_schedule").select("owner_id"),
      db.from("locations").select("owner_id"),
      db.from("appointment_types").select("owner_id"),
      db.from("access_requests").select("email, status, created_at, reviewed_at"),
      db.from("reminder_attempts").select("owner_id, appointment_id, status, created_at"),
      db.from("account_events").select("user_id, event_type, meta, created_at").in("event_type", ["connection_change", "setup_completed"]).order("created_at"),
    ]);

  const now = new Date();
  const set = (rows: any[] | null, key = "owner_id") => new Set((rows ?? []).map((r) => r[key]));
  const adminIds = set(roles.data, "user_id");
  const calIds = set(cal.data, "user_id");
  const { data: datedRows } = await db.from("schedule_date_blocks").select("owner_id");
  const schedIds = new Set([...set(sched.data), ...set(datedRows)]);
  const locIds = set(locs.data);
  const typeIds = set(types.data);
  const attemptAppts = new Set((attempts.data ?? []).map((a: any) => a.appointment_id));

  const { logAccountEvent } = await import("@/server/accountEvents.server");
  const pendingLogs: Promise<void>[] = [];

  const result = users.map((u): AdminAccount => {
    const planRow = (plans.data ?? []).find((p: any) => p.user_id === u.id);
    const cfg = (configs.data ?? []).find((c: any) => c.owner_id === u.id);
    const plan = (planRow?.plan === "pro" ? "pro" : "basic") as PlanId;
    const userOverrides = (overrides.data ?? [])
      .filter((o: any) => o.user_id === u.id)
      .map((o: any) => ({ feature: o.feature as string, enabled: !!o.enabled }));
    const expiresAt = planRow?.expires_at ?? null;
    const email = (u.email ?? "").toLowerCase();
    const req = (requests.data ?? []).find((r: any) => String(r.email).toLowerCase() === email);
    const isAdmin = adminIds.has(u.id);
    const approved = req?.status === "approved";

    const own: any[] = (appointments.data ?? []).filter((a: any) => a.owner_id === u.id);
    const lastCreatedAt = own.reduce((m: string | null, a: any) => (!m || a.created_at > m ? a.created_at : m), null as string | null);
    const lastScheduledAt = own
      .filter((a: any) => a.status !== "cancelled")
      .reduce((m: string | null, a: any) => (!m || a.start_at > m ? a.start_at : m), null as string | null);

    const setup: SetupChecks = {
      personalData: !!(cfg?.display_name?.trim() && cfg?.phone?.trim() && cfg?.specialty?.trim()),
      schedule: schedIds.has(u.id),
      location: locIds.has(u.id),
      appointmentTypes: typeIds.has(u.id),
      calendar: calIds.has(u.id),
    };
    const setupDone = setupComplete(setup);

    const ownAttempts = (attempts.data ?? []).filter((a: any) => a.owner_id === u.id);
    const monthAttempts = ownAttempts.filter((a: any) => inMonth(a.created_at, month));
    const okAttempts = ownAttempts.filter((a: any) => a.status !== "failed");
    const legacy = own.filter((a: any) => inMonth(a.reminder_sent_at, month) && !attemptAppts.has(a.id));
    const lastSent = [
      ...okAttempts.map((a: any) => a.created_at),
      ...own.filter((a: any) => a.reminder_sent_at).map((a: any) => a.reminder_sent_at),
    ].sort().pop() ?? null;

    // WhatsApp: saved credentials alone are never reported as working.
    // Un único número compartido (de la administradora) sirve a todas las cuentas.
    const waRow = (wa.data ?? []).filter((w: any) => adminIds.has(w.owner_id)).sort((a: any, b: any) => String(b.updated_at).localeCompare(String(a.updated_at)))[0];
    const lastOkWa = okAttempts.map((a: any) => a.created_at).sort().pop() ?? null;
    const lastFailWa = ownAttempts.filter((a: any) => a.status === "failed").map((a: any) => a.created_at).sort().pop() ?? null;
    let whatsapp: AdminAccount["whatsapp"];
    if (!waRow) whatsapp = { state: "disconnected", detail: "No configurado", lastOkAt: null };
    else if (waRow.status !== "connected" || waRow.last_error || (lastFailWa && (!lastOkWa || lastFailWa > lastOkWa)))
      whatsapp = { state: "problem", detail: waRow.last_error || "Último envío fallido", lastOkAt: lastOkWa };
    else if (lastOkWa) whatsapp = { state: "ok", detail: "Operativo", lastOkAt: lastOkWa };
    else whatsapp = { state: "unverified", detail: "Estado no verificado", lastOkAt: null };

    // Google Calendar: connected only when a recent sync actually ran.
    let calendar: AdminAccount["calendar"];
    const conflicts: string[] = cfg?.calendar_last_sync_summary?.conflicts ?? [];
    const lastSync: string | null = cfg?.calendar_last_sync_at ?? null;
    if (!calIds.has(u.id)) calendar = { state: "disconnected", detail: "Desconectado", lastOkAt: null };
    else if (conflicts.some((c) => AUTH_ERR.test(c)))
      calendar = { state: "problem", detail: "Requiere reconexión", lastOkAt: lastSync };
    else if (lastSync && now.getTime() - new Date(lastSync).getTime() < 86_400_000)
      calendar = { state: "ok", detail: "Conectado", lastOkAt: lastSync };
    else calendar = { state: "unverified", detail: "Estado no verificado", lastOkAt: lastSync };

    // History: record connection changes and setup completion from now on (never backfilled).
    const myConn = (connEvents.data ?? []).filter((e: any) => e.user_id === u.id && e.event_type === "connection_change");
    for (const [name, label, st] of [["whatsapp", "WhatsApp", whatsapp], ["calendar", "Google Calendar", calendar]] as const) {
      const prev = [...myConn].reverse().find((e: any) => e.meta?.integration === name);
      if (!prev || prev.meta?.state !== st.state) {
        pendingLogs.push(
          logAccountEvent({
            userId: u.id,
            type: "connection_change",
            description: `${label}: ${st.detail}`,
            meta: { integration: name, state: st.state },
          }),
        );
      }
    }
    if (setupDone) {
      pendingLogs.push(
        logAccountEvent({
          userId: u.id,
          type: "setup_completed",
          description: "Configuración inicial completa (detectada por el panel)",
          dedupeKey: `setup:${u.id}`,
        }),
      );
    }

    return {
      user_id: u.id,
      email: u.email ?? "",
      display_name: cfg?.display_name ?? "",
      phone: cfg?.phone ?? "",
      created_at: u.created_at,
      approved_at: approved ? req?.reviewed_at ?? null : null,
      requested_at: req?.created_at ?? null,
      last_sign_in_at: u.last_sign_in_at ?? null,
      plan,
      state: accountState({ suspended: planRow?.status === "suspended", approved, isAdmin }),
      status: planRow?.status === "suspended" ? "suspended" : "active",
      payment_status: (planRow?.payment_status ?? "pending") as AdminAccount["payment_status"],
      expires_at: expiresAt,
      last_payment_at: planRow?.last_payment_at ?? null,
      notes: planRow?.notes ?? "",
      expired: !!expiresAt && new Date(`${expiresAt}T23:59:59`) < now,
      overrides: userOverrides,
      features: resolveFeatures(plan, userOverrides),
      is_admin: isAdmin,
      setup,
      setup_done: setupDone,
      inactive: isInactive({ setupDone, lastSignInAt: u.last_sign_in_at ?? null, lastCreatedAt, now }),
      metrics: {
        patients: (patients.data ?? []).filter((p: any) => p.owner_id === u.id).length,
        activeAppointments: own.filter((a: any) => a.status === "active" && new Date(a.start_at) >= now).length,
        monthCreated: own.filter((a: any) => inMonth(a.created_at, month)).length,
        lastCreatedAt,
        lastScheduledAt,
      },
      reminders: {
        attempts: monthAttempts.length,
        sent: monthAttempts.filter((a: any) => a.status !== "failed").length,
        delivered: monthAttempts.filter((a: any) => a.status === "delivered" || a.status === "read").length,
        read: monthAttempts.filter((a: any) => a.status === "read").length,
        failed: monthAttempts.filter((a: any) => a.status === "failed").length,
        legacySent: legacy.length,
        lastSentAt: lastSent,
      },
      whatsapp,
      calendar,
    };
  });

  await Promise.all(pendingLogs);
  return result;
}

export type AccountDetail = {
  events: { id: string; event_type: string; description: string; actor_id: string | null; created_at: string; actor_email: string }[];
  payments: { id: string; period: string; amount: number; paid_at: string; reference: string; created_at: string }[];
  attempts: { id: string; trigger: string; status: string; error: string; status_at: string | null; created_at: string; appointment_start: string | null }[];
};

export async function getAdminAccountDetail(userId: string, month: string): Promise<AccountDetail> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const [{ data: events }, { data: payments }, { data: attempts }] = await Promise.all([
    db.from("account_events").select("id, event_type, description, actor_id, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
    db.from("account_payments").select("id, period, amount, paid_at, reference, created_at").eq("user_id", userId).order("paid_at", { ascending: false }),
    db.from("reminder_attempts").select("id, appointment_id, trigger, status, error, status_at, created_at").eq("owner_id", userId).order("created_at", { ascending: false }).limit(300),
  ]);

  const actorIds = [...new Set((events ?? []).map((e: any) => e.actor_id).filter(Boolean))] as string[];
  const actors: Record<string, string> = {};
  for (const id of actorIds) {
    const { data } = await supabaseAdmin.auth.admin.getUserById(id);
    actors[id] = data?.user?.email ?? "";
  }

  // Only the appointment time is shown; no patient data leaves the server.
  const monthAttempts = (attempts ?? []).filter((a: any) => inMonth(a.created_at, month));
  const apptIds = [...new Set(monthAttempts.map((a: any) => a.appointment_id).filter(Boolean))];
  const { data: appts } = apptIds.length
    ? await db.from("appointments").select("id, start_at").in("id", apptIds)
    : { data: [] };
  const startById = Object.fromEntries((appts ?? []).map((a: any) => [a.id, a.start_at]));

  return {
    events: (events ?? []).map((e: any) => ({ ...e, actor_email: e.actor_id ? actors[e.actor_id] ?? "" : "" })),
    payments: (payments ?? []).map((p: any) => ({ ...p, amount: Number(p.amount) })),
    attempts: monthAttempts.map((a: any) => ({
      id: a.id,
      trigger: a.trigger,
      status: a.status,
      error: a.error,
      status_at: a.status_at,
      created_at: a.created_at,
      appointment_start: startById[a.appointment_id] ?? null,
    })),
  };
}

export type WaHistoryMonth = {
  month: string;
  sent: number;
  attempts: number;
  byPro: { user_id: string; name: string; sent: number }[];
};

// Monthly WhatsApp spend history, derived from real send records (never backfilled).
export async function listWhatsappHistory(): Promise<WaHistoryMonth[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const [{ data: attempts }, { data: appts }, { data: cfgs }] = await Promise.all([
    db.from("reminder_attempts").select("owner_id, appointment_id, status, created_at"),
    db.from("appointments").select("id, owner_id, reminder_sent_at").not("reminder_sent_at", "is", null),
    db.from("professional_config").select("owner_id, display_name"),
  ]);
  const withAttempt = new Set((attempts ?? []).map((a: any) => a.appointment_id));
  const names = new Map((cfgs ?? []).map((c: any) => [c.owner_id, c.display_name || "Sin nombre"]));
  const months = new Map<string, { attempts: number; sent: number; pros: Map<string, number> }>();
  const add = (owner: string, at: string, ok: boolean) => {
    const m = monthKeyAR(new Date(at));
    const e = months.get(m) ?? { attempts: 0, sent: 0, pros: new Map() };
    e.attempts += 1;
    if (ok) {
      e.sent += 1;
      e.pros.set(owner, (e.pros.get(owner) ?? 0) + 1);
    }
    months.set(m, e);
  };
  for (const a of attempts ?? []) add(a.owner_id, a.created_at, a.status !== "failed");
  for (const a of appts ?? []) if (!withAttempt.has(a.id)) add(a.owner_id, a.reminder_sent_at, true);
  return [...months.entries()]
    .sort((x, y) => y[0].localeCompare(x[0]))
    .map(([month, e]) => ({
      month,
      attempts: e.attempts,
      sent: e.sent,
      byPro: [...e.pros.entries()]
        .map(([user_id, sent]) => ({ user_id, name: String(names.get(user_id) ?? "Sin nombre"), sent }))
        .sort((a, b) => b.sent - a.sent),
    }));
}

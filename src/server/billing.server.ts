import {
  billingDayFor,
  billingStatus,
  deadlineLabel,
  previousPeriod,
  formatAmount,
  reminderKindFor,
  todayAR,
  type BillingStatus,
} from "@/lib/billing";

export type BillingSettings = {
  amount_basic: number;
  amount_pro: number;
  alias: string;
  receipt_phone: string;
};

export type BillingRow = {
  user_id: string;
  name: string;
  email: string;
  phone: string;
  plan: "basic" | "pro";
  account_status: "active" | "suspended";
  /** Total a cobrar: abono + packs del período. */
  amount_due: number;
  plan_amount: number;
  packs: { quantity: number; price: number; purchased_at: string }[];
  packs_amount: number;
  status: BillingStatus;
  paid_amount: number;
  paid_at: string | null;
  last_reminder_at: string | null;
  period_reminder_at: string | null;
  reminders_paused: boolean;
};

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export async function getBillingSettings(): Promise<BillingSettings> {
  const { data } = await (await db())
    .from("billing_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  return {
    amount_basic: Number(data?.amount_basic ?? 10000),
    amount_pro: Number(data?.amount_pro ?? 10000),
    alias: data?.alias ?? "",
    receipt_phone: data?.receipt_phone ?? "",
  };
}

export async function saveBillingSettings(s: BillingSettings) {
  const { error } = await (await db())
    .from("billing_settings")
    .upsert({ id: 1, ...s, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

export type PackPrice = { id: string; quantity: number; price_ars: number };

export async function listPackPrices(): Promise<PackPrice[]> {
  const { data } = await (await db())
    .from("message_packs")
    .select("id, quantity, price_ars")
    .order("sort_order");
  return (data ?? []).map((p: any) => ({
    id: p.id,
    quantity: p.quantity,
    price_ars: Number(p.price_ars),
  }));
}

/** Solo cambia el precio de packs futuros; las compras ya hechas conservan su precio. */
export async function savePackPrices(packs: { id: string; price_ars: number }[]) {
  const d = await db();
  for (const p of packs) {
    const { error } = await d
      .from("message_packs")
      .update({ price_ars: p.price_ars })
      .eq("id", p.id);
    if (error) throw new Error(error.message);
  }
}

export async function saveProfessionalPhone(userId: string, phone: string) {
  const d = await db();
  const { data, error } = await d
    .from("professional_config")
    .update({ phone, updated_at: new Date().toISOString() })
    .eq("owner_id", userId)
    .select("owner_id");
  if (error) throw new Error(error.message);
  if (!data?.length) {
    const ins = await d.from("professional_config").insert({ owner_id: userId, phone });
    if (ins.error) throw new Error(ins.error.message);
  }
}

/** Cuentas cobrables (aprobadas, no administradoras) con su estado del período. */
export async function getBillingOverview(period: string) {
  const d = await db();
  const { listAdminAccounts } = await import("@/server/adminAccounts.server");
  const [y, m] = period.split("-").map(Number);
  const pStart = new Date(`${period}-01T00:00:00-03:00`).toISOString();
  const pEnd = new Date(
    `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01T00:00:00-03:00`,
  ).toISOString();
  const [accounts, settings, payments, configs, reminders, toggles, packRows] = await Promise.all([
    listAdminAccounts(period),
    getBillingSettings(),
    d.from("account_payments").select("user_id, amount, paid_at").eq("period", period),
    d.from("professional_config").select("owner_id, phone"),
    d
      .from("account_events")
      .select("user_id, created_at, meta")
      .eq("event_type", "payment_reminder")
      .order("created_at", { ascending: false })
      .limit(2000),
    d
      .from("account_events")
      .select("user_id, meta")
      .eq("event_type", "payment_reminders_toggle")
      .order("created_at", { ascending: false })
      .limit(2000),
    d
      .from("professional_message_packs")
      .select("owner_id, quantity, price_ars, purchased_at")
      .is("cancelled_at", null)
      .gte("purchased_at", pStart)
      .lt("purchased_at", pEnd)
      .order("purchased_at"),
  ]);
  const today = todayAR();
  const day = billingDayFor(period, today); // a mes vencido: vence el 10 del mes siguiente
  const rows: BillingRow[] = accounts
    .filter((a) => !a.is_admin && a.state !== "pending")
    .map((a) => {
      const pays = (payments.data ?? []).filter((p: any) => p.user_id === a.user_id);
      const paidAmount = pays.reduce((s: number, p: any) => s + Number(p.amount), 0);
      const paidAt =
        pays
          .map((p: any) => p.paid_at)
          .sort()
          .pop() ?? null;
      const periodReminder = (reminders.data ?? []).find(
        (r: any) => r.user_id === a.user_id && r.meta?.period === period,
      );
      const toggle = (toggles.data ?? []).find((t: any) => t.user_id === a.user_id);
      const planAmount = Number(a.plan === "pro" ? settings.amount_pro : settings.amount_basic);
      const packs = (packRows.data ?? [])
        .filter((k: any) => k.owner_id === a.user_id)
        .map((k: any) => ({
          quantity: Number(k.quantity),
          price: Number(k.price_ars),
          purchased_at: k.purchased_at as string,
        }));
      const packsAmount = packs.reduce((s: number, k: { price: number }) => s + k.price, 0);
      return {
        user_id: a.user_id,
        name: a.display_name || a.email,
        email: a.email,
        phone: (configs.data ?? []).find((c: any) => c.owner_id === a.user_id)?.phone ?? "",
        plan: a.plan,
        account_status: a.status,
        plan_amount: planAmount,
        packs: packs,
        packs_amount: packsAmount,
        amount_due: planAmount + packsAmount,
        status: billingStatus(pays.length > 0, day),
        paid_amount: paidAmount,
        paid_at: paidAt,
        last_reminder_at:
          (reminders.data ?? []).find((r: any) => r.user_id === a.user_id)?.created_at ?? null,
        period_reminder_at: periodReminder?.created_at ?? null,
        reminders_paused: toggle ? toggle.meta?.enabled === false : false,
      };
    });
  return { period, today: today.date, settings, rows };
}

export async function setPaymentRemindersEnabled(
  userId: string,
  enabled: boolean,
  actorId: string,
) {
  const { logAccountEvent } = await import("@/server/accountEvents.server");
  await logAccountEvent({
    userId,
    type: "payment_reminders_toggle",
    description: enabled ? "Recordatorios de pago reactivados" : "Recordatorios de pago pausados",
    actorId,
    meta: { enabled },
  });
}

export async function sendPaymentReminder(
  row: BillingRow,
  period: string,
  settings: BillingSettings,
  opts: { actorId?: string; dedupeKey?: string; kind: string },
) {
  const { logAccountEvent } = await import("@/server/accountEvents.server");
  if (!row.phone) throw new Error(`${row.name} no tiene teléfono cargado.`);
  const res =
    process.env.VITE_FIGMA_AUTH_BYPASS === "1"
      ? { to: row.phone, messageId: `figma-payment-${Date.now()}` }
      : await (
          await import("@/server/whatsapp.server")
        ).sendPaymentReminderWhatsapp(row.phone, [
          row.name,
          formatAmount(row.amount_due),
          settings.alias,
          deadlineLabel(period),
          settings.receipt_phone,
        ]);
  await logAccountEvent({
    userId: row.user_id,
    type: "payment_reminder",
    description: `Recordatorio de pago enviado (${opts.kind === "manual" ? "manual" : opts.kind === "start" ? "día 1" : "día 9"}) · período ${period}`,
    actorId: opts.actorId ?? null,
    meta: { period, kind: opts.kind, to: res.to, message_id: res.messageId },
    dedupeKey: opts.dedupeKey,
  });
  return res;
}

/** Envío automático: solo el día 9 a cuentas impagas. Idempotente por dedupe. */
export async function runPaymentReminders(force?: { day: number }) {
  const today = todayAR();
  const day = force?.day ?? today.day;
  const billedPeriod = previousPeriod(today.period);
  const overview = await getBillingOverview(billedPeriod);
  const d = await db();
  let sent = 0;
  const errors: string[] = [];
  for (const row of overview.rows) {
    if (row.account_status === "suspended" || row.reminders_paused) continue;
    const kind = reminderKindFor(day, row.status === "paid");
    if (!kind) continue;
    const dedupeKey = `payrem:${row.user_id}:${billedPeriod}:${kind}`;
    const { data: exists } = await d
      .from("account_events")
      .select("id")
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();
    if (exists) continue;
    try {
      await sendPaymentReminder(row, billedPeriod, overview.settings, { kind, dedupeKey });
      sent++;
    } catch (e) {
      errors.push(`${row.name}: ${(e as Error).message}`);
    }
  }
  return { day, sent, errors };
}

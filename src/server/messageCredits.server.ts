import { MONTHLY_REMINDERS } from "@/lib/messageCredits";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** Reserva un crédito antes de enviar. Devuelve "plan", el id del pack usado, o null si no hay saldo. */
export async function consumeReminderCredit(ownerId: string): Promise<string | null> {
  const { data, error } = await (await db()).rpc("consume_reminder_credit", { _owner: ownerId, _monthly: MONTHLY_REMINDERS });
  if (error) throw new Error(error.message);
  return data === "none" ? null : (data as string);
}

/** Devuelve el crédito de un pack si el envío falló (el cupo mensual se recalcula solo). */
export async function refundReminderCredit(source: string | null) {
  if (!source || source === "plan") return;
  await (await db()).rpc("refund_reminder_credit", { _pack: source });
}

export async function getMessageOverview(ownerId: string) {
  const d = await db();
  const now = new Date();
  const ar = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit" }).format(now);
  const monthStart = new Date(`${ar}-01T00:00:00-03:00`).toISOString();
  const [y, m] = ar.split("-").map(Number);
  const nextMonth = new Date(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01T00:00:00-03:00`).toISOString();
  const [sent, packs, catalog, payments, settings, planRes, adminRes] = await Promise.all([
    d.from("reminder_attempts").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).gte("created_at", monthStart).neq("status", "failed"),
    d.from("professional_message_packs").select("*").eq("owner_id", ownerId).order("purchased_at", { ascending: false }),
    d.from("message_packs").select("id, quantity, price_ars, validity_days").eq("active", true).order("sort_order"),
    d.from("account_payments").select("id, period, amount, paid_at, reference").eq("user_id", ownerId).order("paid_at", { ascending: false }),
    d.from("billing_settings").select("alias, receipt_phone, amount_basic, amount_pro").eq("id", 1).maybeSingle(),
    d.from("account_plans").select("plan, created_at").eq("user_id", ownerId).maybeSingle(),
    d.from("user_roles").select("user_id").eq("user_id", ownerId).eq("role", "admin").maybeSingle(),
  ]);
  const { todayAR, unpaidPlanPeriods } = await import("@/lib/billing");
  const planRow = planRes.data;
  const planAmount = Number(planRow?.plan === "pro" ? settings.data?.amount_pro ?? 10000 : settings.data?.amount_basic ?? 10000);
  const since = planRow?.created_at ? String(planRow.created_at).slice(0, 7) : todayAR().period;
  // Administrators never owe the monthly plan (same rule as Cobranzas).
  const planDue = adminRes.data ? [] : unpaidPlanPeriods((payments.data ?? []).map((p: any) => p.period), todayAR(), since)
    .map((x) => ({ ...x, amount: planAmount }));
  return {
    sentThisMonth: sent.count ?? 0,
    renewsAt: nextMonth,
    packs: (packs.data ?? []) as {
      id: string; quantity: number; remaining: number; price_ars: number; purchased_at: string;
      expires_at: string; payment_status: string; paid_at: string | null; cancelled_at: string | null;
    }[],
    catalog: (catalog.data ?? []) as { id: string; quantity: number; price_ars: number; validity_days: number }[],
    planPayments: (payments.data ?? []) as { id: string; period: string; amount: number; paid_at: string; reference: string }[],
    planDue,
    planAmount: adminRes.data ? 0 : planAmount,
    alias: settings.data?.alias ?? "",
    receiptPhone: settings.data?.receipt_phone ?? "",
  };
}

export async function purchasePack(ownerId: string, packId: string) {
  const d = await db();
  const { data: pack } = await d.from("message_packs").select("*").eq("id", packId).eq("active", true).maybeSingle();
  if (!pack) throw new Error("Ese pack no está disponible.");
  const expires = new Date(Date.now() + pack.validity_days * 86400000).toISOString();
  const { error } = await d.from("professional_message_packs").insert({
    owner_id: ownerId, pack_id: pack.id, quantity: pack.quantity, remaining: pack.quantity,
    price_ars: pack.price_ars, expires_at: expires,
  });
  if (error) throw new Error(error.message);
  const { logAccountEvent } = await import("@/server/accountEvents.server");
  await logAccountEvent({ userId: ownerId, type: "pack_purchase", description: `Compró pack de ${pack.quantity} mensajes ($${pack.price_ars})`, actorId: ownerId, meta: { pack_id: pack.id } });
}

import { compareByName } from "@/lib/sort";
import type { FinanceEntry, Income } from "@/lib/finance";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** Reúne datos existentes (cobros, packs, cuentas, mensajes) + gastos cargados. Sin registros duplicados. */
export async function getFinanceData() {
  const db = await admin();
  const { todayAR, unpaidPlanPeriods, isPackBillable } = await import("@/lib/billing");
  const today = todayAR();
  const [entries, cats, payments, packs, plans, roles, configs, settings, attempts, events] = await Promise.all([
    db.from("finance_entries").select("*").is("deleted_at", null).order("entry_date", { ascending: false }),
    db.from("finance_categories").select("name").order("name"),
    db.from("account_payments").select("user_id, period, amount, paid_at, reference"),
    db.from("professional_message_packs").select("owner_id, quantity, price_ars, payment_status, paid_at, purchased_at, cancelled_at"),
    db.from("account_plans").select("user_id, plan, status, created_at, is_test"),
    db.from("user_roles").select("user_id").eq("role", "admin"),
    db.from("professional_config").select("owner_id, display_name"),
    db.from("billing_settings").select("amount_basic, amount_pro").eq("id", 1).maybeSingle(),
    db.from("reminder_attempts").select("owner_id, created_at").in("status", ["sent", "delivered", "read"]).limit(100000),
    db.from("account_events").select("user_id, event_type, created_at").in("event_type", ["suspended", "reactivated"]),
  ]);
  const admins = new Set(((roles.data ?? []) as any[]).map((r) => r.user_id));
  // Cuentas de prueba: no entran en ningún cálculo del módulo de finanzas.
  const testAccounts = new Set(((plans.data ?? []) as any[]).filter((p) => p.is_test).map((p) => p.user_id));
  const excluded = (id: string) => admins.has(id) || testAccounts.has(id);
  const names = new Map<string, string>(((configs.data ?? []) as any[]).map((c) => [c.owner_id, c.display_name || "Sin nombre"]));
  const planOf = new Map<string, string>(((plans.data ?? []) as any[]).map((p) => [p.user_id, p.plan]));
  const priceBasic = Number(settings.data?.amount_basic ?? 0);
  const pricePro = Number(settings.data?.amount_pro ?? 0);

  const incomes: Income[] = [
    ...((payments.data ?? []) as any[]).filter((p) => !testAccounts.has(p.user_id)).map((p) => ({
      date: String(p.paid_at).slice(0, 10),
      amount: Number(p.amount),
      source: (planOf.get(p.user_id) === "pro" ? "pro" : "basic") as Income["source"],
      professional: names.get(p.user_id) ?? "Profesional",
      concept: `Abono ${p.period}`,
      period: p.period,
      method: p.reference || "Transferencia",
    })),
    ...((packs.data ?? []) as any[])
      .filter((k) => k.payment_status === "paid" && !k.cancelled_at && !testAccounts.has(k.owner_id))
      .map((k) => ({
        date: todayAR(new Date(k.paid_at ?? k.purchased_at)).date,
        amount: Number(k.price_ars),
        source: "packs" as const,
        professional: names.get(k.owner_id) ?? "Profesional",
        concept: `Pack ${k.quantity} mensajes`,
        period: todayAR(new Date(k.purchased_at)).period,
        method: "Transferencia",
      })),
  ];

  const accounts = ((plans.data ?? []) as any[])
    .filter((p) => !excluded(p.user_id))
    .map((p) => ({ user_id: p.user_id, name: names.get(p.user_id) ?? "Profesional", plan: p.plan as "basic" | "pro", status: p.status as string, created_at: String(p.created_at).slice(0, 10) }));

  const paidByUser = new Map<string, string[]>();
  for (const p of (payments.data ?? []) as any[]) paidByUser.set(p.user_id, [...(paidByUser.get(p.user_id) ?? []), p.period]);
  const receivables = accounts
    .slice().sort((x, y) => compareByName(x.name, y.name))
    .filter((a) => a.status === "active")
    .flatMap((a) =>
      unpaidPlanPeriods(paidByUser.get(a.user_id) ?? [], today, a.created_at.slice(0, 7)).map((d) => ({
        user_id: a.user_id, name: a.name, concept: `Abono ${d.period}`, status: d.status, amount: a.plan === "pro" ? pricePro : priceBasic,
      })),
    )
    .concat(
      ((packs.data ?? []) as any[])
        .filter((k) => !excluded(k.owner_id) && isPackBillable(k, today))
        .map((k) => ({ user_id: k.owner_id, name: names.get(k.owner_id) ?? "Profesional", concept: `Pack ${k.quantity} mensajes`, status: "overdue", amount: Number(k.price_ars) })),
    );

  const messagesByMonth: Record<string, { basic: number; pro: number }> = {};
  for (const a of (attempts.data ?? []) as any[]) {
    if (excluded(a.owner_id)) continue;
    const m = todayAR(new Date(a.created_at)).period;
    const row = (messagesByMonth[m] ??= { basic: 0, pro: 0 });
    row[planOf.get(a.owner_id) === "pro" ? "pro" : "basic"] += 1;
  }

  // Gasto real de WhatsApp: Meta cobra todos los mensajes enviados desde el número compartido.
  const waByMonth: Record<string, number> = {};
  for (const a of (attempts.data ?? []) as any[]) {
    const m = todayAR(new Date(a.created_at)).period;
    waByMonth[m] = (waByMonth[m] ?? 0) + 1;
  }
  let usdRate = 0;
  try {
    const r = await fetch("https://dolarapi.com/v1/dolares/oficial");
    if (r.ok) usdRate = Number(((await r.json()) as { venta: number }).venta) || 0;
  } catch { /* sin cotización: no se genera el gasto automático */ }
  const { whatsappMonthlyEntries } = await import("@/lib/finance");
  const { WA_USD_PER_MESSAGE, AR_VAT } = await import("@/lib/whatsappCost");
  const waEntries = usdRate ? whatsappMonthlyEntries(waByMonth, usdRate, WA_USD_PER_MESSAGE, AR_VAT) : [];

  return {
    today: today.date,
    whatsappRateMissing: !usdRate && Object.keys(waByMonth).length > 0,
    entries: [...waEntries, ...((entries.data ?? []) as any[]).map((e) => ({ ...e, amount: Number(e.amount), amount_ars: Number(e.amount_ars), fx_rate: e.fx_rate == null ? null : Number(e.fx_rate) }))] as FinanceEntry[],
    categories: ((cats.data ?? []) as any[]).map((c) => c.name as string),
    incomes,
    receivables,
    accounts,
    priceBasic,
    pricePro,
    messagesByMonth,
    churnEvents: ((events.data ?? []) as any[]).filter((e) => !excluded(e.user_id)).map((e) => ({ user_id: e.user_id, type: e.event_type as string, date: todayAR(new Date(e.created_at)).date })),
  };
}

export type EntryInput = Omit<FinanceEntry, "id" | "amount_ars"> & { id?: string };

export async function saveEntry(input: EntryInput, actorId: string) {
  const db = await admin();
  const { toArs } = await import("@/lib/finance");
  const row = {
    concept: input.concept, category: input.category, kind: input.kind, frequency: input.frequency,
    currency: input.currency, amount: input.amount, fx_rate: input.currency === "USD" ? input.fx_rate : null,
    amount_ars: toArs(input.amount, input.currency, input.fx_rate), entry_date: input.entry_date,
    end_date: input.frequency === "once" ? null : input.end_date || null,
    provider: input.provider ?? "", description: input.description ?? "", updated_at: new Date().toISOString(),
  };
  await db.from("finance_categories").upsert({ name: input.category }, { onConflict: "name", ignoreDuplicates: true });
  if (input.id) {
    const { data: before } = await db.from("finance_entries").select("*").eq("id", input.id).is("deleted_at", null).maybeSingle();
    if (!before) throw new Error("El registro ya no existe.");
    const { data, error } = await db.from("finance_entries").update(row).eq("id", input.id).select().single();
    if (error) throw new Error(error.message);
    await db.from("finance_audit").insert({ entry_id: input.id, action: "update", before, after: data, actor_id: actorId });
    return { id: input.id };
  }
  const { data, error } = await db.from("finance_entries").insert({ ...row, created_by: actorId }).select().single();
  if (error) throw new Error(error.message);
  await db.from("finance_audit").insert({ entry_id: data.id, action: "create", after: data, actor_id: actorId });
  return { id: data.id as string };
}

/** Eliminación segura: se marca como borrado y queda en la auditoría. */
export async function deleteEntry(id: string, actorId: string) {
  const db = await admin();
  const { data: before } = await db.from("finance_entries").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!before) return { ok: true };
  await db.from("finance_entries").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  await db.from("finance_audit").insert({ entry_id: id, action: "delete", before, actor_id: actorId });
  return { ok: true };
}

/** Cambio de precio de un recurrente: cierra el registro actual y abre uno nuevo desde la fecha indicada. */
export async function changeRecurringPrice(id: string, from: string, amount: number, fx: number | null, actorId: string) {
  const db = await admin();
  const { data: cur } = await db.from("finance_entries").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!cur || cur.frequency === "once") throw new Error("Solo se puede cambiar el precio de un gasto recurrente.");
  if (from <= cur.entry_date) throw new Error("La fecha del nuevo precio tiene que ser posterior al inicio.");
  const d = new Date(`${from}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  const closeAt = d.toISOString().slice(0, 10);
  await saveEntry({ ...cur, id, end_date: closeAt, amount: Number(cur.amount), fx_rate: cur.fx_rate == null ? null : Number(cur.fx_rate) }, actorId);
  return saveEntry({ ...cur, id: undefined, amount, fx_rate: fx, entry_date: from, end_date: cur.end_date }, actorId);
}

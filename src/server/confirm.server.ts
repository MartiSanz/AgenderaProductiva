import { randomBytes } from "node:crypto";

export type ConfirmResult =
  | {
      ok: true;
      alreadyConfirmed: boolean;
      professional: string;
      specialty: string;
      when: string;
      address: string;
      phone: string;
    }
  | { ok: false; reason: "invalid" | "expired" | "cancelled" };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** URL-safe, non-guessable token for the reminder's confirm button. */
export function generateConfirmToken(): string {
  return randomBytes(18).toString("base64url");
}

function formatWhen(iso: string, timeZone?: string) {
  const d = new Date(iso);
  const tz = timeZone || undefined;
  const parts = new Intl.DateTimeFormat("es-AR", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = get("weekday");
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const month = get("month");
  const monthCap = month.charAt(0).toUpperCase() + month.slice(1);
  return `${cap} ${get("day")} de ${monthCap} a las ${get("hour")}:${get("minute")} hs`;
}

/**
 * Confirms an appointment from the public reminder link.
 * Never returns patient data or internal ids.
 */
export async function confirmByToken(rawToken: string): Promise<ConfirmResult> {
  const token = rawToken.trim();
  if (!token || token.length < 10 || token.length > 64 || !/^[A-Za-z0-9_-]+$/.test(token)) {
    return { ok: false, reason: "invalid" };
  }

  const db = await admin();
  const { data: appt } = await db
    .from("appointments")
    .select("id, owner_id, start_at, status, confirmed_at, confirm_token_expires_at")
    .eq("confirm_token", token)
    .maybeSingle();

  if (!appt) return { ok: false, reason: "invalid" };
  if (appt.status !== "active") return { ok: false, reason: "cancelled" };

  const expiresAt = appt.confirm_token_expires_at ? new Date(appt.confirm_token_expires_at).getTime() : null;
  if (expiresAt && expiresAt < Date.now()) return { ok: false, reason: "expired" };
  if (new Date(appt.start_at).getTime() < Date.now()) return { ok: false, reason: "expired" };

  const { data: cfg } = await db
    .from("professional_config")
    .select("display_name, specialty, address, phone, timezone")
    .eq("owner_id", appt.owner_id)
    .maybeSingle();

  const alreadyConfirmed = Boolean(appt.confirmed_at);
  if (!alreadyConfirmed) {
    await db
      .from("appointments")
      .update({ confirmed_at: new Date().toISOString() })
      .eq("id", appt.id)
      .is("confirmed_at", null);
  }

  // Fallback: si no hay dirección en la config general, usar el lugar de atención
  // correspondiente al día del turno (o el primero cargado).
  let address = (cfg?.address ?? "").trim();
  if (!address) {
    const dow = new Date(appt.start_at).getUTCDay();
    const { data: locs } = await db
      .from("locations")
      .select("id, address")
      .eq("owner_id", appt.owner_id);
    const list = (locs ?? []).filter((l: any) => (l.address ?? "").trim());
    if (list.length > 1) {
      const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(appt.start_at));
      const { data: dated } = await db
        .from("schedule_date_blocks")
        .select("location_id")
        .eq("owner_id", appt.owner_id)
        .lte("start_date", day)
        .gte("end_date", day);
      const { data: slots } = await db
        .from("weekly_schedule")
        .select("location_id, day_of_week")
        .eq("owner_id", appt.owner_id)
        .eq("day_of_week", dow);
      const locId = dated?.[0]?.location_id ?? slots?.find((s: any) => s.location_id)?.location_id;
      address = list.find((l: any) => l.id === locId)?.address ?? list[0].address;
    } else if (list.length === 1) {
      address = list[0].address;
    }
  }

  return {
    ok: true,
    alreadyConfirmed,
    professional: cfg?.display_name ?? "",
    specialty: cfg?.specialty ?? "",
    when: formatWhen(appt.start_at, cfg?.timezone),
    address,
    phone: (cfg?.phone ?? "").trim(),
  };
}

import { createHmac, timingSafeEqual } from "node:crypto";
import { encryptConnectionKey, decryptConnectionKey } from "@/server/connectionKeyCrypto";
import { buildBotDeps } from "@/server/botActions.server";
import { INITIAL_STATE, botGreeting, runBot, type BotState } from "@/lib/domain/botEngine";

export const GRAPH_VERSION = "v22.0";
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export type WhatsappAccount = {
  owner_id: string;
  phone_number_id: string;
  waba_id: string;
  access_token: string;
  app_secret: string;
  verify_token: string;
  display_phone: string;
  status: string;
  reminder_template_name: string;
  reminder_template_lang: string;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

function decode(row: any): WhatsappAccount {
  return {
    owner_id: row.owner_id,
    phone_number_id: row.phone_number_id,
    waba_id: row.waba_id,
    access_token: row.access_token_ciphertext ? decryptConnectionKey(row.access_token_ciphertext) : "",
    app_secret: row.app_secret_ciphertext ? decryptConnectionKey(row.app_secret_ciphertext) : "",
    verify_token: row.verify_token,
    display_phone: row.display_phone,
    status: row.status,
    reminder_template_name: row.reminder_template_name,
    reminder_template_lang: row.reminder_template_lang,
  };
}

export async function getAccountByPhoneNumberId(phoneNumberId: string): Promise<WhatsappAccount | null> {
  const db = await admin();
  const { data } = await db
    .from("whatsapp_accounts")
    .select("*")
    .eq("phone_number_id", phoneNumberId)
    .maybeSingle();
  return data ? decode(data) : null;
}

export async function getAccountByOwner(ownerId: string): Promise<WhatsappAccount | null> {
  const db = await admin();
  const { data } = await db.from("whatsapp_accounts").select("*").eq("owner_id", ownerId).maybeSingle();
  return data ? decode(data) : null;
}

/** Owner ids of admin accounts (they are the only ones allowed to hold the shared number). */
export async function getAdminIds(): Promise<string[]> {
  const db = await admin();
  const { data } = await db.from("user_roles").select("user_id").eq("role", "admin");
  return (data ?? []).map((r: any) => r.user_id as string);
}

/** The single WhatsApp number shared by every account, saved by an admin. */
export async function getSharedAccount(): Promise<WhatsappAccount | null> {
  const ids = await getAdminIds();
  if (!ids.length) return null;
  const db = await admin();
  const { data } = await db
    .from("whatsapp_accounts")
    .select("*")
    .in("owner_id", ids)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? decode(data) : null;
}

/**
 * El bot conversacional solo responde si el plan del profesional incluye
 * la función "whatsapp_bot" (plan Pro o habilitada por la administradora).
 */
export async function hasWhatsappBotFeature(ownerId: string): Promise<boolean> {
  const db = await admin();
  const [{ data: planRow }, { data: overrides }] = await Promise.all([
    db.from("account_plans").select("plan, status").eq("user_id", ownerId).maybeSingle(),
    db.from("plan_feature_overrides").select("feature, enabled").eq("user_id", ownerId),
  ]);
  if (planRow?.status === "suspended") return false;
  const { resolveFeatures } = await import("@/lib/entitlements");
  const plan = planRow?.plan === "pro" ? "pro" : "basic";
  return resolveFeatures(plan, overrides ?? []).includes("whatsapp_bot");
}

export async function saveAccount(ownerId: string, input: {
  phone_number_id: string;
  waba_id: string;
  access_token: string;
  app_secret: string;
  display_phone: string;
  reminder_template_name: string;
  reminder_template_lang: string;
}) {
  const db = await admin();
  const existing = await db
    .from("whatsapp_accounts")
    .select("verify_token, access_token_ciphertext, app_secret_ciphertext")
    .eq("owner_id", ownerId)
    .maybeSingle();
  const verifyToken =
    existing.data?.verify_token ?? `turnos-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const accessTokenCiphertext = input.access_token
    ? encryptConnectionKey(input.access_token)
    : (existing.data?.access_token_ciphertext ?? "");
  if (!accessTokenCiphertext) {
    throw new Error("Ingresá el token de acceso de WhatsApp.");
  }
  const appSecretCiphertext = input.app_secret
    ? encryptConnectionKey(input.app_secret)
    : (existing.data?.app_secret_ciphertext ?? "");

  const { error } = await db.from("whatsapp_accounts").upsert(
    {
      owner_id: ownerId,
      phone_number_id: input.phone_number_id,
      waba_id: input.waba_id,
      access_token_ciphertext: accessTokenCiphertext,
      app_secret_ciphertext: appSecretCiphertext,
      verify_token: verifyToken,
      display_phone: input.display_phone,
      reminder_template_name: input.reminder_template_name,
      reminder_template_lang: input.reminder_template_lang,
      status: "pending",
      last_error: "",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id" },
  );
  if (error) throw new Error(error.message);

  const account = await getAccountByOwner(ownerId);
  let status: AccountStatus = "error";
  let message = "No se pudo verificar la cuenta.";
  if (account) {
    const check = await checkAccountStatus(account);
    status = check.status;
    message = check.message;
    const patch: Record<string, unknown> = { status, last_error: message.slice(0, 500) };
    if (check.display_phone && !input.display_phone) patch['display_phone'] = check.display_phone;
    await db.from("whatsapp_accounts").update(patch).eq("owner_id", ownerId);
  }
  return { verifyToken, status, message };
}

export async function deleteAccount(ownerId: string) {
  const db = await admin();
  await db.from("whatsapp_accounts").delete().eq("owner_id", ownerId);
}

export type AccountStatus = "connected" | "needs_registration" | "error";

export async function setAccountStatus(ownerId: string, status: AccountStatus, message: string) {
  const db = await admin();
  await db
    .from("whatsapp_accounts")
    .update({ status, last_error: message.slice(0, 500) })
    .eq("owner_id", ownerId);
}

/**
 * Asks Meta for the real state of the phone number instead of assuming
 * "connected" just because credentials were saved.
 */
export async function checkAccountStatus(
  account: WhatsappAccount,
): Promise<{ status: AccountStatus; message: string; display_phone?: string }> {
  try {
    const res = await fetch(
      `${GRAPH_BASE}/${account.phone_number_id}?fields=id,display_phone_number,verified_name,platform_type,status,code_verification_status`,
      { headers: { Authorization: `Bearer ${account.access_token}` } },
    );
    const body = (await res.json()) as any;
    if (!res.ok) {
      const code = body?.error?.code;
      const msg: string = body?.error?.message ?? `Error ${res.status}`;
      if (code === 190) {
        return { status: "error", message: "El token de acceso es inválido o expiró. Generá uno nuevo (permanente)." };
      }
      if (code === 100 || res.status === 404) {
        return {
          status: "error",
          message: "No encontramos ese Phone number ID con este token. Revisá que ambos correspondan a la misma app.",
        };
      }
      if (code === 133010) {
        return { status: "needs_registration", message: REGISTER_HINT };
      }
      return { status: "error", message: msg };
    }
    const platform = String(body?.platform_type ?? "").toUpperCase();
    if (platform && platform !== "CLOUD_API") {
      return { status: "needs_registration", message: REGISTER_HINT };
    }
    return {
      status: "connected",
      message: "",
      display_phone: typeof body?.display_phone_number === "string" ? body.display_phone_number : undefined,
    };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Error desconocido" };
  }
}

export const REGISTER_HINT =
  "El número todavía no está registrado en la Cloud API. En Meta Business Suite → WhatsApp → Configuración de la API, registrá el número (paso 'Registrar' con el PIN de verificación en dos pasos) y volvé a revisar el estado.";

export async function markAccountError(ownerId: string, message: string) {
  const db = await admin();
  await db
    .from("whatsapp_accounts")
    .update({ status: "error", last_error: message.slice(0, 500) })
    .eq("owner_id", ownerId);
}

/* ---------------- Graph API ---------------- */

async function graphPost(account: WhatsappAccount, payload: Record<string, unknown>) {
  const res = await fetch(`${GRAPH_BASE}/${account.phone_number_id}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${account.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WhatsApp API ${res.status}: ${body.slice(0, 400)}`);
  }
  return (await res.json()) as { messages?: { id: string }[] };
}

export async function sendText(account: WhatsappAccount, to: string, body: string) {
  return graphPost(account, { to, type: "text", text: { preview_url: false, body } });
}

export async function sendTemplate(
  account: WhatsappAccount,
  to: string,
  params: string[],
  /** Dynamic suffix for the template's URL button (index 0). Only send if the template has one. */
  urlButtonParam?: string,
  headerParams: string[] = [],
) {
  const safe = (v: string) => (v && v.trim() ? v.trim() : "-");
  const components: Record<string, unknown>[] = [];
  if (headerParams.length) {
    components.push({ type: "header", parameters: headerParams.map((t) => ({ type: "text", text: safe(t) })) });
  }
  if (params.length) {
    components.push({ type: "body", parameters: params.map((t) => ({ type: "text", text: safe(t) })) });
  }
  if (urlButtonParam) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: urlButtonParam }],
    });
  }
  return graphPost(account, {
    to,
    type: "template",
    template: {
      name: account.reminder_template_name,
      language: { code: account.reminder_template_lang },
      components,
    },
  });
}

/**
 * Sends the approved "recordatorio_turno" template:
 * header {{1}} = professional name; body {{1}} specialty, {{2}} name, {{3}} "martes 17",
 * {{4}} "octubre", {{5}} hour, {{6}} address, {{7}} professional phone. No buttons.
 * Never sends empty values (Meta rejects them with #131008).
 */
export async function sendAppointmentReminderTemplate(
  account: WhatsappAccount,
  to: string,
  ownerId: string,
  start: Date,
) {
  const db = await admin();
  const { formatDayNumber, formatHourShort, formatMonthName } = await import("@/lib/domain/availability");
  const { data: cfg } = await db
    .from("professional_config")
    .select("display_name, specialty, address, phone, timezone")
    .eq("owner_id", ownerId)
    .maybeSingle();
  const tz: string | undefined = (cfg as any)?.timezone || undefined;
  let address = String((cfg as any)?.address ?? "").trim();
  if (!address) {
    const { data: locs } = await db
      .from("locations")
      .select("name, address")
      .eq("owner_id", ownerId)
      .order("created_at")
      .limit(1);
    const loc = (locs as any[])?.[0];
    address = String(loc?.address || loc?.name || "").trim() || "a confirmar";
  }
  const name = String((cfg as any)?.display_name ?? "").trim() || "tu profesional";
  const specialty = String((cfg as any)?.specialty ?? "").trim() || "-";
  const { splitPhone } = await import("@/lib/phoneCountries");
  const rawPhone = String((cfg as any)?.phone ?? "").trim();
  const parts = splitPhone(rawPhone);
  // Argentina: siempre número nacional (sin +549); otros países conservan su código.
  const phone = (parts.code === "54" ? parts.national.replace(/\D/g, "") : rawPhone) || "-";
  const day = formatDayNumber(start, tz);
  return sendTemplate(
    account,
    to,
    [
      specialty,
      name,
      day.charAt(0).toLowerCase() + day.slice(1),
      formatMonthName(start, tz).toLowerCase(),
      formatHourShort(start, tz),
      address,
      phone,
    ],
    undefined,
    [name],
  );
}


export function verifySignature(appSecret: string, rawBody: string, header: string | null): boolean {
  if (!appSecret) return false; // reject unsigned webhooks until an app secret is configured
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const received = header.slice("sha256=".length);
  const a = Buffer.from(received, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/* ---------------- Conversation sessions ---------------- */

export async function loadSession(ownerId: string, phone: string): Promise<BotState> {
  const db = await admin();
  const { data } = await db
    .from("whatsapp_sessions")
    .select("step, context, expires_at")
    .eq("owner_id", ownerId)
    .eq("phone", phone)
    .maybeSingle();
  if (!data) return INITIAL_STATE;
  if (new Date(data.expires_at).getTime() < Date.now()) return INITIAL_STATE;
  const ctx = (data.context ?? {}) as any;
  return { step: data.step, ctx: ctx.ctx ?? {}, history: ctx.history ?? [] };
}

export async function saveSession(ownerId: string, phone: string, state: BotState) {
  const db = await admin();
  await db.from("whatsapp_sessions").upsert(
    {
      owner_id: ownerId,
      phone,
      step: state.step,
      context: { ctx: state.ctx, history: state.history },
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id,phone" },
  );
}

export async function resetSession(ownerId: string, phone: string) {
  const db = await admin();
  await db.from("whatsapp_sessions").delete().eq("owner_id", ownerId).eq("phone", phone);
}

export async function logMessage(
  ownerId: string,
  phone: string,
  direction: "in" | "out",
  body: string,
  meta: Record<string, unknown> = {},
) {
  const db = await admin();
  await db.from("sim_messages").insert({ owner_id: ownerId, phone, direction, body, meta });
}

/**
 * Runs one incoming patient message through the shared bot engine and returns
 * the replies. Persists session + transcript. Used by WhatsApp and by the simulator.
 */
export async function processIncoming(
  ownerId: string,
  phone: string,
  text: string,
  options: { log?: boolean; isButton?: boolean } = {},
): Promise<string[]> {
  const log = options.log ?? true;
  const deps = await buildBotDeps(ownerId, phone);
  const previous = await loadSession(ownerId, phone);
  const result = await runBot(deps, previous, text, { isButton: options.isButton ?? false });
  await saveSession(ownerId, phone, result.state);
  if (log) {
    await logMessage(ownerId, phone, "in", text);
    for (const reply of result.replies) await logMessage(ownerId, phone, "out", reply);
  }
  return result.replies;
}

export async function startConversation(ownerId: string, phone: string): Promise<string[]> {
  const deps = await buildBotDeps(ownerId, phone);
  const { state, replies } = await botGreeting(deps);
  await saveSession(ownerId, phone, state);
  for (const reply of replies) await logMessage(ownerId, phone, "out", reply);
  return replies;
}

export async function alreadyProcessed(messageId: string): Promise<boolean> {
  const db = await admin();
  const { error } = await db.from("whatsapp_processed_messages").insert({ message_id: messageId });
  // Duplicate primary key means we already handled this delivery.
  return !!error;
}

/**
 * Marks the conversation as "waiting for the reminder quick reply" so the
 * Confirmar/Cancelar buttons can be applied to the right appointment.
 */
export async function markReminderPending(
  ownerId: string,
  phone: string,
  appointmentId: string,
  patientId: string,
) {
  await saveSession(ownerId, phone, {
    step: "recordatorio",
    ctx: { appointmentId, patientId },
    history: [],
  });
}

/**
 * Sends the approved "acceso_aprobado" template (es_AR) when an admin approves an
 * access request: body {{1}} first name, {{2}} login URL, {{3}} admin wa.me link.
 * Uses the approving admin's connected WhatsApp account.
 */
export async function sendAccessApprovedWhatsapp(
  adminUserId: string,
  rawPhone: string,
  fullName: string,
  loginUrl: string,
) {
  const account = await getSharedAccount();
  if (!account || account.status !== "connected" || !account.access_token) {
    throw new Error("Tu WhatsApp no está conectado.");
  }
  const { normalizeArPhone } = await import("@/lib/phone");
  const to = normalizeArPhone(rawPhone).replace(/\D/g, "");
  if (to.length < 12) throw new Error("El teléfono de la solicitud no es válido.");
  const db = await admin();
  const { data: cfg } = await db
    .from("professional_config")
    .select("phone")
    .eq("owner_id", adminUserId)
    .maybeSingle();
  const adminPhone = String((cfg as any)?.phone ?? "").trim();
  const contact = adminPhone
    ? `https://wa.me/${normalizeArPhone(adminPhone).replace(/\D/g, "")}`
    : `https://wa.me/${account.display_phone.replace(/\D/g, "")}`;
  const firstName = fullName.trim().split(/\s+/)[0] || "Hola";
  const { logReminderAttempt } = await import("@/server/accountEvents.server");
  let result;
  try {
    result = await graphPost(account, {
    to,
    type: "template",
    template: {
      name: "acceso_aprobado",
      language: { code: "es_AR" },
      components: [
        {
          type: "body",
          parameters: [firstName, loginUrl, contact].map((text) => ({ type: "text", text })),
        },
      ],
    },
    });
  } catch (e) {
    // Cuenta en el consumo de la administradora que aprobó (también si falla, como intento).
    await logReminderAttempt({ ownerId: adminUserId, appointmentId: null, trigger: "manual", result: null, error: e instanceof Error ? e.message : String(e) });
    throw e;
  }
  await logReminderAttempt({ ownerId: adminUserId, appointmentId: null, trigger: "manual", result });
  return { to: `+${to}` };
}

/** Plantilla `recordatorio_pago` (5 variables: nombre, monto, alias, fecha límite, WhatsApp de comprobantes). */
export async function sendPaymentReminderWhatsapp(rawPhone: string, vars: [string, string, string, string, string]) {
  const account = await getSharedAccount();
  if (!account || account.status !== "connected" || !account.access_token) {
    throw new Error("El WhatsApp compartido no está conectado.");
  }
  const { normalizeArPhone } = await import("@/lib/phone");
  const to = normalizeArPhone(rawPhone).replace(/\D/g, "");
  if (to.length < 12) throw new Error("El teléfono del profesional no es válido.");
  const body = (code: string) => ({
    to,
    type: "template",
    template: {
      name: "recordatorio_pago",
      language: { code },
      components: [{ type: "body", parameters: vars.map((text) => ({ type: "text", text })) }],
    },
  });
  let res: any;
  try {
    res = await graphPost(account, body("es_AR"));
  } catch (e) {
    if (!/132001/.test(String((e as Error).message))) throw e;
    res = await graphPost(account, body("es"));
  }
  return { to: `+${to}`, messageId: (res as any)?.messages?.[0]?.id ?? null };
}

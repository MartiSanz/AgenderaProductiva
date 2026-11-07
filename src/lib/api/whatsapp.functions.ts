import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const accountSchema = z.object({
  phone_number_id: z.string().trim().min(3).max(64),
  waba_id: z.string().trim().max(64).default(""),
  // Empty means "keep the token already saved" (the form clears it after saving).
  access_token: z
    .string()
    .trim()
    .max(4096)
    .refine((v) => v === "" || v.length >= 20, "El token debe tener al menos 20 caracteres."),
  app_secret: z.string().trim().max(256).default(""),
  display_phone: z.string().trim().max(32).default(""),
  reminder_template_name: z.string().trim().max(128).default("recordatorio_turno"),
  reminder_template_lang: z.string().trim().max(16).default("es_AR"),
});

/** Public (non-secret) view of the connected WhatsApp account. */
export const getWhatsappAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getAdminIds } = await import("@/server/whatsapp.server");
    if (!(await getAdminIds()).includes(context.userId)) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("whatsapp_accounts")
      .select(
        "phone_number_id, waba_id, display_phone, status, last_error, verify_token, reminder_template_name, reminder_template_lang, updated_at",
      )
      .eq("owner_id", context.userId)
      .maybeSingle();
    return data ?? null;
  });

export const saveWhatsappAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => accountSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/server/entitlements.server");
    await requireAdmin(context.userId);
    if (process.env.VITE_FIGMA_AUTH_BYPASS === "1") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await (supabaseAdmin as any).from("whatsapp_accounts").upsert(
        {
          owner_id: context.userId,
          phone_number_id: data.phone_number_id,
          waba_id: data.waba_id,
          display_phone: data.display_phone || "+54 9 11 5555-0000",
          status: "connected",
          last_error: "",
          reminder_template_name: data.reminder_template_name,
          reminder_template_lang: data.reminder_template_lang,
        },
        { onConflict: "owner_id" },
      );
      return {
        verifyToken: "figma-demo",
        status: "connected" as const,
        message: "Conexión simulada para la demo de Figma.",
      };
    }
    const { saveAccount } = await import("@/server/whatsapp.server");
    return saveAccount(context.userId, data);
  });

export const disconnectWhatsappAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("@/server/entitlements.server");
    await requireAdmin(context.userId);
    const { deleteAccount } = await import("@/server/whatsapp.server");
    await deleteAccount(context.userId);
    return { ok: true };
  });

/** Re-checks the number against Meta without touching the stored token. */
export const refreshWhatsappStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("@/server/entitlements.server");
    await requireAdmin(context.userId);
    if (process.env.VITE_FIGMA_AUTH_BYPASS === "1") {
      return { status: "connected" as const, message: "Número demo verificado." };
    }
    const { getAccountByOwner, checkAccountStatus, setAccountStatus } =
      await import("@/server/whatsapp.server");
    const account = await getAccountByOwner(context.userId);
    if (!account) throw new Error("No hay una cuenta de WhatsApp conectada.");
    const check = await checkAccountStatus(account);
    await setAccountStatus(context.userId, check.status, check.message);
    return { status: check.status, message: check.message };
  });

/** Sends a free-form text to verify credentials (only works inside the 24h window). */
export const sendWhatsappTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ phone: z.string().trim().min(6).max(20) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/server/entitlements.server");
    await requireAdmin(context.userId);
    if (process.env.VITE_FIGMA_AUTH_BYPASS === "1") return { ok: true as const };
    const { getAccountByOwner, sendText, setAccountStatus } =
      await import("@/server/whatsapp.server");
    const account = await getAccountByOwner(context.userId);
    if (!account) throw new Error("No hay una cuenta de WhatsApp conectada.");
    try {
      await sendText(account, data.phone, "✅ Conexión de WhatsApp verificada correctamente.");
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      let friendly = message;
      let status: "needs_registration" | "error" = "error";
      if (message.includes("133010")) {
        status = "needs_registration";
        friendly =
          "El número todavía no está registrado en la Cloud API. En Meta Business Suite → WhatsApp → Configuración de la API, registrá el número (paso 'Registrar' con el PIN de verificación en dos pasos) y volvé a probar.";
      } else if (message.includes("131030")) {
        friendly =
          "El número de destino no está en la lista de destinatarios permitidos de tu app en modo de prueba. Agregalo en Meta Business Suite y reintentá.";
      } else if (message.includes("190") || message.toLowerCase().includes("access token")) {
        friendly =
          "El token de acceso es inválido o expiró. Generá uno nuevo (permanente) y guardalo de nuevo.";
      } else if (message.includes("131047") || message.includes("24")) {
        friendly =
          "No hay una ventana de 24 h abierta con ese número: pedile que te escriba primero, o usá una plantilla aprobada.";
      }
      await setAccountStatus(context.userId, status, friendly);
      return { ok: false as const, message: friendly };
    }
  });

/**
 * Sends the reminder template for one appointment right now, outside the
 * scheduled 24h-before cron. Regenerates the confirm token so the button
 * in the message always points to a valid confirmation link.
 */
export const sendAppointmentReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ appointmentId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const wa = await import("@/server/whatsapp.server");
    const { formatDayNumber, formatHourShort, formatMonthName } =
      await import("@/lib/domain/availability");
    const db = supabaseAdmin as any;

    const { data: appt } = await db
      .from("appointments")
      .select("id, owner_id, start_at, patient_id, status, patient:patients(first_name, phone)")
      .eq("id", data.appointmentId)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (!appt) throw new Error("No encontramos ese turno.");
    if (appt.status !== "active")
      throw new Error("Solo se puede enviar el recordatorio de un turno activo.");
    if (process.env.VITE_FIGMA_AUTH_BYPASS === "1") {
      await db
        .from("appointments")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", appt.id);
      const { logReminderAttempt } = await import("@/server/accountEvents.server");
      await logReminderAttempt({
        ownerId: context.userId,
        appointmentId: appt.id,
        trigger: "manual",
        result: { messages: [{ id: `demo-${Date.now()}` }] },
      });
      return { ok: true as const };
    }

    const account = await wa.getSharedAccount();
    if (!account || account.status !== "connected") {
      throw new Error(
        "La cuenta de WhatsApp no está conectada. Revisá Configuración → Integraciones.",
      );
    }
    const phone: string | undefined = appt.patient?.phone;
    if (!phone) throw new Error("El paciente no tiene un teléfono cargado.");

    const { data: cfg } = await db
      .from("professional_config")
      .select("display_name, specialty, address, timezone")
      .eq("owner_id", context.userId)
      .maybeSingle();

    const start = new Date(appt.start_at);
    const tz: string | undefined = cfg?.timezone || undefined;
    const { generateConfirmToken } = await import("@/server/confirm.server");
    const confirmToken = generateConfirmToken();
    await db
      .from("appointments")
      .update({
        confirm_token: confirmToken,
        confirm_token_expires_at: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
      })
      .eq("id", appt.id);

    const credits = await import("@/server/messageCredits.server");
    const creditSource = await credits.consumeReminderCredit(context.userId);
    if (!creditSource) {
      throw new Error(
        "No te quedan mensajes disponibles este mes. Podés comprar un pack en Resumen → Mensajes y Packs.",
      );
    }
    try {
      void tz;
      void formatDayNumber;
      void formatHourShort;
      void formatMonthName;
      const result = await wa.sendAppointmentReminderTemplate(
        account,
        phone,
        context.userId,
        start,
      );
      const { logReminderAttempt } = await import("@/server/accountEvents.server");
      await logReminderAttempt({
        ownerId: context.userId,
        appointmentId: appt.id,
        trigger: "manual",
        result,
      });
    } catch (error) {
      await credits.refundReminderCredit(creditSource);
      const message = error instanceof Error ? error.message : "Error desconocido";
      const { logReminderAttempt } = await import("@/server/accountEvents.server");
      await logReminderAttempt({
        ownerId: context.userId,
        appointmentId: appt.id,
        trigger: "manual",
        result: null,
        error: message,
      });
      let friendly = message;
      if (message.includes("131047") || message.includes("131030")) {
        friendly =
          "Meta no entregó el mensaje: el número de destino no está habilitado o la plantilla todavía no está aprobada.";
      } else if (message.includes("190") || message.toLowerCase().includes("access token")) {
        friendly =
          "El token de acceso es inválido o expiró. Generá uno nuevo (permanente) y guardalo de nuevo.";
      } else if (message.includes("132")) {
        friendly =
          "La plantilla de recordatorio no existe o no está aprobada en Meta. Revisá su nombre y estado.";
      }
      await wa.markAccountError(context.userId, friendly);
      throw new Error(friendly);
    }

    await db
      .from("appointments")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", appt.id);
    await wa.markReminderPending(context.userId, phone, appt.id, appt.patient_id);
    return { ok: true as const };
  });

/* ---------- Simulator: same engine, no real WhatsApp needed ---------- */

export const simulatorSend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ phone: z.string().trim().min(4).max(20), text: z.string().trim().min(1).max(500) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { processIncoming } = await import("@/server/whatsapp.server");
    const replies = await processIncoming(context.userId, data.phone, data.text);
    return { replies };
  });

export const simulatorStart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ phone: z.string().trim().min(4).max(20) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { startConversation } = await import("@/server/whatsapp.server");
    const replies = await startConversation(context.userId, data.phone);
    return { replies };
  });

export const simulatorReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ phone: z.string().trim().min(4).max(20) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { resetSession } = await import("@/server/whatsapp.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await resetSession(context.userId, data.phone);
    await (supabaseAdmin as any)
      .from("sim_messages")
      .delete()
      .eq("owner_id", context.userId)
      .eq("phone", data.phone);
    return { ok: true };
  });

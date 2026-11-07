import { createFileRoute } from "@tanstack/react-router";

/** Local "YYYY-MM-DD" and hour for a date in a timezone. */
function localParts(d: Date, tz: string) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { date: `${g("year")}-${g("month")}-${g("day")}`, hour: Number(g("hour")) };
}

export const Route = createFileRoute("/api/public/hooks/whatsapp-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { isAuthorizedCron } = await import("@/server/cronAuth.server");
        if (!(await isAuthorizedCron(request))) {
          return new Response("Unauthorized", { status: 401 });
        }
        let force = false;
        try {
          const body = (await request.json()) as { force?: boolean };
          force = body?.force === true;
        } catch {
          /* empty body */
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const wa = await import("@/server/whatsapp.server");
        const { generateConfirmToken } = await import("@/server/confirm.server");
        const db = supabaseAdmin as any;

        // Un único número compartido (configurado por la administradora) envía por todas las cuentas.
        const shared = await wa.getSharedAccount();
        if (!shared || shared.status !== "connected") {
          return Response.json({ ok: true, sent: 0, errors: ["WhatsApp compartido no conectado"] });
        }
        const { data: accounts } = await db.from("professional_config").select("owner_id");

        const now = new Date();
        let sent = 0;
        const errors: string[] = [];

        for (const { owner_id } of accounts ?? []) {
          const { data: cfg } = await db
            .from("professional_config")
            .select("reminder_hour, timezone")
            .eq("owner_id", owner_id)
            .maybeSingle();
          const tz = cfg?.timezone || "America/Argentina/Buenos_Aires";
          const local = localParts(now, tz);
          // Run at (or after, if missed) the configured hour; reminder_sent_at prevents duplicates.
          if (!force && local.hour < (cfg?.reminder_hour ?? 9)) continue;

          const tomorrow = localParts(new Date(now.getTime() + 24 * 3600 * 1000), tz).date;
          // Wide UTC window, then filter by local date of tomorrow.
          const from = new Date(now.getTime() + 2 * 3600 * 1000).toISOString();
          const to = new Date(now.getTime() + 50 * 3600 * 1000).toISOString();
          const { data: appts } = await db
            .from("appointments")
            .select("id, start_at, patient_id, patient:patients(phone)")
            .eq("owner_id", owner_id)
            .eq("status", "active")
            .is("reminder_sent_at", null)
            .gte("start_at", from)
            .lte("start_at", to);

          const due = (appts ?? []).filter(
            (a: any) => localParts(new Date(a.start_at), tz).date === tomorrow && a.patient?.phone,
          );
          if (!due.length) continue;

          const account = shared;

          for (const appt of due) {
            const start = new Date(appt.start_at);
            const phone = appt.patient.phone;
            try {
              await db
                .from("appointments")
                .update({
                  confirm_token: generateConfirmToken(),
                  confirm_token_expires_at: new Date(start.getTime() + 3600 * 1000).toISOString(),
                })
                .eq("id", appt.id);
              const credits = await import("@/server/messageCredits.server");
              const creditSource = await credits.consumeReminderCredit(owner_id);
              if (!creditSource) throw new Error("Sin mensajes disponibles (cupo mensual y packs agotados)");
              let result;
              try {
                result = await wa.sendAppointmentReminderTemplate(account, phone, owner_id, start);
              } catch (sendError) {
                await credits.refundReminderCredit(creditSource);
                const { logReminderAttempt } = await import("@/server/accountEvents.server");
                await logReminderAttempt({ ownerId: owner_id, appointmentId: appt.id, trigger: "auto", result: null, error: sendError instanceof Error ? sendError.message : String(sendError) });
                throw sendError;
              }
              {
                const { logReminderAttempt } = await import("@/server/accountEvents.server");
                await logReminderAttempt({ ownerId: owner_id, appointmentId: appt.id, trigger: "auto", result });
              }
              await db
                .from("appointments")
                .update({ reminder_sent_at: new Date().toISOString() })
                .eq("id", appt.id);
              await wa.markReminderPending(owner_id, phone, appt.id, appt.patient_id);
              sent += 1;
            } catch (error) {
              const message = error instanceof Error ? error.message : "error";
              console.error("reminder failed", message);
              errors.push(message);
            }
          }
        }

        return Response.json({ ok: true, sent, errors });
      },
    },
  },
});

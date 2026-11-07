import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AccessRequest = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  profession: string;
  city: string;
  weekly_volume: string;
  goal: string;
  requested_plan?: "basic" | "pro";
  status: "pending" | "approved" | "rejected";
  admin_notes: string;
  reviewed_at: string | null;
  invited_at: string | null;
  created_at: string;
};

/** Precios públicos de los planes (para el formulario de solicitud). */
export const getPublicPlanPrices = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("billing_settings")
    .select("amount_basic, amount_pro")
    .limit(1)
    .maybeSingle();
  return { basic: Number(data?.amount_basic ?? 0), pro: Number(data?.amount_pro ?? 0) };
});

/** Todas las solicitudes de acceso (solo administradoras). */
export const listAccessRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccessRequest[]> => {
    const { requireAdmin } = await import("@/server/entitlements.server");
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("access_requests")
      .select("*")
      .order("full_name");
    if (error) throw new Error(error.message);
    // Las cuentas administradoras no son profesionales: no se listan como solicitudes.
    const { data: roles } = await (supabaseAdmin as any)
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminEmails = new Set<string>();
    for (const r of roles ?? []) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(r.user_id);
      if (u?.user?.email) adminEmails.add(u.user.email.toLowerCase());
    }
    return ((data ?? []) as AccessRequest[]).filter(
      (r) => !adminEmails.has(String(r.email).toLowerCase()),
    );
  });

const reviewInput = z.object({
  id: z.string().uuid(),
  action: z.enum(["approve", "reject", "reset"]),
  origin: z.string().url().max(300).optional(),
  admin_notes: z.string().max(1000).optional(),
});

/**
 * Aprueba o rechaza una solicitud. Al aprobar, envía la invitación por email
 * con la acción administrativa de Supabase (solo desde el servidor).
 */
export const reviewAccessRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => reviewInput.parse(d))
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/server/entitlements.server");
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: row, error: readErr } = await db
      .from("access_requests")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!row) throw new Error("La solicitud no existe.");

    const status =
      data.action === "approve" ? "approved" : data.action === "reject" ? "rejected" : "pending";

    // La aprobación se notifica solo por WhatsApp: no se envían correos de invitación.
    const invited = false;
    const inviteWarning = "";

    const { error } = await db
      .from("access_requests")
      .update({
        status,
        admin_notes: data.admin_notes ?? row.admin_notes,
        reviewed_at: data.action === "reset" ? null : new Date().toISOString(),
        reviewed_by: context.userId,
        invited_at: invited ? new Date().toISOString() : row.invited_at,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    let whatsappTo = "";
    let whatsappError = "";
    if (data.action === "approve") {
      // Si la persona ya ingresó antes de ser aprobada, su cuenta se creó con otro plan:
      // la alineamos con el plan que pidió en la solicitud.
      try {
        const plan = row.requested_plan === "pro" ? "pro" : "basic";
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        const u = list?.users?.find(
          (x) => x.email?.toLowerCase() === String(row.email).toLowerCase(),
        );
        if (u)
          await db.from("account_plans").upsert({ user_id: u.id, plan }, { onConflict: "user_id" });
      } catch (e) {
        console.error("[access] no se pudo asignar el plan solicitado", e);
      }
      if (process.env.VITE_FIGMA_AUTH_BYPASS === "1") {
        whatsappTo = row.phone;
      } else
        try {
          const { sendAccessApprovedWhatsapp } = await import("@/server/whatsapp.server");
          const loginUrl = `${"https://agendera.lovable.app"}/auth`;
          whatsappTo = (
            await sendAccessApprovedWhatsapp(context.userId, row.phone, row.full_name, loginUrl)
          ).to;
        } catch (e) {
          console.error("[access] no se pudo enviar el WhatsApp de bienvenida", e);
          whatsappError = e instanceof Error ? e.message : String(e);
        }
    }

    return { ok: true, invited, inviteWarning, whatsappTo, whatsappError };
  });

/** Elimina una solicitud rechazada para que la persona pueda volver a enviarla. */
export const deleteRejectedAccessRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/server/entitlements.server");
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: deleted, error } = await db
      .from("access_requests")
      .delete()
      .eq("id", data.id)
      .eq("status", "rejected")
      .select("id");
    if (error) throw new Error(error.message);
    if (!deleted?.length) throw new Error("Solo se pueden eliminar solicitudes rechazadas.");
    return { ok: true };
  });

/** Reenvía la invitación de una solicitud ya aprobada. */
export const resendAccessInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), origin: z.string().url().max(300).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/server/entitlements.server");
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: row } = await db
      .from("access_requests")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("La solicitud no existe.");

    const redirectTo = `${"https://agendera.lovable.app"}/auth`;
    // Solo WhatsApp: no se envían correos de invitación ni de acceso.
    const mode: "invite" | "recovery" | "existing" = "existing";

    // Notificamos por WhatsApp con la plantilla "acceso_aprobado".
    let whatsappTo = "";
    let whatsappError = "";
    if (process.env.VITE_FIGMA_AUTH_BYPASS === "1") {
      whatsappTo = row.phone;
    } else
      try {
        const { sendAccessApprovedWhatsapp } = await import("@/server/whatsapp.server");
        whatsappTo = (
          await sendAccessApprovedWhatsapp(context.userId, row.phone, row.full_name, redirectTo)
        ).to;
      } catch (e) {
        console.error("[access] no se pudo reenviar el WhatsApp de acceso", e);
        whatsappError = e instanceof Error ? e.message : String(e);
      }

    await db
      .from("access_requests")
      .update({ invited_at: new Date().toISOString() })
      .eq("id", data.id);
    return { ok: true, mode, whatsappTo, whatsappError };
  });

// Append-only account history and reminder attempt log. Writes run with the privileged client
// only from server code; RLS lets admins read and nobody update or delete through the API.

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export async function logAccountEvent(input: {
  userId: string;
  type: string;
  description: string;
  actorId?: string | null;
  meta?: Record<string, unknown>;
  dedupeKey?: string;
}) {
  const client = await db();
  const row = {
    user_id: input.userId,
    event_type: input.type,
    description: input.description,
    actor_id: input.actorId ?? null,
    meta: input.meta ?? {},
    dedupe_key: input.dedupeKey ?? null,
  };
  const { error } = input.dedupeKey
    ? await client.from("account_events").upsert(row, { onConflict: "dedupe_key", ignoreDuplicates: true })
    : await client.from("account_events").insert(row);
  if (error) console.error("account event log failed", error.message);
}

/** Records one reminder send attempt. "sent" means Meta accepted it, not that it was delivered. */
export async function logReminderAttempt(input: {
  ownerId: string;
  appointmentId: string | null;
  trigger: "auto" | "manual";
  result: { messages?: { id: string }[] } | null;
  error?: string;
}) {
  const client = await db();
  const { error } = await client.from("reminder_attempts").insert({
    owner_id: input.ownerId,
    appointment_id: input.appointmentId,
    trigger: input.trigger,
    status: input.error ? "failed" : "sent",
    wa_message_id: input.result?.messages?.[0]?.id ?? null,
    error: (input.error ?? "").slice(0, 400),
    status_at: new Date().toISOString(),
  });
  if (error) console.error("reminder attempt log failed", error.message);
}

const RANK: Record<string, number> = { sent: 1, delivered: 2, read: 3, failed: 4 };

/** Applies a Meta delivery status callback; never moves a message back to an earlier state. */
export async function applyReminderStatus(messageId: string, status: string, timestamp?: string, errorText?: string) {
  if (!RANK[status]) return;
  const client = await db();
  const { data: row } = await client
    .from("reminder_attempts")
    .select("id, status")
    .eq("wa_message_id", messageId)
    .maybeSingle();
  if (!row) return;
  if ((RANK[row.status] ?? 0) >= RANK[status] && status !== "failed") return;
  const at = timestamp ? new Date(Number(timestamp) * 1000).toISOString() : new Date().toISOString();
  await client
    .from("reminder_attempts")
    .update({ status, status_at: at, ...(errorText ? { error: errorText.slice(0, 400) } : {}) })
    .eq("id", row.id);
}

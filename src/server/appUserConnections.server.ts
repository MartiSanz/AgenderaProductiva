import { encryptConnectionKey, decryptConnectionKey } from "@/server/connectionKeyCrypto";

export async function saveConnectionKeyForUser(
  userId: string,
  connectorId: string,
  connectionAPIKey: string,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("app_user_connections").upsert(
    {
      user_id: userId,
      connector_id: connectorId,
      connection_key_ciphertext: encryptConnectionKey(connectionAPIKey),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,connector_id" },
  );
  if (error) throw error;
}

export async function getConnectionKeyForUser(userId: string, connectorId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("app_user_connections")
    .select("connection_key_ciphertext")
    .eq("user_id", userId)
    .eq("connector_id", connectorId)
    .maybeSingle();
  if (error) throw error;
  return data ? decryptConnectionKey(data.connection_key_ciphertext) : null;
}

export async function deleteConnectionKeyForUser(userId: string, connectorId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("app_user_connections")
    .delete()
    .eq("user_id", userId)
    .eq("connector_id", connectorId);
  if (error) throw error;
}

/**
 * Connection slot: the gateway binds a connection to an app_user_id forever.
 * If a consent completes but the key is lost, that slot can never be reused,
 * so we keep a per-user counter and derive a fresh (still stable, opaque)
 * app_user_id from it.
 */
export async function getConnectionSlot(userId: string, connectorId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("app_user_connection_slots")
    .select("slot")
    .eq("user_id", userId)
    .eq("connector_id", connectorId)
    .maybeSingle();
  if (error) throw error;
  return data?.slot ?? 0;
}

export async function bumpConnectionSlot(userId: string, connectorId: string) {
  const next = (await getConnectionSlot(userId, connectorId)) + 1;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("app_user_connection_slots").upsert(
    { user_id: userId, connector_id: connectorId, slot: next, updated_at: new Date().toISOString() },
    { onConflict: "user_id,connector_id" },
  );
  if (error) throw error;
  return next;
}

export function appUserIdForSlot(userId: string, slot: number) {
  return slot > 0 ? `${userId}-r${slot}` : userId;
}

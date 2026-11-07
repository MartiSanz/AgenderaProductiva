/**
 * Verifies scheduled-job calls. The secret lives in the private
 * `internal_settings` table (service-role only) and is sent by pg_cron
 * in the `x-cron-secret` header. The publishable key is never accepted.
 */
export async function isAuthorizedCron(request: Request): Promise<boolean> {
  const provided = request.headers.get("x-cron-secret") ?? "";
  if (!provided) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("internal_settings")
    .select("value")
    .eq("key", "cron_secret")
    .maybeSingle();
  const expected = data?.value ?? "";
  return expected.length >= 32 && provided === expected;
}

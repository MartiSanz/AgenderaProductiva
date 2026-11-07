/**
 * Minimal Web Push (VAPID, no payload) using WebCrypto so it runs on Workers.
 * Keys are generated once and stored in the service-role-only internal_settings.
 * Pushes carry no data; the service worker shows a fixed admin notification.
 */
function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export async function getVapidKeys(): Promise<{ publicKey: string; privateJwk: JsonWebKey }> {
  const db = await admin();
  const { data } = await db
    .from("internal_settings")
    .select("key, value")
    .in("key", ["vapid_public", "vapid_private_jwk"]);
  const map = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value]));
  if (map.vapid_public && map.vapid_private_jwk) {
    return { publicKey: map.vapid_public, privateJwk: JSON.parse(map.vapid_private_jwk) };
  }
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const raw = (await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer;
  const jwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey;
  const publicKey = b64url(raw);
  await db.from("internal_settings").upsert([
    { key: "vapid_public", value: publicKey },
    { key: "vapid_private_jwk", value: JSON.stringify(jwk) },
  ]);
  return { publicKey, privateJwk: jwk };
}

async function vapidJwt(audience: string, privateJwk: JsonWebKey): Promise<string> {
  const enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = b64url(
    enc.encode(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: "mailto:admin@agendera.app",
      }),
    ),
  );
  const key = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64url(sig)}`;
}

export type PushMessage = { title: string; body: string; url: string };

/** Sends a payload-less push to every device of the given users; the SW fetches the message. */
export async function sendPushToUsers(ids: string[], msg: PushMessage): Promise<{ sent: number; removed: number }> {
  if (!ids.length) return { sent: 0, removed: 0 };
  const db = await admin();
  const { data: subs } = await db.from("push_subscriptions").select("id, endpoint").in("user_id", ids);
  if (!subs?.length) return { sent: 0, removed: 0 };
  await db
    .from("push_subscriptions")
    .update({ last_title: msg.title, last_body: msg.body, last_url: msg.url })
    .in("id", subs.map((s: any) => s.id));
  const { publicKey, privateJwk } = await getVapidKeys();
  let sent = 0;
  let removed = 0;
  for (const s of subs as { id: string; endpoint: string }[]) {
    try {
      const jwt = await vapidJwt(new URL(s.endpoint).origin, privateJwk);
      const res = await fetch(s.endpoint, {
        method: "POST",
        headers: { Authorization: `vapid t=${jwt}, k=${publicKey}`, TTL: "86400", Urgency: "high", "Content-Length": "0" },
      });
      if (res.status === 404 || res.status === 410) {
        await db.from("push_subscriptions").delete().eq("id", s.id);
        removed++;
      } else if (res.ok) sent++;
      else console.error("push failed", res.status, await res.text());
    } catch (e) {
      console.error("push error", e);
    }
  }
  return { sent, removed };
}

export async function notifyAdminsPush(): Promise<{ sent: number; removed: number }> {
  const db = await admin();
  const { data: roles } = await db.from("user_roles").select("user_id").eq("role", "admin");
  return sendPushToUsers((roles ?? []).map((r: any) => r.user_id), {
    title: "Nueva solicitud de acceso",
    body: "Un profesional pidió acceso a Agendera. Tocá para revisarla.",
    url: "/admin",
  });
}

export async function notifyNewAppointmentPush(appointmentId: string) {
  const db = await admin();
  const { data: a } = await db
    .from("appointments")
    .select("owner_id, start_at, appointment_type_name, patients(first_name, last_name)")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!a) return { sent: 0, removed: 0 };
  const when = new Date(a.start_at).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
  const who = [a.patients?.first_name, a.patients?.last_name].filter(Boolean).join(" ") || "Un paciente";
  return sendPushToUsers([a.owner_id], {
    title: "Nuevo turno reservado",
    body: `${who} · ${when}${a.appointment_type_name ? ` · ${a.appointment_type_name}` : ""}`,
    url: "/agenda",
  });
}

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });

/** Push to the professional when a patient cancels or reschedules from the portal. */
export async function notifyAppointmentChangePush(p: {
  kind: "cancel" | "reschedule";
  ownerId: string;
  patientName: string;
  typeName?: string | null;
  oldStart: string;
  newStart?: string;
}) {
  const who = p.patientName || "Un paciente";
  const type = p.typeName ? ` · ${p.typeName}` : "";
  const msg =
    p.kind === "cancel"
      ? { title: "Turno cancelado", body: `${who} canceló su turno del ${fmtWhen(p.oldStart)}${type}` }
      : { title: "Turno reprogramado", body: `${who} pasó su turno del ${fmtWhen(p.oldStart)} al ${fmtWhen(p.newStart!)}${type}` };
  return sendPushToUsers([p.ownerId], { ...msg, url: "/agenda" });
}

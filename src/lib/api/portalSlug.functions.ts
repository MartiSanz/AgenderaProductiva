import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assignSlugs } from "@/lib/portalSlug";

async function allSlugs() {
  const { db } = await import("@/server/portal.server");
  const sb = await db();
  const { data, error } = await sb.from("professional_config").select("owner_id, display_name, specialty, created_at");
  if (error) throw new Error(error.message);
  return assignSlugs(data ?? []);
}

export const resolvePortalSlug = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const map = await allSlugs();
    for (const [ownerId, slug] of map) if (slug === data.slug.toLowerCase()) return { ownerId };
    return { ownerId: null as string | null };
  });

export const getPortalSlugFor = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ ownerId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const map = await allSlugs();
    return { slug: map.get(data.ownerId) ?? null };
  });

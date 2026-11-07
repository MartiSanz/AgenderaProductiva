import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { resolvePortalSlug } from "@/lib/api/portalSlug.functions";
import { PortalByPro } from "@/components/portal/PortalByPro";
import "@/styles/landing.css";

export const Route = createFileRoute("/$slug")({
  ssr: false,
  loader: async ({ params }) => {
    const { ownerId } = await resolvePortalSlug({ data: { slug: params.slug } });
    if (!ownerId) throw notFound();
    return { ownerId };
  },
  head: () => ({
    meta: [
      { title: "Reservá tu turno — Agendera" },
      { name: "description", content: "Portal personal de turnos del profesional en Agendera." },
      { property: "og:title", content: "Reservá tu turno — Agendera" },
      { property: "og:description", content: "Portal personal de turnos del profesional en Agendera." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-semibold">No encontramos este link</h1>
      <p className="text-muted-foreground">Revisá que el enlace esté bien escrito o pedile uno nuevo al profesional.</p>
      <Link to="/" className="text-primary underline">Ir a Agendera</Link>
    </div>
  ),
  component: SlugPortal,
});

function SlugPortal() {
  const { ownerId } = Route.useLoaderData();
  return <PortalByPro proId={ownerId} />;
}

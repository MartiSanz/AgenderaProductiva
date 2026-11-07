import { CitySelect } from "@/components/CitySelect";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneInput } from "@/components/PhoneInput";
import agenderaMark from "@/assets/agendera-mark.png";
import "@/styles/landing.css";
import { useEffect, useState } from "react";
import { getPublicPlanPrices } from "@/lib/api/access.functions";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const TITLE = "Solicitar acceso — Agendera — La agenda que se maneja sola";
const DESC =
  "Estamos incorporando profesionales progresivamente. Dejá tus datos y te avisamos cuando tu cuenta de Agendera esté habilitada.";

export const Route = createFileRoute("/solicitar-acceso")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://agendera.lovable.app/solicitar-acceso" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://agendera.lovable.app/solicitar-acceso" }],
  }),
  component: RequestAccessPage,
});

const schema = z.object({
  full_name: z.string().trim().min(2, "Ingresá tu nombre y apellido").max(120),
  email: z.string().trim().min(1, "Ingresá el email de tu cuenta de Google").email("Ingresá un email válido").max(255),
  phone: z.string().trim().min(8, "Ingresá tu número de WhatsApp").max(40),
  profession: z.string().trim().min(2, "Contanos tu profesión o actividad").max(120),
  city: z.string().trim().max(120).default(""),
  weekly_volume: z.string().trim().max(60).default(""),
  goal: z.string().trim().max(1000).default(""),
  requested_plan: z.enum(["basic", "pro"], { message: "Elegí el plan que querés" }),
});

const fmtARS = (n: number) => "$" + n.toLocaleString("es-AR", { maximumFractionDigits: 0 });

const EMPTY = {
  full_name: "",
  email: "",
  phone: "",
  profession: "",
  city: "",
  weekly_volume: "",
  goal: "",
  requested_plan: "",
};

function RequestAccessPage() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [prices, setPrices] = useState<{ basic: number; pro: number } | null>(null);
  useEffect(() => {
    getPublicPlanPrices().then(setPrices).catch(() => setPrices(null));
  }, []);

  function set(key: keyof typeof EMPTY, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setSending(true);
    const { error } = await supabase.from("access_requests").insert(parsed.data as never);
    setSending(false);
    if (error) {
      if (error.code === "23505") {
        toast.error("Ya recibimos una solicitud con ese email. Te vamos a escribir apenas la revisemos.");
        return;
      }
      toast.error("No pudimos enviar tu solicitud. Probá de nuevo en unos minutos.");
      return;
    }
    setDone(true);
  }

  return (
    <div className="warm-ui warm-public px-6 py-12 text-foreground">
      <div className="mx-auto w-full max-w-xl">
        <Link to="/" className="mb-8 flex items-center gap-2.5">
          <img src={agenderaMark} alt="" className="h-10 w-10" />
          <span className="font-bold tracking-tight text-heading">Agendera</span>
        </Link>

        {done ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" strokeWidth={2} />
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-heading">
              ¡Listo! Recibimos tu solicitud.
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Vamos a revisarla y te avisaremos por WhatsApp cuando tu cuenta esté habilitada.
            </p>
            <Link to="/" className="mt-6 block">
              <Button variant="outline" className="w-full rounded-xl" size="lg">
                Volver al inicio
              </Button>
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
            <h1 className="text-2xl font-bold tracking-tight text-heading">Solicitá acceso a Agendera</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Estamos incorporando profesionales progresivamente. Completá tus datos y te contactaremos
              para habilitar tu cuenta.
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <Field label="Nombre y apellido *" error={errors['full_name']}>
                <Input
                  value={form.full_name}
                  onChange={(e) => set("full_name", e.target.value)}
                  maxLength={120}
                  autoComplete="name"
                />
              </Field>
              <Field label="WhatsApp *" error={errors['phone']}>
                <PhoneInput value={form.phone} onChange={(v) => set("phone", v)} maxLength={40} />
              </Field>
              <Field label="Profesión / actividad *" error={errors['profession']}>
                <Input
                  value={form.profession}
                  onChange={(e) => set("profession", e.target.value)}
                  maxLength={120}
                />
              </Field>
              <Field label="Plan *" error={errors['requested_plan']}>
                <select
                  value={form.requested_plan}
                  onChange={(e) => set("requested_plan", e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="" disabled>Elegí un plan</option>
                  <option value="basic">
                    Base{prices ? ` — ${fmtARS(prices.basic)} por mes` : ""}
                  </option>
                  <option value="pro">
                    Pro{prices ? ` — ${fmtARS(prices.pro)} por mes` : ""}
                  </option>
                </select>
              </Field>
              <Field label="Email de tu cuenta de Google *" error={errors['email']}>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  maxLength={255}
                  autoComplete="email"
                />
              </Field>
              <Field label="País, provincia y ciudad" error={errors['city']}>
                <CitySelect value={form.city} onValueChange={(v) => set("city", v)} />
              </Field>
              <Field
                label="¿Aproximadamente cuántos turnos gestionás por semana?"
                error={errors['weekly_volume']}
              >
                <Input
                  value={form.weekly_volume}
                  onChange={(e) => set("weekly_volume", e.target.value)}
                  maxLength={60}
                  placeholder="Ej: 30"
                />
              </Field>
              <Field label="¿Qué te gustaría resolver o simplificar con Agendera?" error={errors['goal']}>
                <Textarea
                  value={form.goal}
                  onChange={(e) => set("goal", e.target.value)}
                  maxLength={1000}
                  rows={4}
                />
              </Field>

              <Button type="submit" size="lg" disabled={sending} className="w-full rounded-xl font-semibold">
                {sending ? "Enviando…" : "Solicitar acceso"}
              </Button>
              <Link to="/" className="block">
                <Button type="button" variant="outline" size="lg" className="w-full rounded-xl">
                  Volver al inicio
                </Button>
              </Link>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-secondary-foreground">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import agenderaMark from "@/assets/agendera-mark.png";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { ArrowRight, CalendarDays } from "lucide-react";
import "@/styles/landing.css";
import { toast } from "sonner";
import { REDIRECT_KEY } from "@/lib/authRedirect";
import { getMyEntitlements } from "@/lib/api/entitlements.functions";
import { isFigmaPreview } from "@/lib/figmaPreview";

const ADMIN_DENIED_KEY = "admin_access_denied";
const ACCESS_DENIED_KEY = "access_not_approved";
import { markKnownUser } from "@/lib/knownUser";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Ingresar — Agendera — La agenda que se maneja sola" },
      {
        name: "description",
        content: "Ingresá a tu cuenta de Agendera para gestionar la agenda de turnos de tu consultorio.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Ingresar — Agendera — La agenda que se maneja sola" },
      {
        property: "og:description",
        content: "Ingresá a tu cuenta de Agendera para gestionar la agenda de turnos de tu consultorio.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://agendera.lovable.app/auth" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "canonical", href: "https://agendera.lovable.app/auth" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700;12..96,800&display=swap",
      },
    ],
  }),
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { admin?: boolean } =>
    search.admin === true || search.admin === "true" ? { admin: true } : {},
  beforeLoad: async ({ search }) => {
    if (isFigmaPreview) throw redirect({ to: "/agenda" });
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const saved = sessionStorage.getItem(REDIRECT_KEY);
      sessionStorage.removeItem(REDIRECT_KEY);
      const adminFlow = search.admin === true || saved === "/admin";
      if (adminFlow) {
        let isAdmin = false;
        try {
          isAdmin = (await getMyEntitlements()).isAdmin;
        } catch {
          isAdmin = false;
        }
        if (!isAdmin) {
          await supabase.auth.signOut();
          sessionStorage.setItem(ADMIN_DENIED_KEY, "1");
          throw redirect({ to: "/auth", search: { admin: true }, reloadDocument: true });
        }
        markKnownUser();
        throw redirect({ to: "/admin" });
      }
      // Alta por invitación: solo entran los profesionales aprobados por la administradora.
      let approved = false;
      try {
        const me = await getMyEntitlements();
        approved = me.isAdmin || me.accessApproved;
      } catch {
        approved = false;
      }
      if (!approved) {
        await supabase.auth.signOut();
        sessionStorage.setItem(ACCESS_DENIED_KEY, "1");
        throw redirect({ to: "/auth", reloadDocument: true });
      }
      markKnownUser();
      throw redirect({ to: "/agenda" });
    }
  },

  component: AuthPage,
});

function AuthPage() {
  const { admin: adminOnly } = Route.useSearch();
  const [loading, setLoading] = useState<null | "user" | "admin">(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (sessionStorage.getItem(ADMIN_DENIED_KEY)) {
      sessionStorage.removeItem(ADMIN_DENIED_KEY);
      toast.error("Esa cuenta no tiene permisos de administrador.");
    }
    if (sessionStorage.getItem(ACCESS_DENIED_KEY)) {
      sessionStorage.removeItem(ACCESS_DENIED_KEY);
      toast.error("Tu cuenta todavía no está habilitada. Solicitá acceso y te contactamos.");
    }
  }, []);

  async function signIn(mode: "user" | "admin") {
    setLoading(mode);
    try {
      if (mode === "admin") sessionStorage.setItem(REDIRECT_KEY, "/admin");
      else sessionStorage.removeItem(REDIRECT_KEY);
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: mode === "admin" ? `${window.location.origin}/auth?admin=true` : `${window.location.origin}/auth`,
      });
      if (result.error) {
        toast.error("No pudimos iniciar sesión con Google.");
        return;
      }
      // El popup/web_message puede establecer la sesión sin recargar la página:
      // verificamos el rol acá también para no dejar entrar a no-administradores.
      const { data: sess } = await supabase.auth.getUser();
      if (sess.user) {
        if (mode === "admin") {
          let isAdmin = false;
          try {
            isAdmin = (await getMyEntitlements()).isAdmin;
          } catch {
            isAdmin = false;
          }
          if (!isAdmin) {
            await supabase.auth.signOut();
            sessionStorage.removeItem(REDIRECT_KEY);
            toast.error("Esa cuenta no tiene permisos de administrador.");
            return;
          }
          markKnownUser();
          await navigate({ to: "/admin" });
        } else {
          let approved = false;
          try {
            const me = await getMyEntitlements();
            approved = me.isAdmin || me.accessApproved;
          } catch {
            approved = false;
          }
          if (!approved) {
            await supabase.auth.signOut();
            toast.error("Tu cuenta todavía no está habilitada. Solicitá acceso y te contactamos.");
            return;
          }
          markKnownUser();
          await navigate({ to: "/agenda" });
        }
      }
    } catch (e) {
      toast.error("Error inesperado al iniciar sesión.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="landing auth-page">
      <div className="auth-card">
        <Link to="/" className="brand" aria-label="Ir al inicio">
          <img src={agenderaMark} alt="" className="brand__logo" />
          <strong>Agendera</strong>
        </Link>

        <div className={`auth-card__body${adminOnly ? " auth-card__body--single" : ""}`}>
          <div className="auth-col auth-col--main">
            <h1>{adminOnly ? "Ingresar como administrador" : "Ingresá a tu agenda"}</h1>
            <p className="auth-card__lead">
              {adminOnly
                ? "Acceso exclusivo para administradores. Iniciá sesión con tu cuenta de Google autorizada."
                : "Iniciá sesión con tu cuenta de Google para acceder a tu agenda."}
            </p>
            <div className="auth-card__actions">
              <button
                type="button"
                onClick={() => signIn(adminOnly ? "admin" : "user")}
                disabled={!!loading}
                className="button button--primary button--lg"
              >
                {loading ? "Redirigiendo…" : adminOnly ? "Ingresar como administrador" : "Ingresar con Google"}
                {!loading && <ArrowRight />}
              </button>
              {!adminOnly && (
                <button
                  type="button"
                  onClick={() => signIn("admin")}
                  disabled={!!loading}
                  className="button button--secondary button--lg"
                >
                  {loading === "admin" ? "Redirigiendo…" : "Ingresar como administrador"}
                </button>
              )}
            </div>
          </div>

          {!adminOnly && (
            <div className="auth-col auth-col--invite">
              <strong>¿Es tu primera vez por acá?</strong>
              <p>
                El acceso es por invitación: pedí el tuyo y te contactamos cuando tu cuenta esté habilitada.
              </p>
              <Link to="/solicitar-acceso" className="button button--secondary button--md">
                Solicitar acceso
              </Link>
            </div>
          )}
        </div>

        <div className="auth-card__footer">
          <Link to="/" className="button button--secondary button--lg">
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

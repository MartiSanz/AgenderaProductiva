import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useRouter,
  useLocation,
} from "@tanstack/react-router";
import agenderaMark from "@/assets/agendera-mark.png";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarHeart,
  UsersRound,
  PanelsTopLeft,
  Settings2,
  LogOut,
  ShieldCheck,
  BarChart3,
} from "lucide-react";
import "@/styles/landing.css";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEntitlements } from "@/hooks/useEntitlements";
import { getMyEntitlements } from "@/lib/api/entitlements.functions";
import { CalendarReauthBanner } from "@/components/CalendarReauthBanner";
import { Button } from "@/components/ui/button";
import { PanelErrorBoundary } from "@/components/PanelErrorBoundary";
import { SetupWizardDialog } from "@/components/setup/SetupWizardDialog";
import { AdminNotificationsBell } from "@/components/admin/AdminNotificationsBell";
import { LowMessagesDialog } from "@/components/summary/LowMessagesDialog";
import { PaymentDebtBanner } from "@/components/summary/PaymentDebtBanner";
import { figmaPreviewUser, isFigmaPreview } from "@/lib/figmaPreview";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (isFigmaPreview) return { user: figmaPreviewUser };
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    // Validación estricta antes de montar cualquier pantalla: sin aprobación no se renderiza nada.
    let allowed = false;
    try {
      const me = await getMyEntitlements();
      allowed = me.isAdmin || me.accessApproved;
    } catch {
      allowed = false;
    }
    if (!allowed) {
      await supabase.auth.signOut();
      sessionStorage.setItem("access_not_approved", "1");
      throw redirect({ to: "/auth", replace: true });
    }
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const queryClient = useQueryClient();
  const location = useLocation();
  const { status, isAdmin, isLoading, accessApproved } = useEntitlements();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await router.navigate({ to: "/auth", replace: true });
    if (isFigmaPreview) return;
    await supabase.auth.signOut();
  }

  const nav = [
    { to: "/agenda", label: "Agenda", icon: CalendarHeart },
    { to: "/pacientes", label: "Pacientes", icon: UsersRound },
    { to: "/resumen", label: "Resumen del mes", icon: BarChart3 },
  ];

  const inConfig = location.pathname.startsWith("/configuracion");

  const email = user.email ?? "";
  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    email;
  const initials =
    displayName
      .replace(/@.*/, "")
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p: string) => p[0]?.toUpperCase() ?? "")
      .join("") || "U";

  const today = new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
    .format(new Date())
    .replace(/\./g, "");

  if (!isLoading && !accessApproved && !isAdmin) {
    return (
      <div className="app-shell app-notice">
        <div className="app-notice__card">
          <h1>Tu cuenta todavía no está habilitada</h1>
          <p>
            El acceso a Agendera es por invitación. Si ya enviaste tu solicitud, te vamos a escribir
            por email apenas la aprobemos.
          </p>
          <div className="button-row">
            <Link to="/solicitar-acceso" className="button button--primary button--md">
              Solicitar acceso
            </Link>
            <button type="button" className="button button--secondary button--md" onClick={signOut}>
              Salir
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isLoading && status === "suspended" && !isAdmin) {
    return (
      <div className="app-shell app-notice">
        <div className="app-notice__card">
          <h1>Tu acceso está pausado</h1>
          <p>
            Tu cuenta fue suspendida temporalmente. Escribinos para reactivarla y seguir usando la
            agenda. Tus datos siguen guardados.
          </p>
          <button type="button" className="button button--secondary button--md" onClick={signOut}>
            Salir
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header hidden md:block">
        <div className="section-shell">
          <div className="app-header__row">
            <div className="flex items-center gap-4 sm:gap-6 min-w-0">
              <Link to="/agenda" className="brand shrink-0" aria-label="Ir a la agenda">
                <img src={agenderaMark} alt="" className="brand__logo" />
                <span className="app-header__brand-text">
                  <strong>Agendera</strong>
                  <small>Gestión de turnos</small>
                </span>
              </Link>
              <nav
                className="hidden md:flex items-center gap-1"
                aria-label="Navegación de escritorio"
              >
                {nav.map((n) => {
                  const active = location.pathname.startsWith(n.to);
                  return (
                    <Link
                      key={n.to}
                      to={n.to}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground shadow-2xs"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                      }`}
                      aria-current={active ? "page" : undefined}
                    >
                      <n.icon className="h-3.5 w-3.5" />
                      <span>{n.label}</span>
                    </Link>
                  );
                })}
                <Link
                  to="/configuracion"
                  search={{ tab: "perfil" as const }}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    inConfig
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                  }`}
                  aria-current={inConfig ? "page" : undefined}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  <span>Configuración</span>
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <span className="app-header__date hidden lg:inline">{today}</span>
              {isAdmin && (
                <Link
                  to={location.pathname.startsWith("/admin") ? "/agenda" : "/admin"}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs font-semibold rounded-full border transition-all ${
                    location.pathname.startsWith("/admin")
                      ? "bg-primary text-primary-foreground border-primary shadow-xs hover:bg-primary/90"
                      : "bg-amber-500/10 text-amber-900 dark:text-amber-200 border-amber-500/30 hover:bg-amber-500/20"
                  }`}
                  aria-label={
                    location.pathname.startsWith("/admin")
                      ? "Volver a la agenda"
                      : "Ir al panel de administración"
                  }
                  title={
                    location.pathname.startsWith("/admin")
                      ? "Volver a la agenda"
                      : "Panel de administración"
                  }
                >
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">
                    {location.pathname.startsWith("/admin") ? "Mi Agenda" : "Administración"}
                  </span>
                </Link>
              )}
              <AdminNotificationsBell admin={isAdmin} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="app-avatar"
                    aria-label="Menú de usuario"
                  >
                    {initials}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="truncate px-2 py-1.5 text-xs text-muted-foreground">{email}</div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/configuracion" search={{ tab: "perfil" as const }} className="gap-2">
                      <Settings2 className="h-4 w-4" /> Configuración
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/simulador" className="gap-2">
                      <PanelsTopLeft className="h-4 w-4" /> Conoce el Portal Pacientes
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin" className="gap-2">
                        <ShieldCheck className="h-4 w-4" /> Administración
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={signOut}
                    className="gap-2 text-destructive focus:text-destructive"
                  >
                    <LogOut className="h-4 w-4" /> Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>
      <nav className="app-nav app-bottom-nav md:hidden" aria-label="Navegación principal">
        {nav.map((n) => {
          const active = location.pathname.startsWith(n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              className={active ? "is-active" : undefined}
              aria-label={n.label}
              title={n.label}
              aria-current={active ? "page" : undefined}
            >
              <n.icon strokeWidth={2.5} />
              <span className="sr-only">{n.label}</span>
            </Link>
          );
        })}
        <Link
          to="/configuracion"
          search={{ tab: "perfil" as const }}
          className={inConfig ? "is-active" : undefined}
          aria-label="Configuración"
          title="Configuración"
          aria-current={inConfig ? "page" : undefined}
        >
          <Settings2 strokeWidth={2.5} />
          <span className="sr-only">Configuración</span>
        </Link>
      </nav>
      <main className="app-main">
        <CalendarReauthBanner />
        {!isAdmin && accessApproved && (
          <PanelErrorBoundary silent>
            <PaymentDebtBanner />
          </PanelErrorBoundary>
        )}
        <PanelErrorBoundary
          resetKey={location.pathname}
          onOpenWizard={() => window.dispatchEvent(new Event("open-setup-wizard"))}
        >
          <Outlet />
        </PanelErrorBoundary>
        <PanelErrorBoundary silent>
          <SetupWizardDialog />
        </PanelErrorBoundary>
        {!isAdmin && accessApproved && (
          <PanelErrorBoundary silent>
            <LowMessagesDialog />
          </PanelErrorBoundary>
        )}
      </main>
    </div>
  );
}

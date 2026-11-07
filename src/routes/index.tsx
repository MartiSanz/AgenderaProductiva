import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import agenderaMark from "@/assets/agendera-mark.png";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  Copy,
  Home,
  Link2,
  MessageCircle,
  Pencil,
  Plus,
  Settings,
  Sparkles,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { REDIRECT_KEY } from "@/lib/authRedirect";
import { getPublicPlanPrices } from "@/lib/api/access.functions";
import { isFigmaPreview } from "@/lib/figmaPreview";
import "@/styles/landing.css";

const TITLE = "Agendera — Tu tiempo, de nuevo en su lugar";
const DESC =
  "Agendera organiza tus turnos, automatiza recordatorios por WhatsApp y le devuelve calma a cada día de trabajo.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://agendera.lovable.app/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "canonical", href: "https://agendera.lovable.app/" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700;12..96,800&display=swap",
      },
    ],
  }),
  ssr: false,
  beforeLoad: async () => {
    if (isFigmaPreview) throw redirect({ to: "/agenda" });
    const { data } = await supabase.auth.getUser();
    // La validación de aprobación vive en /auth: nunca saltar directo a la agenda.
    if (data.user) throw redirect({ to: "/auth" });
  },
  component: Landing,
});

const guides: { id: string; icon: LucideIcon; title: string; steps: { t: string; d: string }[] }[] = [
  {
    id: "agenda",
    icon: CalendarDays,
    title: "Agenda",
    steps: [
      { t: "Moverte entre semanas", d: "Usá las flechas para recorrer semanas y Hoy para volver a la fecha actual." },
      { t: "Crear un turno", d: "Elegí Nuevo turno, seleccioná a la persona, día y horario, y confirmá el resumen." },
      { t: "Gestionar un turno", d: "Abrí cualquier bloque para confirmar, reprogramar o cancelar con feedback inmediato." },
      { t: "Registrar ausencias", d: "Marcá los días sin atención para mantener la disponibilidad al día." },
    ],
  },
  {
    id: "clientes",
    icon: Users,
    title: "Personas que atendés",
    steps: [
      { t: "Buscar y filtrar", d: "Buscá por nombre, DNI o teléfono y encontrá a cada persona al instante." },
      { t: "Agregar una persona", d: "Cargá sus datos básicos y quedará disponible para asignarle un turno." },
      { t: "Ver historial", d: "Consultá los turnos vinculados a cada persona desde su ficha." },
      { t: "Asignar un turno", d: "Iniciá el flujo de agenda con la persona ya seleccionada." },
    ],
  },
  {
    id: "config",
    icon: Settings,
    title: "Configuración",
    steps: [
      { t: "Definir disponibilidad", d: "Configurá días, horarios, lugares de atención y duración de cada turno." },
      { t: "Personalizar el perfil", d: "Actualizá tu nombre, especialidad y datos de contacto." },
      { t: "Activar recordatorios", d: "Agendera recuerda los turnos por WhatsApp antes de cada cita." },
      { t: "Compartir tu portal", d: "Copiá, abrí o enviá el enlace personal de reservas." },
    ],
  },
  {
    id: "simulador",
    icon: MessageCircle,
    title: "Simulador",
    steps: [
      { t: "Conocer el portal", d: "Recorré una demo del portal de turnos tal como lo ve quien reserva con vos." },
      { t: "Reservar de prueba", d: "Elegí sede, día y horario, revisá el resumen y confirmá, sin crear turnos reales." },
      { t: "Reprogramar o cancelar", d: "Probá cómo se gestiona un turno ya reservado desde el mismo enlace." },
    ],
  },
  {
    id: "admin",
    icon: BarChart3,
    title: "Resumen del mes",
    steps: [
      { t: "Leer el resumen", d: "Revisá turnos atendidos, cancelaciones y ausencias del mes en una mirada." },
      { t: "Seguir tus ingresos", d: "Las barras estiman tus ingresos por mes según el precio de cada tipo de turno." },
      { t: "Mensajes y pagos", d: "Consultá tus recordatorios disponibles, sumá packs y revisá tus pagos." },
    ],
  },
];

const faqs: [string, string][] = [
  ["¿Puedo usar Agendera desde el celular?", "Sí. Funciona desde cualquier navegador y se adapta al celular, tablet o computadora."],
  ["¿Cómo funcionan los recordatorios?", "Agendera envía el aviso antes de cada turno, sin que tengas que revisar la agenda."],
  ["¿Sirve para profesionales que no trabajan en salud?", "Sí. Agendera está pensada para cualquier profesional independiente que trabaje con turnos."],
  ["¿Los recordatorios llegan por WhatsApp?", "Sí. Agendera envía un recordatorio por WhatsApp antes de cada turno, con día, horario y dirección."],
  ["¿Puedo gestionar cambios y cancelaciones?", "Sí. Podés confirmar, reprogramar o cancelar desde el detalle de cada turno."],
  ["¿Cuál es la diferencia entre Base y Pro?", "Base incluye agenda y recordatorios. Pro suma un portal personal para que quienes reservan con vos se autogestionen."],
  ["¿Pueden reservar sin escribirme?", "Con Pro, compartís un enlace donde pueden reservar, consultar, reprogramar o cancelar."],
];

function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className={`brand ${inverse ? "brand--inverse" : ""}`}>
      <img src={agenderaMark} alt="" className="brand__logo" />
      <strong>Agendera</strong>
    </span>
  );
}

function CtaLink({
  children,
  variant = "primary",
  size = "md",
  to = "/auth",
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "quiet";
  size?: "sm" | "md" | "lg";
  to?: "/auth" | "/solicitar-acceso";
}) {
  return (
    <Link to={to} className={`button button--${variant} button--${size}`}>
      {children}
    </Link>
  );
}

function ProductScene() {
  return (
    <div className="product-scene" aria-label="Una solicitud se organiza automáticamente en la agenda">
      <div className="scene-request">
        <span>
          <MessageCircle />
        </span>
        <div>
          <small>Nueva solicitud</small>
          <strong>Laura quiere un turno</strong>
        </div>
      </div>
      <svg className="time-ribbon" viewBox="0 0 620 220" fill="none" aria-hidden="true">
        <path d="M38 72C174 72 145 164 285 164S418 62 584 62" />
        <circle cx="38" cy="72" r="6" />
        <circle cx="285" cy="164" r="6" />
        <circle cx="584" cy="62" r="6" />
      </svg>
      <div className="scene-calendar">
        <header>
          <span>Agosto</span>
          <small>Semana 32</small>
        </header>
        <div className="scene-calendar__days">
          {["Lun", "Mar", "Mié", "Jue"].map((day, i) => (
            <div key={day}>
              <small>{day}</small>
              {i === 2 ? (
                <b>
                  <span>14:00</span> Laura S.
                </b>
              ) : (
                <i />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Accordion({
  title,
  icon: IconCmp,
  open,
  onClick,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  open: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <article className={`accordion ${open ? "is-open" : ""}`}>
      <button onClick={onClick} aria-expanded={open}>
        <span>
          {IconCmp && <IconCmp />}
          {title}
        </span>
        <Plus />
      </button>
      <div className="accordion__content"><div>{children}</div></div>
    </article>
  );
}

const fmtARS = (n: number) => "$" + n.toLocaleString("es-AR", { maximumFractionDigits: 0 });

function PlanPrice({ amount }: { amount?: number }) {
  return (
    <div className="plan-price">
      {typeof amount === "number" && amount > 0 ? (
        <>
          <strong>{fmtARS(amount)}</strong>
          <span>por mes</span>
        </>
      ) : (
        <strong className="plan-price__skeleton" aria-hidden="true" />
      )}
    </div>
  );
}

function Landing() {
  const [openGuide, setOpenGuide] = useState<string | null>("agenda");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [prices, setPrices] = useState<{ basic: number; pro: number } | null>(null);

  useEffect(() => {
    getPublicPlanPrices()
      .then(setPrices)
      .catch(() => setPrices(null));
  }, []);

  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-revealed");
            observer.unobserve(e.target);
          }
        }),
      { threshold: 0.12 },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing">
      <nav className="landing-nav">
        <BrandMark />
        <div className="landing-nav__links">
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#planes">Planes</a>
          <a href="#ayuda">Ayuda</a>
        </div>
        <div className="landing-nav__actions">
          <Link
            to="/auth"
            search={{ admin: true }}
            onClick={() => sessionStorage.setItem(REDIRECT_KEY, "/admin")}
            className="button button--quiet button--sm"
          >
            Administrador
          </Link>
          <CtaLink size="sm">Entrar a mi agenda</CtaLink>
        </div>
      </nav>

      <main>
        <section className="hero section-shell">
          <div className="hero__copy" data-reveal>
            <p className="eyebrow">
              <span /> Gestión de turnos para profesionales independientes
            </p>
            <h1>
              Tu tiempo, de nuevo <em>en su lugar.</em>
            </h1>
            <p className="hero__lead">
              Agendera organiza tus turnos, automatiza recordatorios y le devuelve calma a cada día de trabajo.
            </p>
            <div className="button-row">
              <CtaLink size="lg" to="/solicitar-acceso">
                Organizar mi agenda <ArrowRight />
              </CtaLink>
              <a href="#como-funciona" className="button button--secondary button--lg">
                Ver cómo funciona
              </a>
            </div>
            <p className="micro-proof">
              <Check /> Sin instalaciones. Empezás en minutos.
            </p>
          </div>
          <div className="hero__visual" data-reveal>
            <ProductScene />
          </div>
        </section>

        <section className="problem section-shell" data-reveal>
          <div className="section-intro">
            <p className="eyebrow">Antes de Agendera</p>
            <h2>Un día lleno de turnos no debería sentirse como un rompecabezas.</h2>
          </div>
          <div className="problem__stage">
            <div className="message-stack">
              {["¿Tenés algo para mañana?", "Necesito cambiar mi horario", "¿Me recordás la dirección?", "Finalmente no voy a poder"].map(
                (text, i) => (
                  <div key={text} style={{ "--i": i } as React.CSSProperties}>
                    <MessageCircle />
                    <span>{text}</span>
                    <small>ahora</small>
                  </div>
                ),
              )}
            </div>
            <div className="problem__numbers">
              <div>
                <strong>17</strong>
                <span>mensajes por responder</span>
              </div>
              <div>
                <strong>2 h</strong>
                <span>por día coordinando</span>
              </div>
              <div>
                <strong>1</strong>
                <span>cambio que desordena todo</span>
              </div>
            </div>
          </div>
          <p className="relief-line">No te falta tiempo. Te sobran tareas que Agendera puede ordenar.</p>
        </section>

        <section className="solution" data-reveal>
          <div className="section-shell solution__inner">
            <div className="solution__copy">
              <p className="eyebrow">Una agenda que trabaja con vos</p>
              <h2>Agendera toma el ruido y lo convierte en orden.</h2>
              <p>
                Mientras vos hacés tu trabajo, Agendera reúne solicitudes, encuentra espacio y mantiene a cada persona
                informada.
              </p>
            </div>
            <div className="orbit-scene">
              <div className="automation-core">
                <span>
                  <CalendarDays />
                </span>
              </div>
              {(
                [
                  ["Acceso desde cualquier lugar", Home],
                  ["Recordatorios automáticos", Sparkles],
                  ["Cambios sin caos", Pencil],
                  ["Todo en una sola vista", CalendarDays],
                ] as [string, LucideIcon][]
              ).map(([label, IconCmp], i) => (
                <div className={`orbit-note orbit-note--${i + 1}`} key={label}>
                  <IconCmp />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="como-funciona" className="how section-shell">
          <div className="how__sticky" data-reveal>
            <p className="eyebrow">Cómo funciona</p>
            <h2>Tres movimientos. Cero fricción.</h2>
            <p>De la intención al turno confirmado, cada paso tiene un lugar claro.</p>
            <div className="how__visual">
              <div className="mini-request">
                <User />
                Nueva reserva
              </div>
              <span>
                <ArrowRight />
              </span>
              <div className="mini-slot">
                <CalendarDays />
                Mié 14:00
              </div>
              <span>
                <ArrowRight />
              </span>
              <div className="mini-done">
                <Check />
                Todo listo
              </div>
            </div>
          </div>
          <ol className="how__steps">
            {[
              ["01", "Alguien reserva", "Vos cargás el turno o la persona elige una opción desde tu portal personal."],
              ["02", "Agendera organiza", "La agenda valida disponibilidad y deja el bloque visible para todos."],
              ["03", "Agendera recuerda", "El aviso llega en el momento indicado. Vos seguís con lo importante."],
            ].map(([n, t, d]) => (
              <li key={n} data-reveal>
                <span>{n}</span>
                <div>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="planes" className="plans section-shell" data-reveal>
          <div className="section-intro centered">
            <p className="eyebrow">Planes simples</p>
            <h2>Empezá con orden. Sumá autonomía cuando quieras.</h2>
          </div>
          <div className="plans__compare">
            <article>
              <header>
                <p>Base</p>
                <h3>Tu agenda bajo control</h3>
                <span>Para empezar a recuperar tiempo.</span>
              </header>
              <ul>
                {["Agenda digital", "Gestión de turnos", "Recordatorios por WhatsApp", "Acceso desde cualquier dispositivo"].map(
                  (item) => (
                    <li key={item}>
                      <Check />
                      {item}
                    </li>
                  ),
                )}
              </ul>
              <PlanPrice amount={prices?.basic} />
              <CtaLink variant="secondary" to="/solicitar-acceso">Probar Plan Base</CtaLink>
            </article>
            <article className="plan-pro">
              <p className="plan-flag">Más autonomía</p>
              <header>
                <p>Pro</p>
                <h3>Tu agenda también se gestiona sola</h3>
                <span>Todo Base, más un portal personal.</span>
              </header>
              <div className="portal-link">
                <Link2 />
                <span>agendera.app/consultorio-a</span>
                <Copy />
              </div>
              <ul>
                {["Reservas online", "Reprogramaciones y cancelaciones", "Enlace listo para compartir", "Menos mensajes administrativos"].map(
                  (item) => (
                    <li key={item}>
                      <Check />
                      {item}
                    </li>
                  ),
                )}
              </ul>
              <PlanPrice amount={prices?.pro} />
              <CtaLink to="/solicitar-acceso">Conocer Plan Pro</CtaLink>
            </article>
          </div>
        </section>

        <section id="ayuda" className="help-section">
          <div className="section-shell help-section__inner" data-reveal>
            <div className="help-section__title">
              <div className="help-symbol">
                <MessageCircle />
              </div>
              <div>
                <p className="eyebrow">Centro de ayuda</p>
                <h2>¿Dudas? Acá están las respuestas.</h2>
                <p>Guías breves para conocer cada parte de Agendera.</p>
              </div>
            </div>
            <div className="accordion-list">
              {guides.map((g) => (
                <Accordion
                  key={g.id}
                  title={g.title}
                  icon={g.icon}
                  open={openGuide === g.id}
                  onClick={() => setOpenGuide(openGuide === g.id ? null : g.id)}
                >
                  <ol>
                    {g.steps.map((s, i) => (
                      <li key={s.t}>
                        <span>{i + 1}</span>
                        <div>
                          <strong>{s.t}</strong>
                          <p>{s.d}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </Accordion>
              ))}
            </div>
          </div>
        </section>

        <section id="preguntas-frecuentes" className="faq section-shell" data-reveal>
          <div className="faq__title">
            <p className="eyebrow">Preguntas frecuentes</p>
            <h2>Lo importante, bien claro.</h2>
            <p>Si tu duda no está acá, te acompañamos dentro del producto.</p>
          </div>
          <div className="accordion-list">
            {faqs.map(([q, a], i) => (
              <Accordion key={q} title={q} open={openFaq === i} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <p className="faq-answer">{a}</p>
              </Accordion>
            ))}
          </div>
        </section>

        <section className="final-cta">
          <div className="section-shell final-cta__inner" data-reveal>
            <div>
              <p className="eyebrow">Tu próximo día puede sentirse distinto</p>
              <h2>Innovar no debería darte más trabajo.</h2>
              <p>Dejá que Agendera ordene tus turnos y volvé a usar tu tiempo en lo que elegiste hacer.</p>
              <CtaLink size="lg">
                Entrar a mi agenda <ArrowRight />
              </CtaLink>
            </div>
            <div className="cta-flow">
              <div>
                <User />
                <span>Reserva</span>
              </div>
              <ArrowRight />
              <div>
                <CalendarDays />
                <span>Agenda</span>
              </div>
              <ArrowRight />
              <div>
                <Sparkles />
                <span>Aviso</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <BrandMark inverse />
        <p>Gestión de turnos para profesionales independientes.</p>
        <small>© 2026 Agendera</small>
      </footer>
    </div>
  );
}

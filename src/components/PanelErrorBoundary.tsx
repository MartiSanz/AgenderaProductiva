import { Component, type ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";

type Props = { children: ReactNode; resetKey?: string; onOpenWizard?: () => void; silent?: boolean };
type State = { error: Error | null; notice: boolean; failures: number; firstFailureAt: number };

const MAX_AUTO_RECOVER = 3;
const WINDOW_MS = 10_000;

/**
 * Catches render errors inside the panel. Instead of blocking the screen it shows a
 * dismissible warning and re-renders the page so the user can keep working. Only if
 * the page keeps failing in a short window it falls back to the recovery card.
 */
export class PanelErrorBoundary extends Component<Props, State> {
  state: State = { error: null, notice: false, failures: 0, firstFailureAt: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[PanelErrorBoundary]", error);
    const now = Date.now();
    const inWindow = now - this.state.firstFailureAt < WINDOW_MS;
    const failures = inWindow ? this.state.failures + 1 : 1;
    const firstFailureAt = inWindow ? this.state.firstFailureAt : now;
    if (failures <= MAX_AUTO_RECOVER) {
      // Recover automatically: keep the page usable and show a warning the user can close.
      this.setState({ error: null, notice: true, failures, firstFailureAt });
    } else {
      this.setState({ failures, firstFailureAt });
    }
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && (this.state.error || this.state.notice)) {
      this.setState({ error: null, notice: false, failures: 0, firstFailureAt: 0 });
    }
  }

  private reset = () => this.setState({ error: null, notice: false, failures: 0, firstFailureAt: 0 });

  render() {
    if (this.props.silent) return this.state.error ? null : this.props.children;

    const banner = this.state.notice ? (
      <div
        role="status"
        className="mx-auto mb-4 flex max-w-7xl items-start gap-3 rounded-xl border border-primary/30 bg-primary/10 p-3"
      >
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="flex-1 text-sm">
          <p className="font-semibold text-foreground">Algo no cargó bien</p>
          <p className="text-xs text-muted-foreground">
            Podés seguir usando la app. Si ves datos incompletos, recargá la página.
          </p>
        </div>
        <button
          type="button"
          aria-label="Cerrar aviso"
          onClick={() => this.setState({ notice: false })}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    ) : null;

    if (!this.state.error) {
      return (
        <>
          {banner}
          {this.props.children}
        </>
      );
    }

    return (
      <div className="app-notice" role="alert">
        <div className="app-notice__card">
          <h1>Algo no cargó bien</h1>
          <p>Tus datos están a salvo. Probá recargar esta sección o terminá de configurar tu agenda.</p>
          <div className="button-row">
            <button type="button" className="button button--primary button--md" onClick={this.reset}>
              Reintentar
            </button>
            {this.props.onOpenWizard && (
              <button
                type="button"
                className="button button--secondary button--md"
                onClick={() => {
                  this.reset();
                  this.props.onOpenWizard?.();
                }}
              >
                Abrir asistente de configuración
              </button>
            )}
            <button type="button" className="button button--secondary button--md" onClick={() => window.location.reload()}>
              Recargar página
            </button>
          </div>
        </div>
      </div>
    );
  }
}

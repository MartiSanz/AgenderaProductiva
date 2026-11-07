import { useEffect, useState } from "react";
import { useIsMutating } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

/** Grays out the screen and blocks clicks while a save or page change is in progress. */
export function GlobalLoadingOverlay() {
  const mutating = useIsMutating();
  const navigating = useRouterState({ select: (s) => s.status === "pending" });
  const busy = mutating > 0 || navigating;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!busy) {
      setVisible(false);
      return;
    }
    const t = setTimeout(() => setVisible(true), 500);
    return () => clearTimeout(t);
  }, [busy]);

  if (!busy) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`fixed inset-0 z-[9999] flex cursor-wait items-center justify-center transition-colors duration-150 ${
        visible ? "bg-foreground/30 backdrop-blur-[1.5px]" : "bg-transparent"
      }`}
    >
      {visible && (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-lg">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm font-medium text-foreground">
            {mutating > 0 ? "Procesando…" : "Cargando…"}
          </span>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ProfessionalPortal, Shell, type Pro } from "@/components/portal/PortalFlow";
import { getProfessional } from "@/lib/api/portal.functions";

export function PortalByPro({ proId }: { proId?: string }) {
  const details = useServerFn(getProfessional);
  const [pro, setPro] = useState<Pro | null>(null);
  const [loadingPro, setLoadingPro] = useState(Boolean(proId));

  useEffect(() => {
    if (!proId) return;
    let alive = true;
    setLoadingPro(true);
    details({ data: { ownerId: proId } })
      .then((p: any) => {
        if (!alive) return;
        setPro({ owner_id: p.owner_id, display_name: p.display_name, specialty: p.specialty ?? "", address: p.address ?? "" });
      })
      .catch(() => alive && toast.error("No pudimos abrir la agenda de ese profesional."))
      .finally(() => alive && setLoadingPro(false));
    return () => {
      alive = false;
    };
  }, [proId, details]);

  if (loadingPro)
    return (
      <Shell title="Gestioná tu turno">
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </Shell>
    );
  if (!pro)
    return (
      <Shell title="Gestioná tu turno" subtitle="Necesitás el link de tu profesional">
        <p className="text-muted-foreground">Pedile a tu profesional el link para reservar turnos.</p>
        <Link to="/" className="mt-4 inline-block text-sm text-primary underline">Ir al inicio</Link>
      </Shell>
    );
  return <ProfessionalPortal pro={pro} onExit={() => setPro(null)} lockedToPro={Boolean(proId)} />;
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Archive, Download } from "lucide-react";
import {
  getRetentionStatus,
  exportAppointmentsData,
  purgeOldHistory,
  snoozeRetentionNotice,
} from "@/lib/api/retention.functions";
import { downloadCsv, stamped } from "@/lib/csv";

export function RetentionNotice() {
  const qc = useQueryClient();
  const statusFn = useServerFn(getRetentionStatus);
  const exportFn = useServerFn(exportAppointmentsData);
  const purgeFn = useServerFn(purgeOldHistory);
  const snoozeFn = useServerFn(snoozeRetentionNotice);
  const [downloaded, setDownloaded] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data } = useQuery({ queryKey: ["retention-status"], queryFn: () => statusFn() });

  const exportM = useMutation({
    mutationFn: () => exportFn({ data: { beforeCutoff: true } }),
    onSuccess: (rows) => {
      if (!rows || rows.length === 0) {
        toast.info("No hay turnos para descargar.");
        return;
      }
      downloadCsv(stamped("historial-turnos"), rows);
      setDownloaded(true);
      toast.success("Historial descargado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const purgeM = useMutation({
    mutationFn: () => purgeFn(),
    onSuccess: (r) => {
      toast.success(`Se depuraron ${r.deleted} turno(s)`);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const snoozeM = useMutation({
    mutationFn: () => snoozeFn(),
    onSuccess: () => {
      toast.success("Aviso pospuesto 30 días");
      qc.invalidateQueries({ queryKey: ["retention-status"] });
    },
  });

  if (!data || data.purgeableCount === 0 || data.snoozed) return null;

  return (
    <>
      <Alert>
        <Archive className="h-4 w-4" />
        <AlertTitle>Limpieza de historial disponible</AlertTitle>
        <AlertDescription className="space-y-3">
          <p className="text-sm">
            Hay {data.purgeableCount} turno(s) con más de {data.years} años. Cumplido el plazo legal de conservación
            (Ley 26.529, art. 18), podés descargarlos y depurarlos. Se conserva el último turno de cada paciente y
            ningún paciente se elimina.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => exportM.mutate()} disabled={exportM.isPending}>
              <Download className="h-4 w-4 mr-1" />
              {exportM.isPending ? "Preparando…" : "Descargar historial"}
            </Button>
            <Button size="sm" disabled={!downloaded} onClick={() => setConfirmOpen(true)}>
              Depurar historial
            </Button>
            <Button size="sm" variant="ghost" onClick={() => snoozeM.mutate()} disabled={snoozeM.isPending}>
              Recordármelo en 30 días
            </Button>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox checked={downloaded} onCheckedChange={(v) => setDownloaded(v === true)} />
            Ya tengo una copia del historial
          </label>
        </AlertDescription>
      </Alert>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Depurar {data.purgeableCount} turno(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el detalle de los turnos con más de {data.years} años. Antes de borrar se guarda un resumen
              histórico en la ficha de cada paciente. El último turno de cada paciente y el listado de pacientes se
              conservan. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => purgeM.mutate()}>Depurar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
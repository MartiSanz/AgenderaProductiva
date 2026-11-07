import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveFinanceEntry } from "@/lib/api/finance.functions";
import type { FinanceEntry } from "@/lib/finance";

const NEW_CAT = "__new__";

type Form = { concept: string; category: string; newCategory: string; kind: FinanceEntry["kind"]; frequency: FinanceEntry["frequency"]; currency: FinanceEntry["currency"]; amount: string; fx: string; entry_date: string; end_date: string; provider: string; description: string };

export function EntryDialog({ open, entry, categories, today, onClose, onSaved }: { open: boolean; entry: FinanceEntry | null; categories: string[]; today: string; onClose: () => void; onSaved: () => void }) {
  const save = useServerFn(saveFinanceEntry);
  const blank: Form = { concept: "", category: categories.includes("Otros") ? "Otros" : categories[0] ?? "Otros", newCategory: "", kind: "operating", frequency: "once", currency: "ARS", amount: "", fx: "", entry_date: today, end_date: "", provider: "", description: "" };
  const [f, setF] = useState<Form>(blank);
  useEffect(() => {
    if (!open) return;
    setF(entry ? { ...blank, ...entry, newCategory: "", amount: String(entry.amount), fx: entry.fx_rate ? String(entry.fx_rate) : "", end_date: entry.end_date ?? "", provider: entry.provider ?? "", description: entry.description ?? "" } : blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry]);
  const up = (p: Partial<Form>) => setF((x) => ({ ...x, ...p }));
  const num = (v: string) => Number(v.replace(/\./g, "").replace(",", ".")) || 0;
  const amount = num(f.amount);
  const fx = num(f.fx);

  const m = useMutation({
    mutationFn: () => save({ data: {
      id: entry?.id, concept: f.concept, category: f.category === NEW_CAT ? f.newCategory : f.category, kind: f.kind, frequency: f.frequency,
      currency: f.currency, amount, fx_rate: f.currency === "USD" ? fx || null : null, entry_date: f.entry_date,
      end_date: f.frequency === "once" ? null : f.end_date || null, provider: f.provider, description: f.description,
    } }),
    onSuccess: () => { toast.success(entry ? "Registro actualizado" : "Registro agregado"); onSaved(); onClose(); },
    onError: (e: Error) => toast.error(e.message.includes("[") ? "Revisá los datos del formulario." : e.message),
  });
  const valid = f.concept.trim() && (f.category !== NEW_CAT || f.newCategory.trim()) && amount > 0 && f.entry_date && (f.currency === "ARS" || fx > 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{entry ? "Editar registro" : "Agregar gasto o inversión"}</DialogTitle>
          <DialogDescription>Los cambios quedan guardados en el historial.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label htmlFor="fe-concept">Concepto *</Label><Input id="fe-concept" value={f.concept} onChange={(e) => up({ concept: e.target.value })} /></div>
          <div><Label>Tipo *</Label>
            <Select value={f.kind} onValueChange={(v) => up({ kind: v as Form["kind"] })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="investment">Inversión inicial</SelectItem><SelectItem value="operating">Gasto operativo</SelectItem></SelectContent></Select></div>
          <div><Label>Categoría *</Label>
            <Select value={f.category} onValueChange={(v) => up({ category: v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}<SelectItem value={NEW_CAT}>+ Nueva categoría</SelectItem></SelectContent></Select></div>
          {f.category === NEW_CAT && <div className="sm:col-span-2"><Label>Nombre de la nueva categoría *</Label><Input value={f.newCategory} onChange={(e) => up({ newCategory: e.target.value })} /></div>}
          <div><Label>Moneda *</Label>
            <Select value={f.currency} onValueChange={(v) => up({ currency: v as Form["currency"] })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="ARS">Pesos (ARS)</SelectItem><SelectItem value="USD">Dólares (USD)</SelectItem></SelectContent></Select></div>
          <div><Label htmlFor="fe-amount">Monto *</Label><Input id="fe-amount" inputMode="decimal" value={f.amount} onChange={(e) => up({ amount: e.target.value })} /></div>
          {f.currency === "USD" && (
            <div className="sm:col-span-2"><Label>Tipo de cambio usado (ARS por US$) *</Label><Input inputMode="decimal" value={f.fx} onChange={(e) => up({ fx: e.target.value })} />
              {amount > 0 && fx > 0 && <p className="mt-1 text-xs text-muted-foreground">Equivale a ${Math.round(amount * fx).toLocaleString("es-AR")}. Se guarda este tipo de cambio.</p>}</div>
          )}
          <div><Label>Frecuencia *</Label>
            <Select value={f.frequency} onValueChange={(v) => up({ frequency: v as Form["frequency"] })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="once">Único</SelectItem><SelectItem value="monthly">Mensual</SelectItem><SelectItem value="yearly">Anual</SelectItem></SelectContent></Select></div>
          <div><Label>{f.frequency === "once" ? "Fecha *" : "Fecha de inicio *"}</Label><Input type="date" value={f.entry_date} onChange={(e) => up({ entry_date: e.target.value })} /></div>
          {f.frequency !== "once" && <div><Label>Fecha de finalización</Label><Input type="date" value={f.end_date} min={f.entry_date} onChange={(e) => up({ end_date: e.target.value })} /></div>}
          <div><Label htmlFor="fe-provider">Proveedor</Label><Input id="fe-provider" value={f.provider} onChange={(e) => up({ provider: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label htmlFor="fe-desc">Descripción</Label><Textarea id="fe-desc" rows={2} value={f.description} onChange={(e) => up({ description: e.target.value })} /></div>
        </div>
        {f.entry_date > today && <p className="text-xs text-muted-foreground">Fecha futura: queda como gasto previsto y no suma a los egresos reales hasta esa fecha.</p>}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button disabled={!valid || m.isPending} onClick={() => m.mutate()}>Guardar</Button></div>
      </DialogContent>
    </Dialog>
  );
}

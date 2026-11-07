import { createFileRoute } from "@tanstack/react-router";
import { PhoneInput } from "@/components/PhoneInput";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  listMyPatients,
  addWhitelistPatient,
  updateWhitelistPatient,
  setPatientAllowed,
  setPatientBlocked,
  deletePatient,
} from "@/lib/api/patients.functions";
import { getMyConfig } from "@/lib/api/config.functions";
import { useEntitlements } from "@/hooks/useEntitlements";
import { SectionColorProvider, SectionButton, SectionCheckbox } from "@/components/section-color";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Trash2, Pencil, Plus, X, Search, FileUp, Phone, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated/pacientes")({
  head: () => ({
    meta: [
      { title: "Pacientes habilitados — Agendera — La agenda que se maneja sola" },
      {
        name: "description",
        content:
          "Administrá tu lista de pacientes habilitados y controlá quién puede reservar turnos.",
      },
      { name: "robots", content: "noindex" },
      {
        property: "og:title",
        content: "Pacientes habilitados — Agendera — La agenda que se maneja sola",
      },
      {
        property: "og:description",
        content:
          "Administrá tu lista de pacientes habilitados y controlá quién puede reservar turnos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PatientsPage,
});

const EMPTY = {
  first_name: "",
  last_name: "",
  dni: "",
  phone: "",
  email: "",
  birth_date: "",
  notes: "",
};

function PatientsPage() {
  const list = useServerFn(listMyPatients);
  const add = useServerFn(addWhitelistPatient);
  const upd = useServerFn(updateWhitelistPatient);
  const setAllowed = useServerFn(setPatientAllowed);
  const del = useServerFn(deletePatient);
  const cfgFn = useServerFn(getMyConfig);
  const qc = useQueryClient();
  const { canImportPatients } = useEntitlements();

  const { data = [] } = useQuery({ queryKey: ["patients-all"], queryFn: () => list() });
  const { data: cfg } = useQuery({ queryKey: ["config"], queryFn: () => cfgFn() });
  const whitelistMode = (cfg as any)?.booking_access_mode === "whitelist";

  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 30;
  const [open, setOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["patients-all"] });

  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<{
    created: number;
    failed: { row: number; name: string; reason: string }[];
  } | null>(null);
  const importFile = async (file: File) => {
    setImporting(true);
    try {
      const [{ readSheet }, { parsePatientRows }] = await Promise.all([
        import("read-excel-file/browser"),
        import("@/lib/patientImport"),
      ]);
      const rows = parsePatientRows((await readSheet(file)) as unknown[][]);
      let created = 0;
      const failed: { row: number; name: string; reason: string }[] = [];
      for (const r of rows) {
        if (!r.ok) {
          failed.push({ row: r.row, name: r.name, reason: r.reason });
          continue;
        }
        try {
          await add({ data: r.patient });
          created++;
        } catch (e) {
          failed.push({
            row: r.row,
            name: `${r.patient.first_name} ${r.patient.last_name}`,
            reason: e instanceof Error ? e.message : "Error al guardar",
          });
        }
      }
      await invalidate();
      if (failed.length) setReport({ created, failed });
      else if (created) toast.success(`${created} paciente(s) cargados desde la planilla.`);
      if (!created && !failed.length) toast.info("La planilla no tiene filas con datos.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo leer la planilla.");
    } finally {
      setImporting(false);
    }
  };

  const mSave = useMutation({
    mutationFn: async () => {
      if (editingId) await upd({ data: { ...form, id: editingId } });
      else await add({ data: form });
    },
    onSuccess: () => {
      toast.success(editingId ? "Paciente actualizado" : "Paciente agregado");
      setForm(EMPTY);
      setEditingId(null);
      setOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mAllowed = useMutation({
    mutationFn: (v: { id: string; allowed: boolean }) => setAllowed({ data: v }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const setBlocked = useServerFn(setPatientBlocked);
  const mBlocked = useMutation({
    mutationFn: (v: { id: string; blocked: boolean }) => setBlocked({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(v.blocked ? "Paciente bloqueado" : "Paciente desbloqueado");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDel = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Paciente eliminado");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const q = search.trim().toLowerCase();
  const rows = (data as any[]).filter(
    (p) => !q || `${p.first_name} ${p.last_name} ${p.dni} ${p.phone}`.toLowerCase().includes(q),
  );

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const changeSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  return (
    <div className="zip-ui warm-ui space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pacientes</h1>
        <p className="text-sm text-muted-foreground">
          Lista de pacientes habilitados para reservar turnos por WhatsApp.{" "}
          {whitelistMode
            ? "Hoy solo pueden reservar los pacientes habilitados de esta lista."
            : "Hoy cualquier persona puede reservar; podés cambiarlo en Configuración."}
        </p>
      </div>

      <Dialog
        open={!!report}
        onOpenChange={(v) => {
          if (!v) setReport(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Resultado de la planilla</DialogTitle>
            <DialogDescription>
              {report?.created ?? 0} paciente(s) creados · {report?.failed.length ?? 0} fila(s) sin
              cargar
            </DialogDescription>
          </DialogHeader>
          <ul className="divide-y rounded-md border text-sm">
            {report?.failed.map((f) => (
              <li key={f.row} className="flex flex-col gap-0.5 px-3 py-2">
                <span className="font-medium">
                  Fila {f.row}
                  {f.name ? ` · ${f.name}` : ""}
                </span>
                <span className="text-muted-foreground">{f.reason}</span>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button onClick={() => setReport(null)}>Entendido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SectionColorProvider color="day-4">
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) {
              setEditingId(null);
              setForm(EMPTY);
            }
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-day-4">
                {editingId ? "Editar paciente" : "Agregar paciente"}
              </DialogTitle>
              <DialogDescription>
                Nombre, apellido, DNI y teléfono son obligatorios.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre">
                <Input
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  placeholder="Nombre"
                />
              </Field>
              <Field label="Apellido">
                <Input
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  placeholder="Apellido"
                />
              </Field>
              <Field label="DNI">
                <Input
                  value={form.dni}
                  onChange={(e) => setForm({ ...form, dni: e.target.value })}
                  placeholder="12345678"
                />
              </Field>
              <Field label="Teléfono">
                <PhoneInput value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              </Field>
              <Field label="Fecha de nacimiento">
                <Input
                  type="date"
                  value={form.birth_date}
                  onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Email">
                  <Input
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="nombre@ejemplo.com"
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Notas">
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Observaciones del paciente que querés ver al abrir el turno."
                    rows={3}
                  />
                </Field>
              </div>
            </div>
            <DialogFooter>
              <SectionButton
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  setEditingId(null);
                  setForm(EMPTY);
                }}
              >
                <X className="mr-1 h-4 w-4" /> Cancelar
              </SectionButton>
              <SectionButton
                onClick={() => mSave.mutate()}
                disabled={
                  mSave.isPending || !form.first_name || !form.last_name || form.phone.length < 5
                }
              >
                <Plus className="mr-1 h-4 w-4" />
                {mSave.isPending
                  ? "Guardando…"
                  : editingId
                    ? "Guardar cambios"
                    : "Agregar a la lista"}
              </SectionButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SectionColorProvider>

      <SectionColorProvider color="day-5">
        <div className="mk-clients">
          <div className="mk-client-tools">
            <div className="mk-search-box">
              <Search className="h-4 w-4" aria-hidden />
              <input
                aria-label="Buscar pacientes"
                placeholder="Buscar por nombre, DNI o teléfono…"
                value={search}
                onChange={(e) => changeSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-4">
              <span className="mk-client-count">{rows.length} paciente(s)</span>
              {canImportPatients && (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) void importFile(f);
                    }}
                  />
                  <SectionColorProvider color="day-4">
                    <SectionButton
                      variant="outline"
                      disabled={importing}
                      onClick={() => fileRef.current?.click()}
                    >
                      <FileUp className="mr-1 h-4 w-4" />{" "}
                      {importing ? "Importando…" : "Adjuntar planilla"}
                    </SectionButton>
                  </SectionColorProvider>
                </>
              )}
              <SectionColorProvider color="day-4">
                <SectionButton
                  onClick={() => {
                    setEditingId(null);
                    setForm(EMPTY);
                    setOpen(true);
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" /> Agregar paciente
                </SectionButton>
              </SectionColorProvider>
            </div>
          </div>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay pacientes cargados.</p>
          ) : (
            <div className="mk-client-list">
              {pageRows.map((p) => (
                <article
                  key={p.id}
                  className="cursor-pointer transition-colors hover:bg-muted/30"
                  onClick={() => setSelectedPatient(p)}
                >
                  <div className="mk-client-avatar cursor-pointer" aria-hidden>
                    {`${p.first_name?.[0] ?? ""}${p.last_name?.[0] ?? ""}`.toUpperCase()}
                  </div>
                  <div className="mk-client-main cursor-pointer">
                    <strong>
                      {p.last_name}, {p.first_name}
                      {p.is_blocked && (
                        <span className="ml-2 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                          Bloqueado
                        </span>
                      )}
                    </strong>
                    <span>
                      {p.dni ? `DNI ${p.dni} · ` : ""}
                      {p.phone}
                      {p.email ? ` · ${p.email}` : ""}
                    </span>
                  </div>
                  {whitelistMode && (
                    <label className="mk-client-allowed" onClick={(e) => e.stopPropagation()}>
                      <SectionCheckbox
                        checked={!!p.is_allowed}
                        onCheckedChange={(v: boolean) =>
                          mAllowed.mutate({ id: p.id, allowed: !!v })
                        }
                      />
                      Habilitado
                    </label>
                  )}
                  <div className="mk-client-actions" onClick={(e) => e.stopPropagation()}>
                    {p.is_blocked && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => mBlocked.mutate({ id: p.id, blocked: false })}
                        disabled={mBlocked.isPending}
                      >
                        Desbloquear
                      </Button>
                    )}
                    <button
                      type="button"
                      className="mk-icon-btn"
                      aria-label={`Editar a ${p.first_name} ${p.last_name}`}
                      onClick={() => {
                        setEditingId(p.id);
                        setForm({
                          first_name: p.first_name,
                          last_name: p.last_name,
                          dni: p.dni,
                          phone: p.phone,
                          email: p.email ?? "",
                          birth_date: (p as any).birth_date ?? "",
                          notes: (p as any).notes ?? "",
                        });
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="mk-icon-btn mk-icon-btn--danger"
                      aria-label={`Eliminar a ${p.first_name} ${p.last_name}`}
                      onClick={() => setConfirmDeleteId(p.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {pageCount > 1 && (
            <nav
              className="mt-4 flex items-center justify-center gap-2"
              aria-label="Paginación de pacientes"
            >
              <SectionButton
                variant="outline"
                size="sm"
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
              >
                Anterior
              </SectionButton>
              <span className="text-xs text-muted-foreground">
                Página {safePage} de {pageCount}
              </span>
              <SectionButton
                variant="outline"
                size="sm"
                disabled={safePage >= pageCount}
                onClick={() => setPage(safePage + 1)}
              >
                Siguiente
              </SectionButton>
            </nav>
          )}
        </div>
        {/* Ficha rápida del paciente (Drawer lateral) */}
        <Sheet
          open={!!selectedPatient}
          onOpenChange={(v) => {
            if (!v) setSelectedPatient(null);
          }}
        >
          <SheetContent className="w-full sm:max-w-md overflow-y-auto">
            {selectedPatient && (
              <div className="space-y-6 pt-2">
                <SheetHeader className="text-left space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-day-4/15 text-day-4 font-bold flex items-center justify-center text-lg border border-day-4/25 shrink-0">
                      {`${selectedPatient.first_name?.[0] ?? ""}${selectedPatient.last_name?.[0] ?? ""}`.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <SheetTitle className="text-xl truncate">
                        {selectedPatient.first_name} {selectedPatient.last_name}
                      </SheetTitle>
                      <SheetDescription>
                        {selectedPatient.dni ? `DNI ${selectedPatient.dni}` : "Sin DNI registrado"}
                      </SheetDescription>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {selectedPatient.is_blocked ? (
                      <Badge variant="destructive">Bloqueado</Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-emerald-600/30 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30"
                      >
                        Activo
                      </Badge>
                    )}
                    {whitelistMode && (
                      <Badge variant={selectedPatient.is_allowed ? "secondary" : "outline"}>
                        {selectedPatient.is_allowed ? "Habilitado para turnos" : "No habilitado"}
                      </Badge>
                    )}
                  </div>
                </SheetHeader>

                {/* Acciones directas de contacto rápido */}
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={`https://wa.me/${selectedPatient.phone.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-2xs"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>WhatsApp</span>
                  </a>
                  <a
                    href={`tel:${selectedPatient.phone}`}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border border-input bg-background hover:bg-muted transition-colors text-foreground shadow-2xs"
                  >
                    <Phone className="h-4 w-4" />
                    <span>Llamar</span>
                  </a>
                </div>

                {/* Ficha de datos personales */}
                <div className="space-y-3 rounded-xl border border-border p-4 bg-card/60">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Datos de contacto
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Teléfono</span>
                      <span className="font-mono font-medium">{selectedPatient.phone}</span>
                    </div>
                    {selectedPatient.email && (
                      <div className="flex items-center justify-between py-1 border-b border-border/40">
                        <span className="text-muted-foreground">Email</span>
                        <span className="font-medium truncate max-w-[200px]">
                          {selectedPatient.email}
                        </span>
                      </div>
                    )}
                    {selectedPatient.birth_date && (
                      <div className="flex items-center justify-between py-1 border-b border-border/40">
                        <span className="text-muted-foreground">Nacimiento</span>
                        <span>{selectedPatient.birth_date}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Control de acceso */}
                <div className="space-y-3 rounded-xl border border-border p-4 bg-card/60">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Control de reservas
                  </h4>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Habilitado para turnos</p>
                      <p className="text-xs text-muted-foreground">
                        Puede autogestionar citas con tu link
                      </p>
                    </div>
                    <SectionCheckbox
                      checked={!!selectedPatient.is_allowed}
                      onCheckedChange={(v: boolean) => {
                        mAllowed.mutate({ id: selectedPatient.id, allowed: !!v });
                        setSelectedPatient((prev: any) =>
                          prev ? { ...prev, is_allowed: !!v } : null,
                        );
                      }}
                    />
                  </div>
                  <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Bloquear paciente</p>
                      <p className="text-xs text-muted-foreground">
                        Impide reservas de este contacto
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={selectedPatient.is_blocked ? "outline" : "destructive"}
                      onClick={() => {
                        const nextState = !selectedPatient.is_blocked;
                        mBlocked.mutate({ id: selectedPatient.id, blocked: nextState });
                        setSelectedPatient((prev: any) =>
                          prev ? { ...prev, is_blocked: nextState } : null,
                        );
                      }}
                    >
                      {selectedPatient.is_blocked ? "Desbloquear" : "Bloquear"}
                    </Button>
                  </div>
                </div>

                {/* Notas u observaciones */}
                <div className="space-y-2 rounded-xl border border-border p-4 bg-card/60">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Notas clínicas y observaciones
                  </h4>
                  <p className="text-sm whitespace-pre-wrap text-foreground/90 leading-relaxed">
                    {selectedPatient.notes ? (
                      selectedPatient.notes
                    ) : (
                      <span className="text-muted-foreground italic">
                        Sin notas registradas para este paciente.
                      </span>
                    )}
                  </p>
                </div>

                {/* Botones de acción */}
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    className="flex-1 gap-1.5"
                    variant="outline"
                    onClick={() => {
                      setEditingId(selectedPatient.id);
                      setForm({
                        first_name: selectedPatient.first_name,
                        last_name: selectedPatient.last_name,
                        dni: selectedPatient.dni,
                        phone: selectedPatient.phone,
                        email: selectedPatient.email ?? "",
                        birth_date: selectedPatient.birth_date ?? "",
                        notes: selectedPatient.notes ?? "",
                      });
                      setSelectedPatient(null);
                      setOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    <span>Editar datos</span>
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      const id = selectedPatient.id;
                      setSelectedPatient(null);
                      setConfirmDeleteId(id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
        <Dialog
          open={!!confirmDeleteId}
          onOpenChange={(v) => {
            if (!v) setConfirmDeleteId(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-day-5">¿Eliminar paciente?</DialogTitle>
              <DialogDescription>
                Esta acción no se puede deshacer. El paciente
                {(() => {
                  const p = rows.find((x) => x.id === confirmDeleteId);
                  return p ? ` ${p.first_name} ${p.last_name}` : "";
                })()}
                {` `}se borrará definitivamente.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <SectionButton variant="outline" onClick={() => setConfirmDeleteId(null)}>
                <X className="mr-1 h-4 w-4" /> Cancelar
              </SectionButton>
              <SectionButton
                onClick={() => {
                  if (confirmDeleteId) mDel.mutate(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                disabled={mDel.isPending || !confirmDeleteId}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                {mDel.isPending ? "Eliminando…" : "Sí, eliminar"}
              </SectionButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SectionColorProvider>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

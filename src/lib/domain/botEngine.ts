import { formatDateLong, formatTime } from "./availability";

export type BotSlot = { startISO: string; endISO: string; label: string };
export type DayBlock = { date: string; slots: BotSlot[] };

export type ApptLite = {
  id: string;
  start_at: string;
  patient?: { id: string; first_name: string; last_name: string; dni: string; phone: string } | null;
};

export type BotConfig = {
  display_name?: string;
  address?: string;
  maps_url?: string;
  max_active_appointments_per_patient?: number;
} | null;

export type BotDeps = {
  config: BotConfig;
  availableDays: () => Promise<DayBlock[]>;
  checkAllowed: (dni: string) => Promise<{ allowed: boolean; mode: string }>;
  upcomingForPatient: (dni: string) => Promise<ApptLite[]>;
  findPatient: (dni: string) => Promise<{ id: string; first_name: string } | null>;
  createPatient: (p: { first_name: string; last_name: string; dni: string; email: string }) => Promise<{ id: string }>;
  createAppointment: (patientId: string, startISO: string, endISO: string) => Promise<void>;
  cancelAppointment: (id: string) => Promise<void>;
  rescheduleAppointment: (id: string, startISO: string, endISO: string) => Promise<void>;
  confirmAppointment?: (id: string) => Promise<void>;
  /** Pro plan: the patient can rebook by himself after cancelling a reminder. */
  canSelfBook?: boolean;
};

export type BotFrame = { step: string; ctx: Record<string, any> };
export type BotState = BotFrame & { history: BotFrame[] };

export const INITIAL_STATE: BotState = { step: "menu", ctx: {}, history: [] };

export function menuText(config: BotConfig): string {
  const name = config?.display_name || "el/la profesional";
  return (
    `👋 ¡Hola! Soy el asistente de ${name}. ¿En qué puedo ayudarte?\n\n` +
    "1️⃣ Reservar un turno\n2️⃣ Ver mis turnos\n3️⃣ Cancelar un turno\n4️⃣ Reprogramar un turno\n5️⃣ Cómo llegar"
  );
}

function nav(state: BotState, text: string, final = false): string {
  if (final) return `${text}\n\n🏠 Escribí *menu* para volver al menú principal`;
  if (state.step === "menu") return text;
  const backIsMenu = state.history.length === 0 || state.history[state.history.length - 1].step === "menu";
  if (backIsMenu) return `${text}\n\n0️⃣ Volver`;
  return `${text}\n\n0️⃣ Volver · 🏠 Menú principal (escribí *menu*)`;
}

function push(state: BotState, step: string, ctx: Record<string, any> = {}): BotState {
  return { step, ctx, history: [...state.history, { step: state.step, ctx: state.ctx }] };
}

function reset(): BotState {
  return { step: "menu", ctx: {}, history: [] };
}

export function slotLabel(startISO: string) {
  const d = new Date(startISO);
  return `${formatDateLong(d)} ${formatTime(d)}`;
}

function flatSlots(days: DayBlock[]): BotSlot[] {
  return days.flatMap((d) => d.slots);
}

function daysText(days: DayBlock[]): string {
  let i = 0;
  return days
    .map((d) => {
      const line = d.slots
        .map((s) => {
          i += 1;
          return `${i}) ${s.label}`;
        })
        .join("   ");
      return `*${formatDateLong(new Date(d.date + "T00:00:00"))}*\n${line}`;
    })
    .join("\n\n");
}

function apptsText(appts: ApptLite[]): string {
  return appts.map((a, i) => `${i + 1}) ${slotLabel(a.start_at)}`).join("\n");
}

/** Text rendered when re-entering a step (used by "volver"). */
async function promptFor(state: BotState, deps: BotDeps): Promise<string> {
  switch (state.step) {
    case "menu":
      return menuText(deps.config);
    case "reservar_dni":
      return nav(state, "Ingresá tu DNI para reservar un turno.");
    case "ver_dni":
      return nav(state, "Ingresá tu DNI para ver tus turnos.");
    case "cancelar_dni":
      return nav(state, "Ingresá tu DNI para cancelar un turno.");
    case "reprogramar_dni":
      return nav(state, "Ingresá tu DNI para reprogramar un turno.");
    case "reservar_slot":
      return nav(state, "📅 Estos son los próximos días disponibles. Respondé con el número del horario:\n\n" + daysText(state.ctx.days));
    case "reprogramar_slot":
      return nav(state, `🔁 Reemplazando: ${state.ctx.oldLabel}\n\n📅 Elegí un nuevo horario:\n\n` + daysText(state.ctx.days));
    case "cancelar_pick":
      return nav(state, "❌ Elegí el turno a cancelar:\n" + apptsText(state.ctx.appts));
    case "reprogramar_pick":
      return nav(state, "🔁 Elegí el turno a reprogramar:\n" + apptsText(state.ctx.appts));
    case "reservar_nombre":
      return nav(state, "¿Cuál es tu *nombre*?");
    case "reservar_apellido":
      return nav(state, "¿Cuál es tu *apellido*?");
    case "reservar_email":
      return nav(state, "¿Cuál es tu *email*? (escribí *no* si preferís omitirlo)");
    default:
      return menuText(deps.config);
  }
}

export type BotResult = { state: BotState; replies: string[] };

export async function botGreeting(deps: BotDeps): Promise<BotResult> {
  return { state: reset(), replies: [menuText(deps.config)] };
}

export async function runBot(
  deps: BotDeps,
  prev: BotState,
  rawInput: string,
  options: { isButton?: boolean } = {},
): Promise<BotResult> {
  const input = (rawInput ?? "").trim();
  const lower = input.toLowerCase();
  let state: BotState = { ...prev, history: prev.history ?? [] };

  // Template quick replies ("Confirmar" / "Cancelar") only make sense while a
  // reminder is pending; otherwise stay silent instead of guessing a menu option.
  if (options.isButton && state.step !== "recordatorio") {
    return { state, replies: [] };
  }
  if (state.step === "recordatorio") return await handleReminderReply(deps, state, lower);
  if (state.step === "recordatorio_reprogramar") return await handleReminderReschedule(deps, state, lower);

  // --- Global navigation ---
  if (["menu", "menú", "inicio", "principal", "hola", "start"].includes(lower)) {
    return { state: reset(), replies: [menuText(deps.config)] };
  }
  if (["0", "volver", "atras", "atrás"].includes(lower)) {
    if (state.history.length === 0) return { state: reset(), replies: [menuText(deps.config)] };
    const back = state.history[state.history.length - 1];
    const next: BotState = { step: back.step, ctx: back.ctx, history: state.history.slice(0, -1) };
    return { state: next, replies: [await promptFor(next, deps)] };
  }

  try {
    switch (state.step) {
      case "menu":
      case "final":
        return await handleMenu(deps, state, lower);
      case "reservar_dni":
        return await startBooking(deps, state, input);
      case "reservar_slot":
        return await pickBookingSlot(deps, state, input);
      case "reservar_nombre": {
        if (input.length < 2) return { state, replies: [nav(state, "Necesito tu nombre para continuar.")] };
        const next = push(state, "reservar_apellido", { ...state.ctx, first_name: input });
        return { state: next, replies: [nav(next, "¿Cuál es tu *apellido*?")] };
      }
      case "reservar_apellido": {
        if (input.length < 2) return { state, replies: [nav(state, "Necesito tu apellido para continuar.")] };
        const next = push(state, "reservar_email", { ...state.ctx, last_name: input });
        return { state: next, replies: [nav(next, "¿Cuál es tu *email*? (escribí *no* si preferís omitirlo)")] };
      }
      case "reservar_email":
        return await finishBooking(deps, state, input);
      case "ver_dni":
        return await listMine(deps, state, input);
      case "cancelar_dni":
        return await pickForCancel(deps, state, input);
      case "cancelar_pick":
        return await doCancel(deps, state, input);
      case "reprogramar_dni":
        return await pickForReschedule(deps, state, input);
      case "reprogramar_pick":
        return await chooseRescheduleSlotList(deps, state, input);
      case "reprogramar_slot":
        return await doReschedule(deps, state, input);
      case "como_llegar":
        return { state, replies: [nav(state, "Escribí *menu* para volver al menú principal.")] };
      default:
        return { state: reset(), replies: [menuText(deps.config)] };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Ocurrió un problema. Probá de nuevo.";
    return { state: reset(), replies: [`⚠️ ${msg}\n\n${menuText(deps.config)}`] };
  }
}

async function handleMenu(deps: BotDeps, state: BotState, lower: string): Promise<BotResult> {
  return await handleMenuInner(deps, state, lower);
}

/** Quick reply to the reminder template. Neither answer sends a confirmation text. */
async function handleReminderReply(deps: BotDeps, state: BotState, lower: string): Promise<BotResult> {
  const appointmentId = state.ctx.appointmentId as string | undefined;
  const patientId = state.ctx.patientId as string | undefined;
  if (!appointmentId) return { state: reset(), replies: [] };

  if (lower.includes("confirm")) {
    await deps.confirmAppointment?.(appointmentId);
    return { state: reset(), replies: [] };
  }
  if (lower.includes("cancel")) {
    await deps.cancelAppointment(appointmentId);
    if (!deps.canSelfBook || !patientId) return { state: reset(), replies: [] };
    const next: BotState = { step: "recordatorio_reprogramar", ctx: { patientId }, history: [] };
    return {
      state: next,
      replies: ["Tu turno fue cancelado. ¿Querés reprogramarlo?\n\n1️⃣ Sí\n2️⃣ No"],
    };
  }
  return { state, replies: [] };
}

async function handleReminderReschedule(deps: BotDeps, state: BotState, lower: string): Promise<BotResult> {
  const yes = lower === "1" || lower.startsWith("s") || lower.includes("reprogram");
  const no = lower === "2" || lower.startsWith("n");
  if (no) return { state: reset(), replies: [] };
  if (!yes) return { state, replies: ["Respondé *1* para reprogramar o *2* para dejarlo así."] };

  const days = await deps.availableDays();
  if (days.length === 0) {
    return { state: reset(), replies: ["😕 No hay horarios disponibles por ahora. Probá más tarde."] };
  }
  const next: BotState = {
    step: "reservar_slot",
    ctx: { patientId: state.ctx.patientId, days },
    history: [],
  };
  return {
    state: next,
    replies: ["📅 Estos son los próximos horarios disponibles. Respondé con el número:\n\n" + daysText(days)],
  };
}

async function handleMenuInner(deps: BotDeps, state: BotState, lower: string): Promise<BotResult> {
  const base: BotState = { step: "menu", ctx: {}, history: [] };
  if (lower === "1" || lower.includes("reservar")) {
    const next = push(base, "reservar_dni");
    return { state: next, replies: [nav(next, "Ingresá tu DNI para reservar un turno.")] };
  }
  if (lower === "2" || lower.includes("ver mis")) {
    const next = push(base, "ver_dni");
    return { state: next, replies: [nav(next, "Ingresá tu DNI para ver tus turnos.")] };
  }
  if (lower === "3" || lower.includes("cancelar")) {
    const next = push(base, "cancelar_dni");
    return { state: next, replies: [nav(next, "Ingresá tu DNI para cancelar un turno.")] };
  }
  if (lower === "4" || lower.includes("reprogramar")) {
    const next = push(base, "reprogramar_dni");
    return { state: next, replies: [nav(next, "Ingresá tu DNI para reprogramar un turno.")] };
  }
  if (lower === "5" || lower.includes("llegar") || lower.includes("direcc")) {
    const next = push(base, "como_llegar");
    const addr = deps.config?.address?.trim();
    const maps = deps.config?.maps_url?.trim();
    let msg = "📍 *Cómo llegar*\n\n";
    msg += addr || "El profesional todavía no cargó la dirección del consultorio.";
    if (maps) msg += `\n\n🗺️ ${maps}`;
    return { state: next, replies: [nav(next, msg)] };
  }
  return { state: base, replies: ["No entendí esa opción 🤔\n\n" + menuText(deps.config)] };
}

function validDni(dni: string) {
  return /^\d{6,10}$/.test(dni.replace(/\D/g, "")) ? dni.replace(/\D/g, "") : null;
}

async function startBooking(deps: BotDeps, state: BotState, input: string): Promise<BotResult> {
  const dni = validDni(input);
  if (!dni) return { state, replies: [nav(state, "Ese DNI no parece válido. Ingresalo solo con números.")] };

  const access = await deps.checkAllowed(dni);
  if (!access.allowed) {
    return {
      state: reset(),
      replies: [
        "🔒 Por el momento solo pueden reservar turnos los pacientes registrados por el profesional. Comunicate con el consultorio para que te agreguen.",
      ],
    };
  }

  const patient = await deps.findPatient(dni);
  const active = await deps.upcomingForPatient(dni);
  const cap = deps.config?.max_active_appointments_per_patient ?? 1;
  if (patient && active.length >= cap) {
    return {
      state: reset(),
      replies: [
        `⚠️ Ya tenés ${active.length} turno(s) activo(s), que es el máximo permitido (${cap}). Cancelá o reprogramá uno antes de reservar otro.`,
      ],
    };
  }

  const days = await deps.availableDays();
  if (days.length === 0) {
    return { state: reset(), replies: ["😕 No hay horarios disponibles en los próximos días. Probá más tarde."] };
  }
  const next = push(state, "reservar_slot", { dni, patientId: patient?.id ?? null, days });
  return {
    state: next,
    replies: [nav(next, "📅 Estos son los próximos días disponibles. Respondé con el número del horario:\n\n" + daysText(days))],
  };
}

function pickIndex(input: string, max: number): number | null {
  const n = Number(input.replace(/\D/g, ""));
  if (!Number.isInteger(n) || n < 1 || n > max) return null;
  return n - 1;
}

async function pickBookingSlot(deps: BotDeps, state: BotState, input: string): Promise<BotResult> {
  const slots = flatSlots(state.ctx.days as DayBlock[]);
  const idx = pickIndex(input, slots.length);
  if (idx === null) return { state, replies: [nav(state, "Respondé con el número del horario que preferís.")] };
  const slot = slots[idx];

  if (state.ctx.patientId) {
    await deps.createAppointment(state.ctx.patientId, slot.startISO, slot.endISO);
    return { state: reset(), replies: [bookedText(deps, slot.startISO)] };
  }
  const next = push(state, "reservar_nombre", { ...state.ctx, slot });
  return { state: next, replies: [nav(next, "Para confirmar necesito tus datos.\n\n¿Cuál es tu *nombre*?")] };
}

function bookedText(deps: BotDeps, startISO: string, name?: string) {
  const hello = name ? `✅ ¡Gracias, ${name}! ` : "✅ ";
  const addr = deps.config?.address?.trim();
  return `${hello}Turno reservado para ${slotLabel(startISO)}.${addr ? `\n📍 ${addr}` : ""}\n\n🏠 Escribí *menu* para volver al menú principal`;
}

async function finishBooking(deps: BotDeps, state: BotState, input: string): Promise<BotResult> {
  const lower = input.toLowerCase();
  const email = lower === "no" || lower === "omitir" ? "" : input;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { state, replies: [nav(state, "Ese email no parece válido. Escribilo de nuevo o respondé *no*.")] };
  }
  const { dni, first_name, last_name, slot } = state.ctx;
  const patient = await deps.createPatient({ first_name, last_name, dni, email });
  await deps.createAppointment(patient.id, slot.startISO, slot.endISO);
  return { state: reset(), replies: [bookedText(deps, slot.startISO, first_name)] };
}

async function listMine(deps: BotDeps, state: BotState, input: string): Promise<BotResult> {
  const dni = validDni(input);
  if (!dni) return { state, replies: [nav(state, "Ese DNI no parece válido. Ingresalo solo con números.")] };
  const mine = await deps.upcomingForPatient(dni);
  if (mine.length === 0) {
    return { state: reset(), replies: ["No encontramos turnos activos con ese DNI para este número.\n\n🏠 Escribí *menu* para volver al menú principal"] };
  }
  const text = mine
    .map((a, i) => `${i + 1}) ${a.patient?.first_name ?? ""} ${a.patient?.last_name ?? ""} — ${slotLabel(a.start_at)}`)
    .join("\n");
  return { state: reset(), replies: [`🗓️ Estos son tus próximos turnos:\n${text}\n\n🏠 Escribí *menu* para volver al menú principal`] };
}

async function pickForCancel(deps: BotDeps, state: BotState, input: string): Promise<BotResult> {
  const dni = validDni(input);
  if (!dni) return { state, replies: [nav(state, "Ese DNI no parece válido. Ingresalo solo con números.")] };
  const mine = await deps.upcomingForPatient(dni);
  if (mine.length === 0) {
    return { state: reset(), replies: ["No encontramos turnos activos con ese DNI para este número.\n\n🏠 Escribí *menu* para volver al menú principal"] };
  }
  const next = push(state, "cancelar_pick", { dni, appts: mine });
  return { state: next, replies: [nav(next, "❌ Elegí el turno a cancelar:\n" + apptsText(mine))] };
}

async function doCancel(deps: BotDeps, state: BotState, input: string): Promise<BotResult> {
  const appts = state.ctx.appts as ApptLite[];
  const idx = pickIndex(input, appts.length);
  if (idx === null) return { state, replies: [nav(state, "Respondé con el número del turno.")] };
  await deps.cancelAppointment(appts[idx].id);
  return { state: reset(), replies: ["✅ Turno cancelado. ¡Podés reservar otro cuando quieras!\n\n🏠 Escribí *menu* para volver al menú principal"] };
}

async function pickForReschedule(deps: BotDeps, state: BotState, input: string): Promise<BotResult> {
  const dni = validDni(input);
  if (!dni) return { state, replies: [nav(state, "Ese DNI no parece válido. Ingresalo solo con números.")] };
  const mine = await deps.upcomingForPatient(dni);
  if (mine.length === 0) {
    return { state: reset(), replies: ["No encontramos turnos activos con ese DNI para este número.\n\n🏠 Escribí *menu* para volver al menú principal"] };
  }
  const next = push(state, "reprogramar_pick", { dni, appts: mine });
  return { state: next, replies: [nav(next, "🔁 Elegí el turno a reprogramar:\n" + apptsText(mine))] };
}

async function chooseRescheduleSlotList(deps: BotDeps, state: BotState, input: string): Promise<BotResult> {
  const appts = state.ctx.appts as ApptLite[];
  const idx = pickIndex(input, appts.length);
  if (idx === null) return { state, replies: [nav(state, "Respondé con el número del turno.")] };
  const days = await deps.availableDays();
  if (days.length === 0) {
    return { state: reset(), replies: ["😕 No hay horarios disponibles para reprogramar. Probá más tarde."] };
  }
  const oldLabel = slotLabel(appts[idx].start_at);
  const next = push(state, "reprogramar_slot", { appointmentId: appts[idx].id, oldLabel, days });
  return {
    state: next,
    replies: [nav(next, `🔁 Reemplazando: ${oldLabel}\n\n📅 Elegí un nuevo horario:\n\n` + daysText(days))],
  };
}

async function doReschedule(deps: BotDeps, state: BotState, input: string): Promise<BotResult> {
  const slots = flatSlots(state.ctx.days as DayBlock[]);
  const idx = pickIndex(input, slots.length);
  if (idx === null) return { state, replies: [nav(state, "Respondé con el número del horario que preferís.")] };
  const slot = slots[idx];
  await deps.rescheduleAppointment(state.ctx.appointmentId, slot.startISO, slot.endISO);
  return {
    state: reset(),
    replies: [`✅ Turno reprogramado para ${slotLabel(slot.startISO)}.\n\n🏠 Escribí *menu* para volver al menú principal`],
  };
}
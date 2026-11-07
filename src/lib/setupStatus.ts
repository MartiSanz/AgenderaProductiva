export type SetupStepId = "perfil" | "lugar" | "turnos" | "horarios" | "calendario";

export type SetupInput = {
  config: { display_name?: string | null; phone?: string | null; specialty?: string | null } | null;
  locations: number;
  appointmentTypes: number;
  scheduleSlots: number;
  /** Dated workdays (jornadas); either weekly slots or jornadas satisfy the schedule step. */
  dateBlocks?: number;
  calendarConnected: boolean;
};

/** Done flag per step. Calendar is suggested only and never blocks completion. */
export function setupSteps(i: SetupInput): Record<SetupStepId, boolean> {
  return {
    perfil: !!(i.config?.display_name?.trim() && i.config?.phone?.trim() && i.config?.specialty?.trim()),
    lugar: i.locations > 0,
    turnos: i.appointmentTypes > 0,
    horarios: i.scheduleSlots > 0 || (i.dateBlocks ?? 0) > 0,
    calendario: i.calendarConnected,
  };
}

/** Setup is complete when profile, location, appointment types and schedule are done. */
export function isSetupComplete(i: SetupInput): boolean {
  const s = setupSteps(i);
  return s.perfil && s.lugar && s.turnos && s.horarios;
}

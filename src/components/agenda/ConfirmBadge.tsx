/**
 * "Confirmado" / "Recordatorio enviado" for future appointments.
 * Only shown once the WhatsApp reminder was actually sent.
 */
export function ConfirmBadge({
  appointment,
  className = "",
}: {
  appointment: { start_at: string; status?: string; confirmed_at?: string | null; reminder_sent_at?: string | null };
  className?: string;
}) {
  if (appointment.status === "cancelled") return null;
  const confirmed = Boolean(appointment.confirmed_at);
  if (!confirmed && !appointment.reminder_sent_at) return null;
  if (new Date(appointment.start_at).getTime() < Date.now()) return null;

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        confirmed
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
          : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
      } ${className}`}
    >
      {confirmed ? "Confirmado" : "Recordatorio enviado"}
    </span>
  );
}

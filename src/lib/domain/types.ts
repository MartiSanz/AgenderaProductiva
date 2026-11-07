export const DAYS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as const;
export const DAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;

export type ProfessionalConfig = {
  owner_id: string;
  display_name: string;
  specialty: string;
  address: string;
  phone: string;
  maps_url: string;
  appointment_duration_minutes: number;
  reminder_hour: number;
  timezone: string;
  non_working_days: number[];
};

export type WeeklySlot = {
  id: string;
  day_of_week: number;
  start_time: string; // HH:MM
  end_time: string;
};

export type TimeOff = {
  id: string;
  start_date: string;
  end_date: string;
  reason: string;
  /** HH:MM; null/empty = whole day. */
  start_time?: string | null;
  end_time?: string | null;
};

export type Patient = {
  id: string;
  first_name: string;
  last_name: string;
  dni: string;
  email: string;
  phone: string;
};

export type Appointment = {
  id: string;
  patient_id: string;
  start_at: string;
  end_at: string;
  status: "active" | "cancelled" | "completed";
  notes: string;
};
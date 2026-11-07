import type { PortalApi } from "./PortalFlow";

/**
 * Versión ficticia de las funciones del portal para la demo del profesional.
 * Todo vive en memoria: nada se guarda en la base de datos.
 */
type Appt = { id: string; start_at: string; end_at: string };

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const wait = () => new Promise((r) => setTimeout(r, 250));

const TIMES = ["09:00", "09:30", "10:30", "11:00", "15:00", "16:30", "17:00"];

function nextWorkday(d: Date) {
  const n = new Date(d);
  do n.setDate(n.getDate() + 1);
  while (n.getDay() === 0 || n.getDay() === 6);
  return n;
}

function at(date: Date, time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const s = new Date(date);
  s.setHours(h, m, 0, 0);
  return { start: s, end: new Date(s.getTime() + minutes * 60000) };
}

export function createDemoPortalApi(info: { displayName: string; address: string }): PortalApi {
  const types = [
    { id: "demo-first", name: "Primera consulta", duration_minutes: 45 },
    { id: "demo-follow", name: "Consulta de seguimiento", duration_minutes: 30 },
  ];
  // Igual que el portal real: un paciente nuevo primero reserva; después puede verlo, cancelarlo o reprogramarlo.
  let booked: Appt[] = [];

  return {
    types: async () => (await wait(), types),
    details: async () => (
      await wait(),
      {
        display_name: info.displayName,
        address: info.address,
        maps_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(info.address)}`,
        locations: [],
        schedule: [],
        timezone: "",
      }
    ),
    availability: async ({ data }) => {
      await wait();
      const minutes = types.find((t) => t.id === data.typeId)?.duration_minutes ?? 30;
      let cursor = data.from ? new Date(`${data.from}T00:00:00`) : new Date();
      if (data.from) cursor.setDate(cursor.getDate() - 1);
      const days = [];
      for (let i = 0; i < (data.count ?? 3); i++) {
        cursor = nextWorkday(cursor);
        const slots = TIMES.map((t) => {
          const { start, end } = at(cursor, t, minutes);
          return { startISO: start.toISOString(), endISO: end.toISOString(), label: t };
        });
        days.push({ date: ymd(cursor), slots });
      }
      return { days, nextFrom: ymd(nextWorkday(cursor)) };
    },
    lookup: async () => {
      await wait();
      if (!booked.length) return { found: false, blocked: false, patient: null, appointments: [], maxActive: 1 };
      return { found: true, blocked: false, patient: { first_name: "Paciente", last_name: "Demo" }, appointments: booked, maxActive: 1 };
    },
    book: async ({ data }) => {
      await wait();
      booked = [{ id: `demo-${Date.now()}`, start_at: data.startISO, end_at: data.endISO }];
      return { ok: true, startISO: data.startISO };
    },
    cancel: async ({ data }) => {
      await wait();
      booked = booked.filter((a) => a.id !== data.appointmentId);
      return { ok: true };
    },
    reschedule: async ({ data }) => {
      await wait();
      const move = (a: Appt) => (a.id === data.appointmentId ? { ...a, start_at: data.startISO, end_at: data.endISO } : a);
      booked = booked.map(move);
      return { ok: true, startISO: data.startISO };
    },
  };
}

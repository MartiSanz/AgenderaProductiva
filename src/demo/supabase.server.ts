/* eslint-disable @typescript-eslint/no-explicit-any */

type Row = Record<string, any>;
type TableMap = Record<string, Row[]>;
type Filter = (row: Row) => boolean;

export const DEMO_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const PRO_IDS = [
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
  "00000000-0000-4000-8000-000000000004",
];

const uid = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const iso = (days = 0, hour = 12, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};
const date = (days = 0) => iso(days).slice(0, 10);
const month = (offset = 0) => {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const users: Row[] = [
  {
    id: DEMO_ADMIN_ID,
    email: "admin@agendera.demo",
    created_at: iso(-280),
    last_sign_in_at: iso(0),
    user_metadata: { full_name: "Administración Agendera" },
  },
  {
    id: PRO_IDS[0],
    email: "sofia.martinez@agendera.demo",
    created_at: iso(-210),
    last_sign_in_at: iso(-1),
    user_metadata: { full_name: "Sofía Martínez" },
  },
  {
    id: PRO_IDS[1],
    email: "lucas.romero@agendera.demo",
    created_at: iso(-150),
    last_sign_in_at: iso(-4),
    user_metadata: { full_name: "Lucas Romero" },
  },
  {
    id: PRO_IDS[2],
    email: "valentina.lopez@agendera.demo",
    created_at: iso(-45),
    last_sign_in_at: iso(-18),
    user_metadata: { full_name: "Valentina López" },
  },
];

function patient(id: number, first: string, last: string, phone: string, createdDays: number): Row {
  return {
    id: uid(id),
    owner_id: DEMO_ADMIN_ID,
    first_name: first,
    last_name: last,
    phone,
    dni: String(30_000_000 + id * 137),
    email: `${first}.${last}@demo.local`.toLowerCase(),
    birth_date: `199${id % 10}-0${(id % 8) + 1}-15`,
    notes: id % 2 ? "Prefiere turnos por la mañana." : "",
    is_allowed: true,
    is_blocked: false,
    absence_reset_at: null,
    created_at: iso(createdDays),
    updated_at: iso(createdDays),
  };
}

const patients = [
  patient(10, "Carolina", "Gómez", "+5491123456710", -130),
  patient(11, "Martín", "Fernández", "+5491123456711", -95),
  patient(12, "Julieta", "Paz", "+5491123456712", -70),
  patient(13, "Nicolás", "Suárez", "+5491123456713", -42),
  patient(14, "Camila", "Torres", "+5491123456714", -21),
  patient(15, "Joaquín", "Acosta", "+5491123456715", -6),
];

const appointmentTypes = [
  {
    id: uid(30),
    owner_id: DEMO_ADMIN_ID,
    name: "Primera consulta",
    duration_minutes: 45,
    price_ars: 28000,
    created_at: iso(-200),
  },
  {
    id: uid(31),
    owner_id: DEMO_ADMIN_ID,
    name: "Consulta de seguimiento",
    duration_minutes: 30,
    price_ars: 22000,
    created_at: iso(-200),
  },
  {
    id: uid(32),
    owner_id: DEMO_ADMIN_ID,
    name: "Control breve",
    duration_minutes: 20,
    price_ars: 16000,
    created_at: iso(-160),
  },
];

function appointment(
  id: number,
  patientIndex: number,
  days: number,
  hour: number,
  typeIndex: number,
  attendance = "pending",
  status = "active",
): Row {
  const start = new Date(iso(days, hour));
  const duration = appointmentTypes[typeIndex].duration_minutes;
  return {
    id: uid(id),
    owner_id: DEMO_ADMIN_ID,
    patient_id: patients[patientIndex].id,
    start_at: start.toISOString(),
    end_at: new Date(start.getTime() + duration * 60_000).toISOString(),
    status,
    attendance,
    attendance_marked_at: attendance === "pending" ? null : iso(days, hour + 1),
    notes: id % 2 ? "Seguimiento general." : "",
    appointment_type_id: appointmentTypes[typeIndex].id,
    appointment_type_name: appointmentTypes[typeIndex].name,
    calendar_event_id: "",
    reminder_sent_at: days >= 0 ? iso(days - 1, 10) : null,
    reschedule_count: id % 3 === 0 ? 1 : 0,
    created_at: iso(days - 8),
    updated_at: iso(days - 8),
  };
}

const appointments = [
  appointment(40, 0, -36, 10, 0, "attended"),
  appointment(41, 1, -24, 15, 1, "absent_notified"),
  appointment(42, 2, -15, 9, 1, "attended"),
  appointment(43, 3, -8, 17, 2, "absent_no_notice"),
  appointment(44, 4, -3, 11, 0, "attended"),
  appointment(45, 0, 0, 10, 1),
  appointment(46, 1, 0, 14, 0),
  appointment(47, 2, 1, 9, 2),
  appointment(48, 3, 2, 16, 1),
  appointment(49, 4, 4, 11, 0),
  appointment(50, 5, 6, 15, 1),
  appointment(51, 1, -5, 12, 1, "pending", "cancelled"),
];

const locations = [
  {
    id: uid(60),
    owner_id: DEMO_ADMIN_ID,
    name: "Consultorio Centro",
    city: "Buenos Aires",
    address: "Av. Santa Fe 1845, CABA",
    maps_url: "https://maps.google.com",
    created_at: iso(-240),
  },
  {
    id: uid(61),
    owner_id: DEMO_ADMIN_ID,
    name: "Sede Palermo",
    city: "Buenos Aires",
    address: "Thames 1450, CABA",
    maps_url: "https://maps.google.com",
    created_at: iso(-120),
  },
];

const weeklySchedule = [1, 2, 3, 4, 5].flatMap((dayOfWeek, index) => [
  {
    id: uid(70 + index * 2),
    owner_id: DEMO_ADMIN_ID,
    day_of_week: dayOfWeek,
    start_time: "09:00",
    end_time: "13:00",
    location_id: locations[0].id,
  },
  {
    id: uid(71 + index * 2),
    owner_id: DEMO_ADMIN_ID,
    day_of_week: dayOfWeek,
    start_time: "14:00",
    end_time: "18:00",
    location_id: index % 2 ? locations[1].id : locations[0].id,
  },
]);

const proConfigs = [
  ["Sofía Martínez", "Nutricionista", "+5491133300001", "Av. Córdoba 2250"],
  ["Lucas Romero", "Kinesiólogo", "+5491133300002", "Av. Rivadavia 4100"],
  ["Valentina López", "Psicóloga", "+5491133300003", "Juramento 1800"],
].map(([display_name, specialty, phone, address], index) => ({
  owner_id: PRO_IDS[index],
  display_name,
  specialty,
  phone,
  address,
  maps_url: "",
  timezone: "America/Argentina/Buenos_Aires",
  appointment_duration_minutes: 30,
  reminder_hour: 10,
  booking_access_mode: "open",
  max_active_appointments_per_patient: 2,
  non_working_days: [0],
  calendar_last_sync_at: index === 0 ? iso(0, 8) : null,
  calendar_last_sync_summary: { conflicts: [] },
}));

const tables: TableMap = {
  professional_config: [
    {
      owner_id: DEMO_ADMIN_ID,
      display_name: "Dra. Martina Demo",
      specialty: "Clínica integral",
      address: locations[0].address,
      maps_url: locations[0].maps_url,
      phone: "+5491112345678",
      timezone: "America/Argentina/Buenos_Aires",
      appointment_duration_minutes: 30,
      reminder_hour: 10,
      booking_access_mode: "open",
      max_active_appointments_per_patient: 3,
      non_working_days: [0],
      retention_years: 10,
      retention_notice_snoozed_until: null,
      calendar_sync_mode: "manual",
      calendar_sync_interval_minutes: 30,
      calendar_last_sync_at: iso(0, 8),
      calendar_last_sync_summary: { created: 2, updated: 1, conflicts: [] },
      google_calendar_id: "",
      google_calendar_name: "Turnos",
      created_at: iso(-280),
      updated_at: iso(-1),
    },
    ...proConfigs,
  ],
  patients,
  appointment_types: appointmentTypes,
  appointments,
  locations,
  weekly_schedule: weeklySchedule,
  schedule_date_blocks: [],
  time_off: [
    {
      id: uid(90),
      owner_id: DEMO_ADMIN_ID,
      start_date: date(18),
      end_date: date(20),
      start_time: null,
      end_time: null,
      reason: "Congreso profesional",
      calendar_event_id: "",
      created_at: iso(-4),
    },
  ],
  account_plans: [
    {
      user_id: DEMO_ADMIN_ID,
      plan: "pro",
      status: "active",
      payment_status: "paid",
      created_at: iso(-280),
      is_test: true,
    },
    {
      user_id: PRO_IDS[0],
      plan: "pro",
      status: "active",
      payment_status: "paid",
      last_payment_at: date(-10),
      created_at: iso(-210),
      is_test: false,
    },
    {
      user_id: PRO_IDS[1],
      plan: "basic",
      status: "active",
      payment_status: "pending",
      last_payment_at: date(-42),
      created_at: iso(-150),
      is_test: false,
    },
    {
      user_id: PRO_IDS[2],
      plan: "pro",
      status: "active",
      payment_status: "overdue",
      last_payment_at: null,
      created_at: iso(-45),
      is_test: false,
    },
  ],
  plan_feature_overrides: [],
  user_roles: [{ id: uid(100), user_id: DEMO_ADMIN_ID, role: "admin", created_at: iso(-280) }],
  access_requests: [
    ...PRO_IDS.map((id, index) => ({
      id: uid(110 + index),
      email: users[index + 1].email,
      full_name: users[index + 1].user_metadata.full_name,
      phone: proConfigs[index].phone,
      profession: proConfigs[index].specialty,
      city: "Buenos Aires",
      weekly_volume: index === 0 ? "20–40 turnos" : "10–20 turnos",
      goal: "Organizar la agenda y automatizar recordatorios.",
      admin_notes: "",
      requested_plan: index === 1 ? "basic" : "pro",
      status: "approved",
      created_at: iso(-220 + index * 60),
      reviewed_at: iso(-218 + index * 60),
      invited_at: iso(-218 + index * 60),
    })),
    {
      id: uid(115),
      email: "florencia.ruiz@agendera.demo",
      full_name: "Florencia Ruiz",
      phone: "+5491133300015",
      profession: "Fonoaudióloga",
      city: "Rosario",
      weekly_volume: "10–20 turnos",
      goal: "Reducir tareas administrativas.",
      requested_plan: "pro",
      status: "pending",
      admin_notes: "",
      created_at: iso(-2),
      reviewed_at: null,
      invited_at: null,
    },
    {
      id: uid(116),
      email: "diego.sosa@agendera.demo",
      full_name: "Diego Sosa",
      phone: "+5491133300016",
      profession: "Entrenador",
      city: "Córdoba",
      weekly_volume: "Menos de 10 turnos",
      goal: "Probar la agenda digital.",
      requested_plan: "basic",
      status: "rejected",
      admin_notes: "Fuera del alcance actual.",
      created_at: iso(-18),
      reviewed_at: iso(-16),
      invited_at: null,
    },
  ],
  billing_settings: [
    {
      id: 1,
      amount_basic: 18000,
      amount_pro: 30000,
      alias: "AGENDERA.DEMO",
      receipt_phone: "+5491111111111",
    },
  ],
  message_packs: [
    { id: uid(120), quantity: 50, price_ars: 6500, validity_days: 60, active: true, sort_order: 1 },
    {
      id: uid(121),
      quantity: 100,
      price_ars: 11000,
      validity_days: 90,
      active: true,
      sort_order: 2,
    },
    {
      id: uid(122),
      quantity: 250,
      price_ars: 24000,
      validity_days: 120,
      active: true,
      sort_order: 3,
    },
  ],
  professional_message_packs: [
    {
      id: uid(130),
      owner_id: DEMO_ADMIN_ID,
      pack_id: uid(121),
      quantity: 100,
      remaining: 72,
      price_ars: 11000,
      purchased_at: iso(-12),
      expires_at: iso(78),
      payment_status: "paid",
      paid_at: iso(-12),
      cancelled_at: null,
    },
  ],
  account_payments: [
    {
      id: uid(140),
      user_id: PRO_IDS[0],
      period: month(-1),
      amount: 30000,
      paid_at: date(-12),
      reference: "TRX-1042",
      created_at: iso(-12),
    },
    {
      id: uid(141),
      user_id: PRO_IDS[1],
      period: month(-2),
      amount: 18000,
      paid_at: date(-40),
      reference: "TRX-998",
      created_at: iso(-40),
    },
  ],
  reminder_attempts: appointments.slice(0, 9).map((a, index) => ({
    id: uid(150 + index),
    owner_id: index > 5 ? PRO_IDS[index % PRO_IDS.length] : DEMO_ADMIN_ID,
    appointment_id: a.id,
    trigger: "appointment_reminder",
    status: index === 3 ? "failed" : index % 3 === 0 ? "read" : "delivered",
    error: index === 3 ? "Número no disponible" : "",
    status_at: iso(-index),
    created_at: iso(-index),
  })),
  account_events: [
    {
      id: uid(170),
      user_id: PRO_IDS[0],
      event_type: "payment",
      description: "Pago registrado",
      actor_id: DEMO_ADMIN_ID,
      meta: {},
      created_at: iso(-12),
    },
    {
      id: uid(171),
      user_id: PRO_IDS[1],
      event_type: "payment_reminder",
      description: "Recordatorio de pago enviado",
      actor_id: DEMO_ADMIN_ID,
      meta: { period: month(-1) },
      created_at: iso(-2),
    },
  ],
  whatsapp_accounts: [
    {
      id: uid(180),
      owner_id: DEMO_ADMIN_ID,
      phone_number_id: "demo-phone",
      display_phone: "+54 9 11 5555-0000",
      business_account_id: "demo-business",
      status: "connected",
      last_error: "",
      updated_at: iso(0, 8),
      verify_token: "demo",
      access_token_ciphertext: "demo",
      app_secret_ciphertext: "demo",
    },
  ],
  app_user_connections: [
    {
      id: uid(182),
      user_id: DEMO_ADMIN_ID,
      connector_id: "google_calendar",
      connection_key_ciphertext: "demo",
    },
    {
      id: uid(181),
      user_id: PRO_IDS[0],
      connector_id: "google_calendar",
      connection_key_ciphertext: "demo",
    },
  ],
  app_user_connection_slots: [],
  sim_messages: [
    {
      id: uid(190),
      owner_id: DEMO_ADMIN_ID,
      phone: "+5491112345678",
      direction: "in",
      body: "Hola, quiero reservar un turno",
      meta: {},
      created_at: iso(0, 9),
    },
    {
      id: uid(191),
      owner_id: DEMO_ADMIN_ID,
      phone: "+5491112345678",
      direction: "out",
      body: "¡Hola! Elegí una opción para continuar.",
      meta: {},
      created_at: iso(0, 9, 1),
    },
  ],
  finance_categories: [
    { name: "Software" },
    { name: "Marketing" },
    { name: "Equipamiento" },
    { name: "Servicios" },
  ],
  finance_entries: [
    {
      id: uid(200),
      concept: "Hosting e infraestructura",
      category: "Software",
      kind: "operating",
      frequency: "monthly",
      currency: "ARS",
      amount: 48000,
      amount_ars: 48000,
      fx_rate: null,
      entry_date: date(-120),
      end_date: null,
      provider: "Cloud Demo",
      description: "",
      deleted_at: null,
      created_at: iso(-120),
    },
    {
      id: uid(201),
      concept: "Campaña de lanzamiento",
      category: "Marketing",
      kind: "investment",
      frequency: "once",
      currency: "ARS",
      amount: 125000,
      amount_ars: 125000,
      fx_rate: null,
      entry_date: date(-20),
      end_date: null,
      provider: "Estudio creativo",
      description: "",
      deleted_at: null,
      created_at: iso(-20),
    },
  ],
  finance_audit: [],
  push_subscriptions: [],
  internal_settings: [],
  purge_log: [],
  whatsapp_sessions: [],
  whatsapp_processed_messages: [],
};

function valuesAt(row: Row, path: string): any[] {
  const parts = path.split(".");
  let values: any[] = [row];
  for (const part of parts) {
    values = values.flatMap((value) => {
      const next = value?.[part];
      return Array.isArray(next) ? next : [next];
    });
  }
  return values;
}

function addRelations(table: string, row: Row): Row {
  const copy = { ...row };
  if (table === "appointments") {
    copy.patient = tables.patients.find((p) => p.id === row.patient_id) ?? null;
    copy.type = tables.appointment_types.find((t) => t.id === row.appointment_type_id) ?? null;
  }
  if (table === "patients") {
    copy.appointments = tables.appointments.filter((a) => a.patient_id === row.id);
  }
  return copy;
}

class DemoQuery implements PromiseLike<any> {
  private filters: Filter[] = [];
  private orders: { field: string; ascending: boolean }[] = [];
  private maxRows: number | null = null;
  private slice: [number, number] | null = null;
  private mode: "many" | "single" | "maybeSingle" = "many";
  private operation: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: Row | Row[] | null = null;
  private returning = false;
  private head = false;
  private wantsCount = false;
  private conflictFields: string[] = [];
  private ignoreDuplicates = false;
  private promise: Promise<any> | null = null;

  constructor(private table: string) {}

  select(_columns = "*", options?: { count?: string; head?: boolean }) {
    this.returning = this.operation !== "select";
    this.head = !!options?.head;
    this.wantsCount = options?.count === "exact";
    return this;
  }
  insert(payload: Row | Row[]) {
    this.operation = "insert";
    this.payload = payload;
    return this;
  }
  update(payload: Row) {
    this.operation = "update";
    this.payload = payload;
    return this;
  }
  upsert(payload: Row | Row[], options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.operation = "upsert";
    this.payload = payload;
    this.conflictFields = options?.onConflict?.split(",").map((x) => x.trim()) ?? [];
    this.ignoreDuplicates = !!options?.ignoreDuplicates;
    return this;
  }
  delete() {
    this.operation = "delete";
    return this;
  }
  eq(field: string, value: any) {
    this.filters.push((row) => valuesAt(row, field).some((candidate) => candidate === value));
    return this;
  }
  neq(field: string, value: any) {
    this.filters.push((row) => valuesAt(row, field).every((candidate) => candidate !== value));
    return this;
  }
  in(field: string, values: any[]) {
    this.filters.push((row) =>
      valuesAt(row, field).some((candidate) => values.includes(candidate)),
    );
    return this;
  }
  gte(field: string, value: any) {
    this.filters.push((row) => valuesAt(row, field).some((candidate) => candidate >= value));
    return this;
  }
  gt(field: string, value: any) {
    this.filters.push((row) => valuesAt(row, field).some((candidate) => candidate > value));
    return this;
  }
  lte(field: string, value: any) {
    this.filters.push((row) => valuesAt(row, field).some((candidate) => candidate <= value));
    return this;
  }
  lt(field: string, value: any) {
    this.filters.push((row) => valuesAt(row, field).some((candidate) => candidate < value));
    return this;
  }
  is(field: string, value: any) {
    this.filters.push((row) => valuesAt(row, field).some((candidate) => candidate === value));
    return this;
  }
  not(field: string, operator: string, value: any) {
    if (operator === "is") return this.neq(field, value);
    return this;
  }
  ilike(field: string, pattern: string) {
    const needle = pattern.replaceAll("%", "").toLocaleLowerCase();
    this.filters.push((row) =>
      valuesAt(row, field).some((candidate) =>
        String(candidate ?? "")
          .toLocaleLowerCase()
          .includes(needle),
      ),
    );
    return this;
  }
  order(field: string, options?: { ascending?: boolean }) {
    this.orders.push({ field, ascending: options?.ascending !== false });
    return this;
  }
  limit(value: number) {
    this.maxRows = value;
    return this;
  }
  range(from: number, to: number) {
    this.slice = [from, to];
    return this;
  }
  single() {
    this.mode = "single";
    return this;
  }
  maybeSingle() {
    this.mode = "maybeSingle";
    return this;
  }

  private matches(row: Row) {
    const related = addRelations(this.table, row);
    return this.filters.every((filter) => filter(related));
  }

  private makeRows(payload: Row | Row[]) {
    const now = new Date().toISOString();
    return (Array.isArray(payload) ? payload : [payload]).map((row) => ({
      id: row.id ?? crypto.randomUUID(),
      created_at: row.created_at ?? now,
      updated_at: row.updated_at ?? now,
      ...structuredClone(row),
    }));
  }

  private async execute() {
    const source = (tables[this.table] ??= []);
    let affected: Row[] = [];

    if (this.operation === "insert" && this.payload) {
      affected = this.makeRows(this.payload);
      source.push(...affected);
    } else if (this.operation === "update" && this.payload) {
      for (const row of source) {
        if (!this.matches(row)) continue;
        Object.assign(row, structuredClone(this.payload), { updated_at: new Date().toISOString() });
        affected.push(row);
      }
    } else if (this.operation === "delete") {
      for (let index = source.length - 1; index >= 0; index--) {
        if (!this.matches(source[index])) continue;
        affected.unshift(...source.splice(index, 1));
      }
    } else if (this.operation === "upsert" && this.payload) {
      for (const candidate of this.makeRows(this.payload)) {
        const fields = this.conflictFields.length ? this.conflictFields : ["id"];
        const existing = source.find((row) =>
          fields.every((field) => row[field] === candidate[field]),
        );
        if (existing) {
          if (!this.ignoreDuplicates)
            Object.assign(existing, candidate, { updated_at: new Date().toISOString() });
          affected.push(existing);
        } else {
          source.push(candidate);
          affected.push(candidate);
        }
      }
    }

    let rows = this.operation === "select" ? source.filter((row) => this.matches(row)) : affected;
    rows = rows.map((row) => addRelations(this.table, structuredClone(row)));

    if (this.orders.length) {
      rows.sort((left, right) => {
        for (const order of this.orders) {
          const a = valuesAt(left, order.field)[0];
          const b = valuesAt(right, order.field)[0];
          if (a === b) continue;
          const result = a == null ? -1 : b == null ? 1 : a < b ? -1 : 1;
          return order.ascending ? result : -result;
        }
        return 0;
      });
    }
    const count = rows.length;
    if (this.slice) rows = rows.slice(this.slice[0], this.slice[1] + 1);
    if (this.maxRows != null) rows = rows.slice(0, this.maxRows);

    let data: any = rows;
    if (this.mode !== "many") data = rows[0] ?? null;
    if (this.head) data = null;
    if (this.operation !== "select" && !this.returning) data = null;
    return { data, error: null, count: this.wantsCount || this.head ? count : null };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    this.promise ??= this.execute();
    return this.promise.then(onfulfilled, onrejected);
  }
}

export const demoSupabase = {
  from(table: string) {
    return new DemoQuery(table);
  },
  async rpc(name: string) {
    return { data: name === "consume_reminder_credit" ? "plan" : null, error: null };
  },
  auth: {
    admin: {
      async listUsers() {
        return { data: { users: structuredClone(users) }, error: null };
      },
      async getUserById(id: string) {
        return {
          data: { user: structuredClone(users.find((user) => user.id === id) ?? null) },
          error: null,
        };
      },
      async deleteUser(id: string) {
        const index = users.findIndex((user) => user.id === id);
        if (index >= 0) users.splice(index, 1);
        for (const rows of Object.values(tables)) {
          for (let row = rows.length - 1; row >= 0; row--) {
            if (rows[row].owner_id === id || rows[row].user_id === id) rows.splice(row, 1);
          }
        }
        return { data: {}, error: null };
      },
    },
  },
};

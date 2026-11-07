import { describe, expect, it } from "vitest";
import { DEMO_ADMIN_ID, demoSupabase } from "./supabase.server";

describe("Figma demo Supabase adapter", () => {
  it("filters, orders and expands appointment relations", async () => {
    const { data, error } = await demoSupabase
      .from("appointments")
      .select("*, patient:patients(first_name, last_name)")
      .eq("owner_id", DEMO_ADMIN_ID)
      .eq("status", "active")
      .order("start_at");

    expect(error).toBeNull();
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].patient.first_name).toBeTruthy();
  });

  it("persists inserts, updates and deletes for the session", async () => {
    const id = crypto.randomUUID();
    const inserted = await demoSupabase
      .from("locations")
      .insert({
        id,
        owner_id: DEMO_ADMIN_ID,
        name: "Sede temporal",
        city: "Mendoza",
        address: "Dirección demo",
      })
      .select()
      .single();
    expect(inserted.data.name).toBe("Sede temporal");

    const updated = await demoSupabase
      .from("locations")
      .update({ name: "Sede actualizada" })
      .eq("id", id)
      .select()
      .single();
    expect(updated.data.name).toBe("Sede actualizada");

    await demoSupabase.from("locations").delete().eq("id", id);
    const removed = await demoSupabase.from("locations").select().eq("id", id).maybeSingle();
    expect(removed.data).toBeNull();
  });

  it("supports exact counts and administrative users", async () => {
    const count = await demoSupabase
      .from("patients")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", DEMO_ADMIN_ID);
    const page = await demoSupabase.auth.admin.listUsers();

    expect(count.count).toBeGreaterThan(0);
    expect(page.data.users.some((user) => user.id === DEMO_ADMIN_ID)).toBe(true);
  });
});

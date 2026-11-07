import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Public: confirms an appointment from the reminder link. No auth needed. */
export const confirmAppointmentByToken = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ token: z.string().trim().min(1).max(64) }).parse(data))
  .handler(async ({ data }) => {
    const { confirmByToken } = await import("@/server/confirm.server");
    return confirmByToken(data.token);
  });

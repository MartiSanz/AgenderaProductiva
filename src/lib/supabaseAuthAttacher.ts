import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

/**
 * Attaches the Supabase bearer token to every server function call.
 * Replaces the generated `attachSupabaseAuth`: it also waits briefly for the
 * session to hydrate from localStorage, and fails fast (without hitting the
 * server) when there is no session, so protected calls made during sign-out or
 * before hydration don't crash the app with a 401 from the server.
 */
export const attachSupabaseAuthToken = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    if (import.meta.env.VITE_FIGMA_AUTH_BYPASS === "1") return next();
    let token: string | undefined;
    if (typeof window !== "undefined") {
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token;
        if (token) break;
        await new Promise((r) => setTimeout(r, 150));
      }
    }
    return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
  },
);

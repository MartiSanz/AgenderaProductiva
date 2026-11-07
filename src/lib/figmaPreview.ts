import type { User } from "@supabase/supabase-js";

export const isFigmaPreview = import.meta.env.VITE_FIGMA_AUTH_BYPASS === "1";

export const figmaPreviewUser = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "preview@figma.local",
  user_metadata: {
    full_name: "Vista previa",
    name: "Vista previa",
  },
  app_metadata: {},
  created_at: new Date(0).toISOString(),
} satisfies User;

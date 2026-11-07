-- 1. Desactivar la purga automática de 7 días
DO $$
DECLARE j record;
BEGIN
  FOR j IN SELECT jobid FROM cron.job WHERE command ILIKE '%purge_old_appointments%' LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DROP FUNCTION IF EXISTS public.purge_old_appointments();

-- 2. Configuración de retención
ALTER TABLE public.professional_config
  ADD COLUMN IF NOT EXISTS retention_years smallint NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS purge_reminder_snoozed_until date;

-- 3. Resumen histórico por paciente
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS history_summary jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 4. Registro de depuraciones
CREATE TABLE IF NOT EXISTS public.purge_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  executed_at timestamptz NOT NULL DEFAULT now(),
  deleted_count integer NOT NULL DEFAULT 0,
  range_from date,
  range_to date,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.purge_log TO authenticated;
GRANT ALL ON public.purge_log TO service_role;

ALTER TABLE public.purge_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_purge_log" ON public.purge_log
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
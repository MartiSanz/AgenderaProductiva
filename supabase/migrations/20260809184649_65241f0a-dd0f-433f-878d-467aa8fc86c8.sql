ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS needs_invoice boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invoice_issued boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invoice_issued_at timestamp with time zone;
DO $$
DECLARE cmd text;
BEGIN
  SELECT replace(command, '/hooks/whatsapp-reminders', '/hooks/payment-reminders') INTO cmd
  FROM cron.job WHERE jobname = 'whatsapp-reminders-hourly';
  IF cmd IS NOT NULL THEN
    PERFORM cron.schedule('payment-reminders-daily', '0 12 * * *', cmd);
  END IF;
END $$;
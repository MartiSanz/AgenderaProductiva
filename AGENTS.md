<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep authenticated navigation in a fixed icon-only bottom bar with accessible labels and reserved content space, so navigation stays reachable without covering page content.
- Render upcoming appointments as an alternative agenda view using the existing visible-range data, so switching views does not duplicate queries or appointment actions.
- Scope new-appointment mobile layout to its own dialog class, and derive its expandable slot list from existing availability with a context key, so other dialogs and booking rules remain unchanged.
- Derive the care location shown in a booking summary or an appointment detail only from the weekly schedule bands of the chosen weekday that cover the time, falling back to the only registered location and then to the profile address, and show nothing when it cannot be resolved — a band of another weekday never decides the location, so the app never guesses between locations.
- Account history (`account_events`), payments (`account_payments`) and reminder attempts (`reminder_attempts`) are append-only, written only by server code with the admin client and readable only by admins; never backfill history, so the panel shows only real events.
- Admin connection status is reported as working only with evidence (a successful send or a sync in the last 24h); saved credentials alone show "Estado no verificado".
- WhatsApp uses one shared number saved by an admin account (getSharedAccount); all sends use it and incoming messages are ignored, so professionals never manage their own connection.
- Billing rules (cutoff, reminder days, status) live in `src/lib/billing.ts` with tests; payment reminders are sent by the daily `payment-reminders` cron, deduplicated via `account_events.dedupe_key`, and accounts are never suspended automatically.
- Scheduled hooks under /api/public/hooks authenticate with the x-cron-secret header checked against internal_settings.cron_secret (service-role only), never the publishable key, because that key is public.
- Admin web push is payload-less VAPID via WebCrypto (src/server/webPush.server.ts), keys auto-generated in internal_settings, because Workers lack Node web-push libs.
- Dated workdays (schedule_date_blocks) are merged into the schedule as bands with start_date/end_date; bandsForDay in src/lib/domain/dateBlocks.ts makes them replace weekly bands on covered days, so availability and location lookup share one rule.
- When a booking has a chosen location (portal "sede" step, Nuevo turno chips), availability keeps only that location's bands of the day after bandsForDay; offered locations come from bookableLocations so empty cities are never shown.

- Dated workday rows carry an optional day_of_week; inside a jornada's range only bands for that weekday apply and uncovered weekdays are closed, so each jornada defines its own per-weekday hours.
- Finance module: calculations live only in src/lib/finance.ts (tested); income comes from account_payments and paid packs, never a separate ledger; only manual investments/expenses are stored in finance_entries (soft delete + finance_audit), because one source of truth keeps cards, charts and CSV consistent.

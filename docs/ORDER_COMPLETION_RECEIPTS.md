# Customer order completion receipts

When a rider confirms an order as `delivered`, a database trigger inserts one durable receipt job per order. The queue is unique by order ID, so later updates cannot create duplicate jobs.

The rider's delivery action immediately calls the receipt worker after the delivery RPC succeeds. The worker sends email and SMS independently; one channel can fail without blocking the other. Each channel has its own status, attempt count, and sent timestamp. Failed channels are retried up to five attempts. Missing customer contact details are recorded as skipped.

## Required Vercel environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; never expose with a `NEXT_PUBLIC_` prefix)
- `TEXTBEE_API_KEY` (existing SUGOMATE Textbee gateway key)
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` (must use a sender/domain verified in Resend)
- `CRON_SECRET` (long random secret shared only with the worker)

Set these for the Production environment in Vercel before enabling receipts. The Textbee integration uses the same endpoint and authentication header as SUGOMATE phone OTP delivery.

## Retry schedule

The Vercel Cron entry is a daily fallback for jobs that could not be delivered during the immediate rider completion request. Vercel Hobby supports daily schedules; sub-daily schedules require a plan that supports them. The receipt endpoint remains safe to invoke more frequently because it atomically claims jobs and processes email/SMS independently.

## Deployment and verification

1. Merge the feature PR so Vercel deploys the production route and Supabase migration file.
2. Apply migration `20261109200000_order_completion_email_sms_receipts.sql` to the SUGOMATE Supabase project.
3. Add the required Vercel environment variables and redeploy production.
4. Place a test order using a customer account with a registered email and Philippine mobile number.
5. Complete the order from the assigned rider account, including the required delivery proof.
6. Confirm one row appears in `public.order_completion_receipts`, with both channel statuses set to `sent` and timestamps populated.
7. Confirm a second update to the already-delivered order does not create another queue row.

The email sender must be verified in Resend before email delivery can succeed. SMS delivery requires the configured Textbee gateway.

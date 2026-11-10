# SUGOMATE Workflow — Web Platform

> Living project guide. Update this document whenever architecture, business rules, workflows, database schema, integrations, deployment procedures, or known production behavior changes.
>
> Last verified: 10 November 2026  
> Repository: `rijelmayor/sugomate-web`  
> Production domain: `https://sugomate.com`

## 1. Project overview

SUGOMATE is a local-commerce, merchant operations, and delivery platform for customers, merchants, riders/delivery partners, and administrators. The web application is the main operational platform and public website. The Android application is a separate Expo client that shares the same Supabase backend.

Brand: **SUGOMATE — Imong sugo, Kami Bahala.**

## 2. Technology and infrastructure

- **Web framework:** Next.js 15 (App Router), React 19, TypeScript.
- **Styling/UI:** Tailwind CSS v4, responsive web interfaces.
- **Backend/data:** Supabase Auth, PostgreSQL, Row Level Security (RLS), Storage, Realtime, and narrowly scoped PostgreSQL RPC functions.
- **Hosting/deployment:** Vercel; GitHub `main` is the production source branch.
- **Email:** Existing Namecheap Private Email SMTP mailbox, configured in Supabase Auth and reused by the server-side order receipt worker.
- **SMS:** Existing Textbee gateway, also used for registration phone OTP.
- **Mobile app:** `/mobile` in this same repository; see [Sugomate Worklow Android.md](./Sugomate%20Worklow%20Android.md).

Supabase project reference: `wjfbdcaojfwhotrmihfk`.

### Security boundaries

- Browser code uses only the Supabase publishable/anonymous client key.
- `SUPABASE_SERVICE_ROLE_KEY`, `TEXTBEE_API_KEY`, SMTP credentials, and `CRON_SECRET` are server-only. Never use a `NEXT_PUBLIC_` prefix for secrets.
- RLS defines which customer, merchant, driver, and admin records can be read or changed.
- State-changing business operations should use validated server actions and/or narrowly scoped PostgreSQL RPCs. Do not bypass the RPC and RLS rules with direct client-side status updates.
- Private documents and delivery proofs belong in private Supabase Storage buckets with authorized access or signed URLs.

## 3. Main web workspaces

| Workspace | Main route | Purpose |
|---|---|---|
| Public site | `/` | Public landing page and entry point |
| Authentication | `/login`, `/register`, `/verify-phone` | Account access, email confirmation and phone verification |
| Customer | `/customer`, `/customer/orders`, `/customer/addresses` | Marketplace, basket, checkout, addresses, order history and tracking |
| Merchant | `/merchant`, `/merchant/products`, `/merchant/storefront`, `/merchant/financials` | Store operations, product catalogue, incoming orders, payment verification and merchant financials |
| Driver/rider | `/driver`, `/driver/apply`, `/driver/earnings` | Availability, assignments, pickup/delivery, proof, service requests and earnings |
| Admin | `/admin`, `/admin/command-center`, `/admin/dispatch` | Operations oversight, dispatch, merchant/rider management, localities, service requests and financial management |
| Special services | `/papalit`, `/pasugo` | Customer service-request workflows |

Use the current source tree as the final authority for route names and available functionality.

## 4. Account registration and access

1. A user registers with email, password, display name and Philippine mobile number.
2. Supabase Auth `signUp()` sends the account-confirmation email using the configured SUGOMATE SMTP sender: `SUGOMATE <noreply@sugomate.com>`.
3. The web registration flow sends a six-digit phone OTP through the server-side Textbee integration.
4. OTP expires after five minutes, permits five attempts, and can be resent after 60 seconds (per the phone-verification implementation).
5. Email confirmation and mobile verification are separate checks. Both must be satisfied before protected access.
6. Merchant and driver applications are associated with the verified account and are subject to administrator review/approval.

Never send OTPs directly from browser code or expose the Textbee key.

## 5. Customer order workflow

1. Customer browses active products from approved merchants and active branches.
2. Customer selects products and quantities. Checkout is constrained to one merchant/branch per order.
3. Customer selects or enters a delivery address in a serviceable municipality/zone.
4. Server-side `place_customer_order` validates ownership, branch/merchant status, product availability/stock, serviceability, delivery fee and requested payment method.
5. Customer follows the order timeline in the customer workspace.

Order states used by the application include:

`pending_merchant → accepted → preparing → ready_for_pickup → assigned → picked_up → in_transit → delivered`

Terminal/exception states include `rejected` and `cancelled`. The exact allowed transitions are enforced by database RPCs and must not be inferred from UI labels alone.

## 6. Merchant order and payment workflow

- New orders appear in the merchant's new/incoming queue.
- Merchant acceptance is an explicit business action. Payment verification does **not** mean the order has been accepted.
- For GCash, the customer uploads the payment reference/proof and the merchant verifies the payment against the merchant's actual GCash wallet before preparing the order.
- After GCash is confirmed, the order must remain in the new queue until the merchant explicitly accepts it. Do not automatically move it to preparing or treat payment confirmation as acceptance.
- The customer's GCash payment covers the order total, including the delivery fee. The merchant is responsible for reimbursing the rider for the delivery fee under the agreed GCash flow.
- For COD, the rider must have the financial capacity to settle the merchant's subtotal less the delivery fee, according to the agreed rider/merchant settlement rule.
- Merchant status progression is controlled by the merchant order workflow and database RPCs: accept/reject, prepare, ready for pickup. Cancellation and rider-release/reassignment actions have their own guarded flows.

Any change to payment handling must preserve the distinction between payment status and order status.

## 7. Rider / delivery workflow

1. Driver must have an approved/active driver profile and must be online to participate in dispatch.
2. Admin dispatches eligible ready-for-pickup orders to approved online drivers, or the supported claim/assignment workflow offers the order.
3. Driver accepts or declines an assignment. Declined/unaccepted assignments return to the appropriate dispatch handling flow.
4. Driver confirms pickup, then transit/on-the-way, then delivery.
5. Delivery requires a valid photo proof (JPG/PNG/WEBP, maximum 5 MB) uploaded to the private `delivery-proofs` bucket.
6. Driver status changes are performed through `driver_update_order_status` and related RPCs. Do not bypass proof and ownership checks.
7. Driver availability, claim/release, emergency reporting, service requests and earnings/payout requests are separate controlled operations.

## 8. Service requests

SUGOMATE includes customer-facing `Papalit` and `Pasugo` service-request experiences and rider-side acceptance/progress actions. Driver service-request transitions use dedicated RPCs, including purchase amount/payment information where required. Do not mix these requests with standard merchant order state transitions.

## 9. Completion email and SMS receipts — production verified

A customer receipt is triggered only after the rider successfully completes the order and the order transitions to `delivered`. It is not triggered by merchant acceptance, GCash confirmation, preparation, pickup or transit.

- PostgreSQL trigger inserts one durable job in `public.order_completion_receipts` on the delivered transition.
- A unique constraint on `order_id` prevents duplicate queue records.
- The rider server action invokes `/api/cron/order-completion-receipts` after the delivery RPC succeeds.
- The worker claims queued work atomically and sends email and SMS independently.
- Each channel has separate status, attempts and sent timestamp. Failed channels can retry (up to five attempts); one channel's failure does not block the other.
- Email uses existing SMTP: `mail.privateemail.com`, port `587`, sender `SUGOMATE <noreply@sugomate.com>`.
- SMS uses the existing Textbee gateway and server-side `TEXTBEE_API_KEY`.
- `CRON_SECRET` protects the worker endpoint. Vercel Cron is a daily fallback; immediate dispatch is attempted after rider delivery.

**Live production test passed on 10 November 2026.** Order `SG-7CEC43DCE0` was recorded as `delivered`; database status showed `email_status=sent`, `sms_status=sent`, one attempt for each channel, and one receipt record. The customer screenshots confirmed the branded email and SMS. This is a completed first live test, not a guarantee that all future deliveries/providers will never fail.

Reference: [ORDER_COMPLETION_RECEIPTS.md](./ORDER_COMPLETION_RECEIPTS.md).

## 10. Admin and financial operations

Admin routes include command center, dispatch, driver/merchant management, locality/service-zone configuration, service requests and financial management. Merchant financials and driver earnings/payout requests are separate role-specific areas.

Financial balances, commissions, settlement and payout figures are sensitive business logic. Preserve existing formulas unless a concrete defect is identified and validated against database records. Before changing a financial calculation:
1. Identify the authoritative table/RPC and current formula.
2. Trace all state transitions that write to it.
3. Compare a known transaction against expected ledger/cash movement.
4. Add a migration/test and document the formula change.
5. Do not substitute UI-only arithmetic for server-side ledger logic.

## 11. Database and migrations

- Schema changes live in `supabase/migrations/`.
- Migration filenames are timestamp-prefixed and descriptive.
- Apply each migration to the intended Supabase project in order, and verify the resulting table, function, trigger, policy or bucket.
- Do not assume a migration was applied merely because its file exists in Git.
- Do not edit an already-applied migration as a way to change production schema; create a new corrective migration.
- Check RLS and grants for every new table/function. Service-role access must remain server-only.
- Keep SQL changes idempotent where practical and document any manual backfill.

Notable feature migration groups include marketplace/catalogue, order engine/stock reservation, admin control, Textbee phone verification, driver dispatch/delivery proof, GCash manual verification, service requests, rider financial management and order-completion receipts. The migration directory is the definitive chronological record.

## 12. Environment configuration

Web environment values are managed in Vercel and local `.env.local` (never commit local secrets).

Common server/client configuration:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` — server only
- `TEXTBEE_API_KEY` — server only
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`
- `CRON_SECRET` — server only

Production currently uses the SUGOMATE Private Email mailbox. Never copy credential values into documentation, commits, screenshots or chat. Store SMTP username/password and other credentials as Vercel Secrets/Sensitive values. Do not add a second email provider without an explicit product decision.

## 13. Development, PR and deployment workflow

Repository: `https://github.com/rijelmayor/sugomate-web`

Recommended change cycle:

1. Start from the latest `main`; inspect existing code, migrations and relevant docs before editing.
2. Confirm the business rule and identify whether the change belongs in UI, server action, RPC, migration, or an external integration.
3. Create a focused feature/fix/docs branch. Avoid unrelated refactors in the same PR.
4. Implement server-side validation, authorization, RLS/RPC changes and tests as appropriate.
5. Run:
   ```bash
   npm install
   npm run lint
   npm run build
   ```
6. Review Vercel Preview deployment and build logs. Check database migration requirements separately.
7. Open a PR to `main`; describe behavior changed, migrations, environment variables, test evidence and rollback considerations.
8. Do not merge until the preview is green and required migration/configuration steps are understood.
9. After merge, verify Production deployment and apply/verify any required Supabase migration.
10. Test the real workflow using a controlled test account/order. Confirm database state as well as visible UI.

Vercel deploys from GitHub. A successful preview build is not proof that a Supabase migration or external provider configuration is complete.

## 14. Current known constraints and regression checks

- Keep payment confirmation separate from merchant acceptance.
- Re-test GCash wallet verification, delivery-fee reimbursement responsibility and COD rider settlement whenever payment/checkout logic changes.
- Re-test merchant acceptance latency and stale/long-lived browser session behavior after changes to order actions, authentication or client refresh logic. These have been reported as operational pain points; verify current behavior rather than assuming a previous patch fixed them.
- Use Philippine time (`Asia/Manila`) for customer-facing order/delivery timestamps and delivery-time calculations where the business rule is local time.
- Do not change the customer order status merely because payment has been confirmed.
- Do not change rider earnings or financial calculations as a side effect of notification/receipt work.
- Preserve the existing in-app notification/order alert behavior when adding email/SMS/push channels.

## 15. Living-document update policy

Update this file in the same PR (or a tightly coupled documentation PR) whenever any of the following changes:
- routes, roles, permissions or actor workflows;
- order/payment/rider lifecycle or financial business rules;
- Supabase schema, RPCs, RLS policies, triggers, buckets or migrations;
- email/SMS/push providers, environment variables or retry behavior;
- Vercel, Supabase or production deployment/build procedure;
- supported Android/web scope or cross-platform responsibilities;
- known defects, operational workarounds, release state or verified test results.

For every update:
1. State what changed and when.
2. Distinguish **implemented**, **planned**, **reported issue**, and **verified in production**.
3. Record the PR/migration or source file that introduced the change when known.
4. Never include secrets, personal customer data, OTPs or real payment credentials.
5. Remove stale instructions rather than layering contradictory old guidance.
6. Keep the companion Android guide consistent when a shared backend or cross-platform rule changes.

## 16. Useful source files

- `src/app/customer/actions.ts` — customer address/order actions and `place_customer_order` RPC call.
- `src/app/merchant/actions.ts` — merchant order status and rider-release actions.
- `src/app/driver/actions.ts` — driver operations, delivery proof and completion receipt dispatch.
- `src/app/api/mobile/registration/` — server-side phone OTP endpoints.
- `src/app/api/cron/order-completion-receipts/route.ts` — email/SMS receipt worker.
- `src/lib/supabase/` — server/browser Supabase clients.
- `supabase/migrations/` — schema, policies, RPCs and triggers.
- `mobile/` — Expo Android client and EAS configuration.

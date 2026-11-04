# SUGOMATE Security Audit

**Audit date:** 2026-11-04 (Asia/Manila)  
**Repository:** `rijelmayor/sugomate-web`  
**Audit baseline:** latest `main` branch available during this review  
**Supabase project:** `wjfbdcaojfwhotrmihfk`  
**Scope:** Read-only review of repository configuration and selected application files, Supabase Security Advisor, public-schema RLS state and policies, exposed function definitions/privileges, and Storage bucket configuration.

> This is an initial technical review, not a penetration test or a certification. No production code, database policy, secret, account, or deployment was changed during this audit. Findings are based on the observed configuration at the audit time and must be rechecked after changes.

## Executive summary

**Overall status: NOT READY to declare production-secure.**

The database has several good foundations: all inspected tables in the `public` schema have RLS enabled; sensitive admin RPCs perform explicit role checks; delivery proof storage is private; and the reviewed application Supabase clients use the publishable key.

However, this review identified two high-priority authorization weaknesses in row-level policies that can undermine account verification and merchant approval. These should be fixed before public launch.

## Findings

### SEC-001 — Users can update protected profile fields on their own profile

- **Severity:** HIGH
- **Status:** Confirmed from live policy definition; remediation required.
- **Evidence:** `public.profiles_update_self_or_admin` permits an authenticated user to update their own row. The policy's `USING` and `WITH CHECK` expressions constrain the row ID, but do not restrict which columns the user can update.
- **Affected fields:** `status` and `phone_verified_at`, in addition to ordinary profile fields.
- **Impact:** A user may be able to set their own `phone_verified_at` value and bypass the phone-verification gate in `middleware.ts`. They may also alter their profile account status.
- **Recommended remediation:** Replace broad self-update permission with column-level grants or a narrowly scoped server-side profile update operation. Users should only be able to change approved fields such as display name, phone (subject to verification flow), and avatar. Only trusted verification logic should set `phone_verified_at`; only administrators should manage account status.
- **Required tests:** As an ordinary customer, attempt to update `phone_verified_at` and `status` directly through the Data API; both must be rejected. Confirm approved profile edits still work.

### SEC-002 — Merchant owner can potentially approve their own store

- **Severity:** HIGH
- **Status:** Confirmed from live policy definition; remediation required.
- **Evidence:** `public.merchant_owner_profile_update` permits the merchant owner to update their own merchant row. The policy does not limit writable columns.
- **Affected fields:** `status` and `reviewed_by` are present on `public.merchants`.
- **Impact:** A merchant owner may be able to change a pending store to `approved` without administrator review, defeating the intended approval workflow.
- **Recommended remediation:** Restrict merchant owners to editable business-profile fields only. Keep `status`, `reviewed_at`, and `reviewed_by` admin-controlled through the existing admin review function or another server-side authorization path.
- **Required tests:** As a pending merchant owner, attempt to update `status`, `reviewed_by`, and `reviewed_at` directly; all must be rejected. Verify ordinary store-profile edits remain available.

### SEC-003 — Supabase leaked-password protection is disabled

- **Severity:** MEDIUM
- **Status:** Confirmed by Supabase Security Advisor.
- **Evidence:** Advisor finding `auth_leaked_password_protection`.
- **Impact:** Users can choose passwords known to appear in public breach corpuses.
- **Recommended remediation:** Enable leaked-password protection in Supabase Auth settings. Confirm the project's current password policy and test signup/password-change behavior after enabling.
- **Reference:** https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

### SEC-004 — SECURITY DEFINER RPCs are executable by authenticated users

- **Severity:** MEDIUM (requires explicit negative-access tests; not confirmed exploitable from reviewed function bodies)
- **Status:** Advisor warning; function bodies inspected.
- **Affected functions:** `admin_assign_order_to_driver`, `admin_review_driver`, `admin_review_merchant`, `admin_save_service_zone`, `admin_set_municipality_serviceable`, `driver_respond_to_assignment`, `driver_set_availability`, `driver_update_order_status`, `merchant_update_order_status`, and `place_customer_order`.
- **Evidence:** These functions are `SECURITY DEFINER` and have `EXECUTE` granted to `authenticated`. Reviewed admin functions explicitly check `app_private.has_role(auth.uid(), 'admin')`; driver functions verify an active driver profile and order assignment; merchant status updates verify merchant membership and approval; checkout verifies the customer role and address ownership.
- **Impact:** SECURITY DEFINER code runs with the function owner's privileges. A missed or later-regressed authorization check could bypass RLS.
- **Recommended remediation:** Keep only the intended functions executable by authenticated users, use explicit grants, keep fixed/empty search paths, and add database tests for both allowed and denied callers. Revoke execution from `PUBLIC` and `anon` wherever not required. Do not blindly change these functions to SECURITY INVOKER because that may break intended transactional operations.
- **Required tests:** Customer cannot call admin or driver operations; merchant cannot call admin or driver operations; driver cannot act on another driver's order; non-customer cannot place an order.

### SEC-005 — Signup abuse controls not verified

- **Severity:** MEDIUM
- **Status:** Not verified in this review.
- **Evidence:** The reviewed application middleware enforces phone verification for signed-in routes, but repository inspection alone does not establish the current Supabase Auth rate limits, CAPTCHA/bot protection, email/phone OTP send limits, or IP throttling configuration.
- **Impact:** Automated account creation, OTP/SMS abuse, credential stuffing, and service-cost abuse may be possible if platform controls are too permissive.
- **Recommended remediation:** Review and configure Supabase Auth rate limits, CAPTCHA/bot protection where supported, and application-level throttling for OTP send/verify flows. Apply resend cooldowns, expiry, and maximum verification attempts. Test abuse cases without sending real bulk SMS.
- **Required tests:** Repeated signup, repeated OTP send, invalid OTP attempts, expired OTP, and parallel verification attempts are throttled and safely rejected.

### SEC-006 — Webhook signature verification not established

- **Severity:** MEDIUM before payment/provider webhooks are enabled
- **Status:** No webhook handler was found in the reviewed repository paths; payment-provider integration was not established by this review.
- **Evidence:** The reviewed checkout RPC accepts `cod` and `gcash` and marks GCash payment as pending. This review did not establish a provider callback endpoint or a verified signature flow.
- **Impact:** If a future payment webhook trusts request fields without verifying provider authenticity, attackers may forge payment confirmations or replay events.
- **Recommended remediation:** Before connecting a payment provider, verify the provider's signature over the raw request body, validate event/account identifiers, enforce idempotency and replay protection, and update payment state only through a trusted server-side transaction. Never trust a client-submitted “paid” flag.
- **Required tests:** Invalid signature, modified payload, duplicate event, replayed event, wrong merchant/account reference, and mismatched amount/currency must all be rejected.

### SEC-007 — RLS and grants need automated regression tests

- **Severity:** MEDIUM
- **Status:** Partial controls observed; test coverage not established.
- **Evidence:** The database query found no tables in the `public` schema with RLS disabled. Several tables have broad table-level grants to `anon` or `authenticated`; RLS policies remain the row-level enforcement layer. Supabase recommends testing both grants and policies for each exposed table.
- **Impact:** A future permissive policy or table grant can expose data across customers, merchants, branches, or drivers.
- **Recommended remediation:** Add pgTAP tests for SELECT/INSERT/UPDATE/DELETE as anon and as each authenticated role. Test cross-customer, cross-merchant, cross-branch, and cross-driver access. Revoke unused table privileges rather than relying only on policies.
- **Reference:** https://supabase.com/docs/guides/database/postgres/row-level-security

## Positive controls observed

- All inspected `public` tables have RLS enabled; no RLS-disabled public table was returned by the audit query.
- Admin RPCs inspected contain explicit administrator-role checks.
- Driver RPCs inspected require an active driver profile and constrain actions to the driver's assigned order.
- Merchant order-status RPC checks merchant membership and approved merchant status.
- Checkout RPC checks the customer role, address ownership, serviceability, product availability, stock, and single-store/single-branch basket constraints.
- `delivery-proofs` is a private Storage bucket, with a 5 MiB limit and JPEG/PNG/WEBP MIME allowlist.
- `product-images` is public, with a 5 MiB limit and JPEG/PNG/WEBP MIME allowlist. This is appropriate only for non-sensitive product images; never store private documents in this bucket.
- The reviewed browser and server Supabase clients use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; the reviewed `.env.example` contains no secret/service-role key.
- `phone_verification_challenges` has RLS enabled and no policies. This blocks direct client access; confirm that the intended server-side OTP workflow can create, verify, expire, and rate-limit challenges correctly.

## Items not conclusively verified

The following require separate configuration or runtime review and must not be marked PASS based on this report:

- Actual production Vercel environment-variable values and access controls.
- Whether any service-role/secret key exists in deployment settings, build output, logs, or third-party integrations.
- Supabase Auth rate limits, CAPTCHA/bot protection, session lifetime, MFA, and password policy settings beyond the leaked-password advisor finding.
- End-to-end phone OTP persistence and verification. Earlier project checks recorded an empty challenge table; re-test the current flow.
- Any third-party SMS, payment, maps, analytics, or notification webhook secret/signature handling.
- Live cross-tenant attack tests using separate customer, merchant, driver, and admin accounts.
- Backup encryption, restore testing, monitoring, and incident-response readiness.

## Remediation order

1. **SEC-001:** Prevent users from modifying `phone_verified_at` and account `status`.
2. **SEC-002:** Prevent merchant owners from changing approval fields.
3. **SEC-003:** Enable leaked-password protection.
4. **SEC-004 / SEC-007:** Add role-based negative tests for SECURITY DEFINER RPCs, RLS policies, and table grants.
5. **SEC-005:** Review signup, OTP, and bot/rate-limit controls.
6. **SEC-006:** Implement verified, idempotent webhooks before enabling online payment callbacks.
7. Complete runtime secret/configuration review and cross-tenant tests.

## Audit maintenance rule

Update this file in the same change set whenever a code change, migration, RLS policy, RPC, Storage policy, authentication setting, environment-variable contract, or external integration changes security behavior. Record the date, commit/PR, affected controls, test evidence, and any new or closed findings. Re-run Supabase Security Advisor after database migrations and policy changes.

## Official references

- Supabase production security guidance: https://supabase.com/docs/guides/security/product-security
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase API key handling: https://supabase.com/docs/guides/getting-started/api-keys
- Supabase leaked-password protection: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

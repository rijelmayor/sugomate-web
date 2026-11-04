# SUGOMATE Security Audit

**Audit date:** 2026-11-04 (Asia/Manila)  
**Repository:** `rijelmayor/sugomate-web`  
**Audit baseline:** `main` at `898f466bc17abda86cc45223d3ea881da5d1e05c`  
**Supabase project:** `wjfbdcaojfwhotrmihfk`  
**Scope:** Repository configuration and application routes, Supabase Security Advisor, public-schema RLS/policies/grants, selected SECURITY DEFINER function ACLs and search paths, and Storage configuration.

> This is a technical risk review, not a penetration test or security certification. Production security status must not be marked PASS without live negative-access and end-to-end tests.

## Executive summary

**Overall status: NOT YET VERIFIED FOR PRODUCTION.**

All inspected public tables have RLS enabled. Reviewed server/browser clients use the publishable key. Sensitive admin, merchant, driver, and checkout RPCs include role/ownership checks and use an empty function search path. Delivery proof files are stored in a private bucket.

The first audit version described SEC-001 and SEC-002 as directly exploitable HIGH findings based on broad UPDATE policies. A follow-up privilege check found that neither `anon` nor `authenticated` currently has table-level UPDATE privileges on `profiles` or `merchants`; no relevant column UPDATE grants were present either. Therefore, the policy definitions alone do not currently provide a direct Data API update path. The practical exposure is lower than first stated, but the policies are latent hazards if UPDATE grants are added later. The remediation below adds database trigger guards and explicit revokes as defense in depth.

## Findings and remediation status

### SEC-001 — Protected profile fields are not constrained by the self-update policy

- **Severity:** MEDIUM latent risk; no direct authenticated Data API UPDATE grant observed at audit time.
- **Evidence:** `profiles_update_self_or_admin` allows a user to target their own profile row. It does not constrain writable columns. A live privilege check returned `false` for authenticated table UPDATE and for UPDATE on `status` and `phone_verified_at`.
- **Protected fields:** `profiles.status`, `profiles.phone_verified_at`.
- **Impact if UPDATE is later granted:** A user could potentially set their own phone verification timestamp or account status.
- **Remediation in this change:** Add a database trigger that rejects changes to these fields unless the caller is an administrator or uses the trusted Supabase service-role path. Explicitly revoke table and protected-column UPDATE from `PUBLIC`, `anon`, and `authenticated`.
- **Verification required after migration:** Confirm grants remain absent; ordinary profile-field edits (if later introduced) do not permit protected-field changes; service-role phone verification and admin status changes still work.

### SEC-002 — Merchant owner update policy is broader than approval workflow

- **Severity:** MEDIUM latent risk; no direct authenticated Data API UPDATE grant observed at audit time.
- **Evidence:** `merchant_owner_profile_update` permits owner-row updates without restricting columns. A live privilege check returned `false` for authenticated table UPDATE and for `merchants.status`.
- **Protected fields:** `merchants.owner_id`, `status`, `reviewed_at`, `reviewed_by`.
- **Impact if UPDATE is later granted:** A merchant owner could potentially transfer ownership or self-approve a pending store.
- **Remediation in this change:** Add a trigger that rejects changes to ownership and approval metadata unless the caller is an administrator or uses the trusted service-role path. Explicitly revoke table and protected-column UPDATE from `PUBLIC`, `anon`, and `authenticated`.
- **Verification required after migration:** Pending merchant owner cannot alter protected fields; admin review RPC and trusted server workflows still work.

### SEC-003 — Leaked-password protection disabled

- **Severity:** MEDIUM
- **Status:** Confirmed by Supabase Security Advisor; not changed by this repository migration.
- **Impact:** Passwords known to appear in breach corpuses are not blocked by this control.
- **Remediation:** Enable leaked-password protection in Supabase Auth settings and test signup/password change.
- **Reference:** https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

### SEC-004 — SECURITY DEFINER RPCs are executable by authenticated users

- **Severity:** MEDIUM pending negative-access regression tests.
- **Status:** Advisor reports 10 authenticated-callable functions. Follow-up inspection found each function has `search_path = ''` and explicit ACL entries for `authenticated` and `service_role`; no `PUBLIC` or `anon` execute grant appeared in the ACL.
- **Functions:** `admin_assign_order_to_driver`, `admin_review_driver`, `admin_review_merchant`, `admin_save_service_zone`, `admin_set_municipality_serviceable`, `driver_respond_to_assignment`, `driver_set_availability`, `driver_update_order_status`, `merchant_update_order_status`, `place_customer_order`.
- **Assessment:** Authenticated execution is intentional for user-facing RPCs; it is not by itself proof of exploitability. Keep the functions SECURITY DEFINER only where required, preserve empty search paths and in-function authorization, and test every role boundary. Do not blindly switch them to SECURITY INVOKER.
- **Required tests:** Customer cannot invoke admin/driver operations; merchant cannot invoke admin/driver operations; driver cannot act on another driver's order; non-customer cannot place an order.

### SEC-005 — Signup and OTP abuse controls not fully verified

- **Severity:** MEDIUM
- **Status:** Partially implemented; platform rate limits and complete abuse resistance not verified.
- **Evidence:** The application has a five-minute OTP expiry and five-attempt messaging in the verification page, but the full persistence, resend cooldown, concurrency, and provider/platform rate-limit behavior still require live tests.
- **Required tests:** Repeated signup, repeated OTP send, invalid attempts, expired code, resend cooldown, concurrent verification, and SMS provider failure. Do not perform bulk live SMS tests.

### SEC-006 — Payment/provider webhook verification not established

- **Severity:** MEDIUM before online payment callbacks are enabled.
- **Status:** No verified payment webhook handler established by this review.
- **Required controls before enabling callbacks:** Verify provider signature over raw request body, validate provider account/event identifiers, enforce idempotency and replay protection, and update payment state only through a trusted server-side transaction. Never trust a client-submitted paid flag.

### SEC-007 — RLS and tenant-isolation regression tests incomplete

- **Severity:** MEDIUM
- **Status:** All inspected public tables had RLS enabled; comprehensive role/tenant negative-access tests remain outstanding.
- **Required tests:** Anonymous access, customer-to-customer isolation, merchant-to-merchant and branch isolation, driver assignment isolation, admin-only operations, Storage path ownership, and RPC role matrix.

## Positive controls observed

- No public-schema table with RLS disabled was returned by the audit query.
- Admin RPCs inspected contain explicit administrator-role checks.
- Driver RPCs require an active driver profile and constrain actions to the driver's assigned order.
- Merchant order-status RPC checks merchant membership and approved merchant status.
- Checkout RPC checks customer role, address ownership, serviceability, product availability, stock, and single-store/single-branch basket constraints.
- The 10 reviewed SECURITY DEFINER RPCs have an empty search path; inspected ACLs did not show PUBLIC or anon execution.
- `delivery-proofs` is private, with a 5 MiB limit and JPEG/PNG/WEBP MIME allowlist.
- `product-images` is public, with a 5 MiB limit and JPEG/PNG/WEBP MIME allowlist. Only non-sensitive product images belong there.
- Reviewed Supabase clients use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; reviewed `.env.example` contains no secret/service-role key.
- `phone_verification_challenges` has RLS enabled and no policies, blocking direct client access; the server-side OTP workflow still needs end-to-end validation.

## Items not conclusively verified

- The proposed trigger migration has not yet been applied to production; do not mark SEC-001/002 remediated until migration and behavior tests pass.
- Actual production Vercel environment-variable values and access controls.
- Whether any service-role/secret key exists in deployment settings, build output, logs, or third-party integrations.
- Supabase Auth rate limits, CAPTCHA/bot protection, session lifetime, MFA, and leaked-password setting after remediation.
- End-to-end phone OTP persistence and verification. Prior project checks recorded an empty challenge table; re-test the current flow.
- Third-party SMS, payment, maps, analytics, or notification webhook secret/signature handling.
- Live cross-tenant tests using separate customer, merchant, driver, and admin accounts.
- Backup encryption, restore testing, monitoring, and incident-response readiness.

## Remediation order

1. Apply and verify the SEC-001/002 trigger and privilege hardening migration.
2. Enable leaked-password protection in Supabase Auth settings.
3. Add automated negative-access tests for the 10 SECURITY DEFINER RPCs and RLS/tenant boundaries.
4. Verify OTP persistence, resend cooldown, expiry, attempt limits, and platform rate limits.
5. Implement signed, idempotent payment callbacks before enabling online payments.
6. Complete production secret/configuration review, cross-tenant tests, and backup/restore checks.

## SEC-008 — Product image requests exceed the Next.js Server Action body limit

- **Severity:** LOW–MEDIUM availability risk.
- **Evidence:** Production Vercel runtime log for `POST /merchant/products` returned HTTP 413, `Body exceeded 1 MB limit`, digest `3759789597`. The picker previously allowed images up to 5 MiB while Next.js used its default 1 MiB Server Action limit.
- **Remediation in this change:** Set the Server Action request limit to 6 MiB. The image is now compressed in the browser to WebP and limited to 4.5 MiB before form submission; the server retains a 5 MiB hard limit.
- **Residual risk:** Oversized non-image form fields or a future larger upload feature could still approach the 6 MiB request cap. Do not increase this limit without a corresponding abuse and resource review.
- **Verification required:** Vercel preview build, camera replacement of an existing product, new product camera upload, gallery upload, and rejection of oversized/invalid files.

## SEC-009 — Product image uploads were stored in original formats without normalization

- **Severity:** LOW (storage efficiency and consistency).
- **Evidence:** The merchant picker accepted JPG, PNG, and WebP and uploaded the original bytes. High-resolution camera images could consume substantially more storage and bandwidth than necessary.
- **Remediation in this change:** Convert camera/gallery selections to WebP in the browser before upload, downscale the longest edge to at most 1600 px, iteratively reduce quality/dimensions to a maximum 4.5 MiB, and display the before/after size. Server upload accepts only declared WebP with a verified RIFF/WEBP file signature, stores a `.webp` object with `image/webp` content type, and enforces a 5 MiB hard limit.
- **Why WebP, not TIFF:** WebP is suitable for browser-rendered product thumbnails and generally provides better size efficiency; TIFF is typically much larger and is not appropriate for this storefront delivery path.
- **Residual risk:** Browser-side conversion uses client CPU/memory; the source file is capped at 20 MiB. Browser WebP encoding support is required. The product-images bucket is public by design and must contain only public product photos.
- **Verification required:** Confirm camera and gallery images display after save, verify uploaded object MIME/extension and dimensions, verify conversion and size reduction, and confirm invalid/oversized inputs are rejected.

## Iteration maintenance rule

Update this file in the same change set whenever code, migration, RLS policy, RPC, Storage policy, authentication setting, environment-variable contract, or external integration changes security behavior. Each update must record date, PR/commit, affected controls, tests run and results, residual risks, and any new or closed findings. Re-run Supabase Security Advisor after database migrations and policy changes.

## Change log

- **2026-11-05 — Product image storage normalization (SEC-008/SEC-009).** Added browser-side WebP conversion and resizing for merchant camera/gallery uploads, a bounded 6 MiB Server Action request limit, server-side WebP signature validation, and a 5 MiB upload cap. Pending preview and device verification; do not mark closed until tests pass.

- **2026-11-04 — Initial audit and authorization hardening proposal.** Follow-up privilege checks corrected the initial severity assessment for SEC-001/002: the broad policies were present, but direct UPDATE grants were absent. Added proposed trigger-based defense-in-depth and explicit revokes in the migration accompanying this report. Pending CI, migration application, and runtime verification.

## Official references

- Supabase production security guidance: https://supabase.com/docs/guides/security/product-security
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase API key handling: https://supabase.com/docs/guides/getting-started/api-keys
- Supabase leaked-password protection: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

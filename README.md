# SUGOMATE Web

Public website and app-download landing page for SUGOMATE — Imong sugo, kami bahala.

## Stack
- Next.js 15 / React 19 / TypeScript
- Tailwind CSS v4
- Supabase Auth + PostgreSQL
- Vercel hosting

## Authentication setup

Set these variables in local development and Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; never expose to the browser)
- `TEXTBEE_API_KEY` (server-only Textbee dashboard API key)

### Registration and mobile verification
New registrations require a Philippine mobile number in `09XXXXXXXXX` or `+639XXXXXXXXX` format. A six-digit OTP is sent through Textbee, expires in five minutes, allows five attempts, and can be resent after 60 seconds. Existing accounts are grandfathered as verified by the migration. Email confirmation remains independently enabled; complete both checks before protected access. Merchant and driver applications inherit the verified customer account. Newly created admin accounts are subject to the same verification gate.

Apply `supabase/migrations/20261103120000_textbee_phone_verification.sql` to Supabase before deploying.

Set the Supabase Auth Site URL to `https://sugomate.com` and allow `https://sugomate.com/auth/callback` and `http://localhost:3000/auth/callback`. Keep email confirmation enabled in production.

## Development
```bash
npm install
npm run dev
```
Run `npm run lint` and `npm run build` before merging. Never commit `.env.local` or service-role/secret keys.

## SUGOMATE ecosystem implementation

See [docs/ECOSYSTEM_OVERVIEW.md](docs/ECOSYSTEM_OVERVIEW.md) for the approved five-phase scope, actor workflows, order lifecycle, access boundaries, and rollout notes.

The delivery partner operations workflow adds `supabase/migrations/20261104100000_driver_dispatch_delivery_proof.sql`. Apply migrations in timestamp order before verifying driver availability, dispatch assignment, pickup/transit updates, and private delivery proof access.

Cash on delivery is the initial checkout method. Do not enable GCash until a separate payment integration and reconciliation plan is approved.

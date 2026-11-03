# SUGOMATE Web

Public website and app-download landing page for SUGOMATE — Imong sugo, among ihatod.

## Stack
- Next.js 15 / React 19 / TypeScript
- Tailwind CSS v4
- Supabase Auth + PostgreSQL
- Vercel hosting

## Authentication setup

Copy `.env.example` to `.env.local` and set the SUGOMATE Supabase project URL and publishable key. Configure the same variables in Vercel before enabling authentication:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL`

The app uses `@supabase/ssr` with cookie-based sessions and Next.js 15 middleware. It does not use the deprecated `@supabase/auth-helpers-nextjs` package.

### Routes
- `/register` — customer account registration (email confirmation may be required by Supabase Auth settings).
- `/login` — email/password sign-in.
- `/auth/callback` — exchanges the email-confirmation code for a session.
- `/dashboard` — signed-in account page and merchant/driver application forms.

All new accounts receive the `customer` role through the database signup trigger. Merchant and driver applications are stored with pending status. An administrator must review and approve those applications and assign the appropriate application role through a trusted administrative process. Public users cannot grant themselves merchant, driver, or admin roles.

### Supabase Auth dashboard configuration
Set the Supabase Auth Site URL to `https://sugomate.com` and add these allowed redirect URLs:
- `https://sugomate.com/auth/callback`
- `http://localhost:3000/auth/callback`

Keep email confirmation enabled for production. The confirmation email should redirect to the callback URL; use Supabase's PKCE/code flow.

## Development

```bash
npm install
npm run dev
```

Run `npm run lint` and `npm run build` before merging. Do not commit `.env.local` or any service-role/secret key.

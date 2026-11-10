# SUGOMATE Workflow — Android App

> Living project guide. Update this document whenever the native app scope, screens, shared backend contracts, Expo/EAS configuration, build process, permissions, or release behavior changes.
>
> Last verified: 10 November 2026  
> Repository: `rijelmayor/sugomate-web`  
> Android app directory: `mobile/`  
> Companion guide: [Sugomate Workflow Web.md](./Sugomate%20Workflow%20Web.md)

## 1. Project overview and current scope

The SUGOMATE Android app is a native React Native application built with Expo. It lives inside the SUGOMATE web repository under `mobile/` and connects to the same Supabase project as the web platform.

**Current implementation scope:** customer-facing Android experience, including authentication, registration, marketplace browsing, basket/checkout, customer orders and account-related flows, with merchant/driver role application flows. The web application remains the operational platform for merchant, rider/driver and administrator workspaces unless/until those native portals are explicitly implemented.

Do not describe the Android app as a complete native replacement for all web portals. Check `mobile/App.tsx` and the current source tree before expanding this scope statement.

Brand: **SUGOMATE — Imong sugo, Kami Bahala.**

## 2. Technology and app identity

- React Native `0.88.1`
- Expo SDK `~58.0.0`
- TypeScript strict mode, no emit
- Supabase JS `2.118.0`
- Expo SecureStore for persisted Supabase Auth session
- Expo Image Picker and Expo FileSystem for supported image/document workflows
- EAS Build for Android APK/AAB artifacts

Current app configuration (`mobile/app.json`):
- Display name: `SUGOMATE`
- Slug: `sugomate`
- Android package: `com.sugomate.app`
- App version: `1.0.0`
- EAS project ID: `2911cdaa-1c15-4f19-9327-6e8276bf133b`
- Orientation: portrait

Current EAS config (`mobile/eas.json`):
- EAS CLI minimum: `>=16.0.0`
- App version source: remote
- `development`: development client, internal distribution
- `preview`: internal distribution, Android APK
- `production`: auto-increment version, Android App Bundle (AAB)

The Expo owner in `app.json` is currently `cdm-prime`. The user's Expo account/team context has included `sugomate` and `sugomates-team`; verify project ownership and EAS access before changing `owner`, slug or project ID. Do not regenerate or replace the EAS project identity casually.

## 3. Architecture and shared backend

- Main application and navigation/state: `mobile/App.tsx`.
- Registration: `mobile/src/components/RegistrationFlow.tsx`.
- Merchant/driver application UI: `mobile/src/components/RoleApplicationFlow.tsx`.
- Supabase client: `mobile/src/lib/supabase.ts`.
- App assets: `mobile/src/assets/`.
- App config and build profiles: `mobile/app.json`, `mobile/eas.json`.

The mobile Supabase client uses:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

The client uses Expo SecureStore for auth token persistence and refresh. Only publishable client credentials belong in the app bundle. Never include:
- Supabase service-role key;
- Textbee API key;
- SMTP username/password;
- Vercel `CRON_SECRET`;
- any server-side administrative credential.

The app shares the web platform's Supabase database, Auth, Storage, RLS and RPCs. It must not create a separate order database or reimplement trusted financial/order logic locally.

## 4. Registration and authentication workflow

1. User selects customer, merchant-applicant or driver-applicant role in the registration flow.
2. App calls Supabase Auth `signUp()` with email, password and user metadata (display name, phone, intended role).
3. Supabase Auth sends the email-confirmation message through the existing SUGOMATE SMTP configuration. Sender: `SUGOMATE <noreply@sugomate.com>`.
4. App calls the existing web server endpoint `https://sugomate.com/api/mobile/registration/send-otp` to send the phone OTP. Textbee credentials remain on the server.
5. User verifies the six-digit OTP through `https://sugomate.com/api/mobile/registration/verify-otp`.
6. User must also confirm the email address. Phone verification and email confirmation are independent requirements.
7. After authentication, app resolves the signed-in user's role/application metadata and loads the customer experience.

The mobile app must call the trusted server OTP endpoints. Do not implement Textbee sending or OTP validation with a secret embedded in the APK.


## 4A. Android portal expansion plan and current implementation checkpoint

Approved product direction (10 November 2026):
- One installed SUGOMATE Android app with role-aware navigation and dashboards.
- Customer, merchant and driver experiences share the same Supabase project and trusted web/database business rules.
- Merchant implementation priority: order queue, order details, payment verification and accept/prepare/ready transitions.
- Driver implementation priority: availability, incoming assignments/offers, accept/decline and active delivery workflow.
- Admin approval remains required for merchant and driver applicants.

Authentication and customer safe-area foundation (feature branch `feat/android-auth-safe-area-foundation`):
- Sign-in remains a single minimalist screen with email/password and one Create an account entry point.
- Registration now begins with a separate account-type choice screen (Customer, Merchant, Delivery partner); the role choice is no longer mixed into the registration form fields.
- Role-specific account metadata, existing Supabase email confirmation, and existing server-side SMS OTP send/verify endpoints are preserved.
- Customer root safe-area handling now explicitly reserves the Android system navigation inset for the bottom tab bar.
- Customer scroll content receives additional bottom clearance; the floating basket action is offset above the system navigation region.
- Authentication content is scrollable on compact screens and while the keyboard is open.

Validation status: source changes are committed to the feature branch, but local Expo typecheck, Expo Doctor, real-device navigation-bar/keyboard testing, and EAS preview build remain to be completed. Do not describe this checkpoint as device-verified or released until those checks pass.

Next native portal implementation sequence:
1. Merchant order operations: load the authenticated user's approved merchant membership/branches; display new and active orders; open order details; reuse existing web-equivalent RPCs/actions for GCash verification, acceptance, preparation and ready-for-pickup. Never implement a second status transition or payment verifier in the client.
2. Driver assignment operations: resolve approved driver profile; show availability; load only eligible assignments/offers; accept/decline using the existing server-side transition; show active pickup/delivery tasks and proof upload using existing authorization/storage contracts.
3. Add role-aware workspace routing only after role and approval states are resolved from authoritative database records. An applicant's `intended_role` metadata is not proof of approval or portal access.
4. Add merchant/driver financial views only after matching the web source calculations, access controls and RPC contracts. Keep server-calculated balances and earnings authoritative.

Before implementing each portal, inspect its current web page, server actions, SQL/RPC dependencies, RLS policies and migrations. Document the exact contracts and test cases here when verified. Preserve the existing customer flow and run regression checks after every portal increment.

## 5. Customer app workflows

The current customer app includes the following functional areas; check the current code before treating every subfeature as released:

- Sign-in and account session restoration.
- Registration and phone verification.
- Marketplace discovery using active municipalities and active merchant categories.
- Product browsing and search, store/category/municipality filtering.
- Cart/basket quantity management.
- Saved customer addresses and new address entry.
- Delivery fee preview/service-zone-aware checkout.
- COD and GCash payment method selection, with GCash reference/proof submission flow where enabled by the backend.
- Customer order list and status progress tracker.
- Order event/alert presentation.
- Account navigation and sign-out.
- Android hardware Back button unwinds in-app states first (checkout, store, tabs and filters) before allowing the operating system to exit at marketplace root.

### Checkout integrity

The app may collect product IDs, quantities, address, notes and payment selection, but the backend is authoritative:
- Order creation must use the existing `place_customer_order` RPC.
- Server/database validates stock, merchant/branch eligibility, serviceability, delivery fee, address ownership and item prices.
- Do not trust client-submitted prices, totals, fees, merchant identity or stock.
- Keep one merchant/branch per order as enforced by the web/backend contract.
- Preserve RLS so customers can access only their own order and address data.

## 6. Order/payment state behavior shared with web

The mobile app displays the shared order lifecycle; it does not own it.

Typical order lifecycle:

`pending_merchant → accepted → preparing → ready_for_pickup → assigned → picked_up → in_transit → delivered`

Important distinctions:
- GCash payment verification is not merchant acceptance.
- After a merchant confirms a GCash payment, the order remains in the merchant's new queue until the merchant explicitly accepts it.
- Under the agreed GCash flow, the customer pays the total including delivery fee; the merchant reimburses the rider's delivery fee.
- For COD, rider financial capacity for merchant settlement is based on the subtotal less delivery fee, according to the agreed rule.
- Customer order progress should reflect actual backend order status, not payment status alone.

Any UI label or progress tracker change must be checked against the actual RPC transition graph and web behavior.

## 7. Image, file and device behavior

- Use Expo Image Picker for user-selected photos where implemented.
- Validate file type and size before upload; the web delivery proof and product/document workflows use JPG/PNG/WEBP and a 5 MB limit where specified.
- Upload through authorized Supabase Storage paths/policies. Never make private identity documents or delivery proof publicly accessible.
- Request only permissions needed for the feature and keep the permission prompts truthful.
- Keep Android status/navigation bars and safe areas in mind; test on a real device with keyboard open and system navigation visible.
- Hardware Back should close the current in-app layer or navigate to the previous logical screen before defaulting to app exit.

## 8. Build and release workflow (EAS)

Run commands from the repository's `mobile` directory.

### Local setup and checks

Requirements: Node.js 22.13+ and EAS CLI 16 or later.

```bash
cd mobile
npm install
npx expo install --fix
npx expo-doctor
npm run typecheck
npx expo start
```

The app's package scripts include `start`, `android`, `ios`, `web` and `typecheck`.

### Preview APK

```bash
cd mobile
eas build --platform android --profile preview
```

The preview profile is configured for an internal-distribution APK. Use the EAS build page/link/QR to install the generated APK on the Android test device.

### Production AAB

```bash
cd mobile
eas build --platform android --profile production
```

The production profile auto-increments the remote app version and generates an Android App Bundle. Production submission is configured in `eas.json`; publishing still requires the appropriate release/submission decision and store credentials.

### Build decision rules

- JavaScript/TypeScript and UI changes may be eligible for an Expo OTA update only when the project has a compatible Updates configuration and runtime version/channel setup. Verify that configuration before promising an OTA release.
- Native dependency changes, native permissions/plugins, app config changes, package/bundle identity changes, and other native project changes require a new native build.
- A GitHub merge does not automatically rebuild the APK unless a separate EAS workflow is configured. The current documented process is to start an EAS build after the mobile changes are ready.
- A successful Vercel web deployment does not mean the Android APK has been rebuilt.
- Always inspect the EAS build result and test the installed artifact; do not infer success from a build starting or partial download.

## 9. Common troubleshooting

### Expo config cannot resolve a package

From `mobile/`, run `npm install`, then `npx expo install --fix` and `npx expo-doctor`. Check that the dependency exists in `mobile/package.json` and the lockfile is committed.

### Missing Expo module or peer dependency

Install the Expo SDK-compatible version with `npx expo install <package>`, not an arbitrary latest version. Re-run `npx expo-doctor` and typecheck.

### EAS project/slug/owner mismatch

Compare `mobile/app.json` values (slug, owner, `extra.eas.projectId`) with the existing EAS project. Do not create a new project or change project ID to silence a mismatch without checking the established SUGOMATE EAS project.

### APK download stops or fails

Check EAS build status first. If the build succeeded, use the official EAS artifact link from the completed build page; retry download on a stable network/browser. A download stopping partway is not proof that the build failed. Confirm the artifact is a complete APK and install it on the device.

### Runtime/session issue

Check Supabase URL/publishable key, SecureStore persistence, auth-state listener, RLS policies and server RPC responses. Never solve an auth/session problem by exposing service-role credentials to the app.

### Android layout, keyboard or navigation issue

Reproduce on the target Android device, including keyboard-open and system bars visible. Respect safe areas, avoid content behind system bars, and test hardware Back at nested screen states.

## 10. Development workflow and Git discipline

Repository: `https://github.com/rijelmayor/sugomate-web`.

1. Start from current `main) and inspect the existing mobile source before editing.
2. Make mobile changes under `mobile/` unless a shared backend/API/migration change is required.
3. If a mobile feature needs new data or trusted behavior, implement the authoritative backend contract in the web/Supabase layer first, then call it from the app.
4. Keep mobile package dependencies and lockfile synchronized.
5. Run `npm run typecheck`, `npx expo-doctor`, and a local Expo launch. For native-sensitive changes, run an EAS preview build.
6. Use a focused branch and PR. State whether the change requires a Vercel deploy, Supabase migration, EAS APK/AAB build, or more than one.
7. After merge, pull the latest repository state before starting the EAS build. Avoid building from stale or partially merged local files.
8. Install and test the actual APK on Android: login, registration, marketplace, checkout, order refresh, image upload and navigation paths affected by the change.

Useful local path previously used on Windows: `D:\githubrepo\sugomate-web\mobile`.

## 11. Current known boundaries and planned work

- Current native app is customer-first; merchant, driver and admin operations are web workspaces unless native screens are added and documented.
- Role application flows do not mean that full merchant/driver operational portals exist in the Android app.
- Push notification infrastructure, native live GPS tracking, in-app chat and route optimization are not assumed to exist; verify implementation before claiming support.
- Financial balances, COD/GCash settlement, rider earnings and payouts must remain governed by trusted backend logic.
- Do not add secret API keys to Expo public environment variables or app source.
- Do not regenerate the EAS project identity, Android package ID, signing credentials or remote version state without a specific migration plan.

## 12. Living-document update policy

Update this file in the same PR (or a tightly coupled docs PR) whenever any of the following changes:
- native screens, navigation, role coverage or app scope;
- Expo SDK, React Native, dependencies, plugins, permissions or app identity;
- Supabase client/auth/storage/RPC integration;
- checkout, payment, order status, customer notification or file-upload behavior;
- EAS profiles, build credentials, APK/AAB release steps or OTA configuration;
- Android device compatibility, system bars, keyboard or hardware Back behavior;
- a known issue, workaround, build failure or verified release result.

For every update:
1. Add the date and describe what changed.
2. Label information as **implemented**, **planned**, **reported issue**, or **verified on device/build**.
3. Record relevant PR, migration, EAS build or source path when available.
4. Never put secrets, OTPs, customer private data or signing credentials in this file.
5. Keep shared rules consistent with [Sugomate Workflow Web.md](./Sugomate%20Workflow%20Web.md).
6. Remove obsolete instructions when the process changes; do not leave contradictory build commands.

## 13. Key source files

- `mobile/App.tsx` — customer app screens, state, marketplace, cart, checkout, orders and Android Back handling.
- `mobile/src/components/RegistrationFlow.tsx` — Supabase sign-up, email confirmation initiation and server-side phone OTP flow.
- `mobile/src/components/RoleApplicationFlow.tsx` — merchant/driver application UI.
- `mobile/src/lib/supabase.ts` — Supabase client and SecureStore session persistence.
- `mobile/.env.example` — public mobile Supabase configuration names only.
- `mobile/app.json` — Expo identity, Android package, plugins and EAS project ID.
- `mobile/eas.json` — EAS development, preview APK and production AAB profiles.
- `mobile/package.json` — SDK dependencies and scripts.

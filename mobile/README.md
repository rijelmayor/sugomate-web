# SUGOMATE Android app — Phase 1

Native Expo / React Native application for the SUGOMATE customer experience. This app connects to the existing SUGOMATE Supabase project; it does not create a second order database or business-rule implementation.

## Requirements
- Node.js 22.13+
- Expo SDK 58
- EAS CLI for Android builds

## Setup
1. `cd mobile`
2. `npm install`
3. Copy `.env.example` to `.env` and set the Supabase publishable key.
4. `npx expo install --fix`
5. `npx expo-doctor`
6. `npx expo start`

## Android build
- Preview APK: `eas build --platform android --profile preview`
- Production AAB: `eas build --platform android --profile production`

Do not put the Supabase service-role key or Textbee API key in this app. Public mobile registration/phone verification must use the existing trusted SUGOMATE server flow. Customer data access is enforced by Supabase RLS and order creation must use the existing `place_customer_order` RPC.

Phase 1 scope: customer authentication, marketplace discovery, customer order list/status, and account/sign-out foundation. Checkout, saved-address management, GCash receipt upload, live order refresh, and push notification integration are subsequent Phase 1 increments and must reuse existing server/RPC safeguards.

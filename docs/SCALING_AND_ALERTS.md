# Alerts and scaling notes

## Sound and voice alerts (no extra packages)
- **Merchant** (`/merchant`): chime + spoken "New order received" repeating every 7 s until "Confirm order received". Orders list refreshes automatically; a 30 s safety check catches orders missed while the phone slept; tab title flashes.
- **Rider** (`/driver`): loud four-beep alarm + vibration + spoken "New delivery request. Please accept or decline." until the rider accepts/declines or taps "Stop alarm".
- **Customer** (`/customer/orders`): chime + spoken status ("accepted", "being prepared", "rider assigned", "on the way", "delivered", "rejected").
- Each person taps **Enable … alerts** once per device (browser rule); it is remembered and re-armed by the first tap on later visits. The screen is kept awake while sound is on.
- Limit: a web page cannot ring when the phone is locked or the browser is closed. For that, add push notifications in the Google Play / App Store app (Firebase Cloud Messaging).

## Volume checklist
1. Supabase: confirm your plan's Realtime connection/message limits, database compute size and Auth rate limits in the dashboard.
2. Email confirmation: set a custom SMTP provider in Supabase Auth; the built-in sender is for testing only and is heavily rate-limited.
3. SMS OTP (TextBee): sends through a registered Android phone/SIM, so throughput is limited. Plan a proper SMS provider before large signups.
4. Next steps when traffic grows: server-side search + pagination for products (currently first 60), rate limiting on login/register/OTP, error monitoring.

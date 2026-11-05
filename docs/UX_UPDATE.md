# UX update — responsiveness and delivery-app feel

## What changed
- **Basket no longer resets**: saved in the browser (localStorage), survives refresh, filter changes and failed checkouts; cleared after a successful order. Filter chips now use client navigation with a spinner.
- **Filters actually filter**: category and service-area queries use `!inner` joins (verify on your data).
- **Mobile basket**: sticky "View basket · total" bar and slide-up checkout sheet; products show an inline − qty + stepper once added.
- **Delivery fee shown before ordering** (needs the optional migration below).
- **Loading states**: `loading.tsx` skeletons for customer, orders, addresses, merchant, merchant products, driver, admin and dispatch; spinner on every admin/merchant submit button (Approve, Reject, Save zone, Toggle, Create/Save/Assign category, Save branch, Publish, Save changes, Delete); Delete asks for confirmation.
- **Orders page**: progress stepper, live refresh via Supabase Realtime (30s fallback poll), parallel signed-URL loading, collapsible activity log.
- **Speed**: auth + roles lookup shared between layout and page (`src/lib/auth.ts`), products query runs in the same parallel batch, removed the unused order-count query.
- **Polish**: shorter top of the customer page, "Orders" visible on mobile, lucide icons, image skeletons, 36px touch targets, reduced-motion support.

## Deploy
1. Commit the files as usual.
2. Optional: run `supabase/migrations/20261105110000_customer_read_delivery_fees.sql` in the Supabase SQL Editor to show delivery fees in the basket. Without it the basket says "Calculated at checkout".
3. Realtime order updates reuse the `orders` publication from `20261103150104_enable_orders_realtime_for_merchant_alerts.sql` (already in your repo).

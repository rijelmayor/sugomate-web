# SUGOMATE Ecosystem Overview

## Product scope

SUGOMATE is a local-commerce and delivery platform for customers, local businesses, delivery partners, and operations administrators.

The public landing page is the common entry point. Customer, merchant, delivery-partner, and operations workspaces are separate experiences backed by the same Supabase project and role-aware data access.

## Approved implementation phases

### Phase 1 — Platform foundation
- Customer registration, email confirmation, and Philippine mobile-number verification by SMS OTP.
- Merchant and delivery-partner applications attached to a verified account.
- Role-based access and administrator review.
- Municipality serviceability and configured delivery zones / base fees.
- Administrator audit trail.

### Phase 2 — Customer ordering
- Marketplace embedded in the signed-in customer dashboard.
- Browse active products from approved merchants and active branches.
- Category and municipality filtering.
- Cart checkout is constrained to one merchant and one branch per order.
- Saved addresses and new address entry at checkout.
- Server-side validation of customer ownership, serviceability, configured fee, merchant approval, branch activity, product availability, and stock.
- Cash on delivery (COD) is the initial checkout method.
- Order confirmation, order history, status timeline, and delivery proof visibility.

### Phase 3 — Merchant operations
- Merchant application and administrator approval.
- Store branch setup.
- Product catalogue: create, edit, delete, pricing, image URL, availability, and finite or unlimited stock.
- Incoming order alerts and order queue.
- Merchant status progression: pending merchant review, accepted, preparing, ready for pickup.

### Phase 4 — Delivery partner operations
- Delivery-partner application and administrator approval.
- Driver availability (online/offline).
- Administrator dispatch of ready-for-pickup orders to approved online drivers.
- Driver accepts or declines an assignment.
- Driver confirms pickup, starts transit, and completes delivery.
- Delivery completion requires a photo proof uploaded to the private delivery-proofs bucket.
- Customers can view their order activity and signed delivery-proof link.

### Phase 5 — Operations and reporting
- Administrator partner approvals.
- Dispatch queue and live assigned-delivery oversight.
- Municipality serviceability and delivery fee administration.
- Operational reporting for order volume, delivery completion, cancellations/rejections, average order value, and delivered order value.
- Administrative audit trail.

## Order lifecycle

`pending_merchant → accepted → preparing → ready_for_pickup → assigned → picked_up → in_transit → delivered`

- Merchant may reject a new order.
- Administrator assigns only orders that are ready for pickup and have no driver assigned.
- Assignment is offered to an approved, online delivery partner.
- A driver may accept or decline the offer. A declined offer returns the order to the dispatch queue.
- A driver must accept before confirming pickup.
- Delivery completion requires a valid uploaded photo proof.
- COD remains the initial payment method. GCash must not be enabled until a separate payment integration and reconciliation plan is approved.

## Access and data boundaries

- Customers can read only their own orders, addresses, order items, and order history.
- Merchant members can read orders belonging to their approved stores and manage only their own catalogue and order workflow.
- Delivery partners can read only orders currently assigned to them and their associated order items/history.
- Administrators can review the operational data and dispatch orders.
- Delivery proof files are stored in a private bucket. Access is limited to the assigned delivery partner, the customer who owns the delivered order, and administrators.

Business rules that change order state are implemented as narrowly scoped PostgreSQL RPC functions rather than direct client-side updates.

## Current rollout notes

- Apply Supabase migrations in timestamp order, including `20261104100000_driver_dispatch_delivery_proof.sql`, before runtime verification of the new delivery workflow.
- Keep the Textbee API key and Supabase service-role key server-only.
- The application build and preview should be reviewed before merging to `main`.
- End-to-end debugging is intentionally scheduled after the approved ecosystem phases are present.
- This implementation does not include GCash collection, rider payout/remittance accounting, live GPS tracking, route optimization, in-app chat, or push-notification infrastructure. Those require separate product and integration decisions.

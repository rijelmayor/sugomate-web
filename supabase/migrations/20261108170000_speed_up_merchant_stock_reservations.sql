-- Speed up the per-product reserved-stock lookup used by
-- merchant_update_order_status when accepting an order.
-- This is a partial covering index: only active reservations are indexed.
create index if not exists order_stock_reservations_reserved_product_idx
  on public.order_stock_reservations (product_id)
  include (quantity)
  where status = 'reserved';

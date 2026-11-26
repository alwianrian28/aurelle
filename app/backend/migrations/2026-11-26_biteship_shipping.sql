-- Shipping through Biteship: columns on `orders`, and a one-time copy of what older orders kept in their JSON.
-- Safe to run more than once. The backend runs the same statements on every start (app/db.py, SHIPPING_MIGRATION),
-- so running this by hand in Supabase is only needed to have the columns before the next deploy.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS courier_company     TEXT,
  ADD COLUMN IF NOT EXISTS courier_type        TEXT,
  ADD COLUMN IF NOT EXISTS shipping_cost       INTEGER,
  ADD COLUMN IF NOT EXISTS insurance_fee       INTEGER,
  ADD COLUMN IF NOT EXISTS biteship_order_id   TEXT,
  ADD COLUMN IF NOT EXISTS waybill_id          TEXT,
  ADD COLUMN IF NOT EXISTS tracking_id         TEXT,
  ADD COLUMN IF NOT EXISTS tracking_link       TEXT,
  ADD COLUMN IF NOT EXISTS shipping_status     TEXT,
  ADD COLUMN IF NOT EXISTS shipping_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipping_error      TEXT,
  ADD COLUMN IF NOT EXISTS shipping_reference  TEXT;

DROP INDEX IF EXISTS orders_biteship;

CREATE UNIQUE INDEX IF NOT EXISTS orders_biteship_order ON orders (biteship_order_id);

UPDATE orders SET
  courier_company     = COALESCE(courier_company, data::jsonb #>> '{biteship,courier}', data::jsonb #>> '{shippingService,biteship,courier}'),
  courier_type        = COALESCE(courier_type, data::jsonb #>> '{biteship,service}', data::jsonb #>> '{shippingService,biteship,service}'),
  shipping_cost       = COALESCE(shipping_cost, NULLIF(NULLIF(data::jsonb #>> '{biteship,priceIdr}', ''), '0')::INTEGER, (data::jsonb #>> '{costs,shipping}')::INTEGER),
  insurance_fee       = COALESCE(insurance_fee, (data::jsonb #>> '{shippingService,insuranceIdr}')::INTEGER),
  waybill_id          = COALESCE(waybill_id, data::jsonb #>> '{biteship,waybillId}'),
  tracking_id         = COALESCE(tracking_id, data::jsonb #>> '{biteship,trackingId}'),
  tracking_link       = COALESCE(tracking_link, data::jsonb #>> '{biteship,link}'),
  shipping_status     = COALESCE(shipping_status, data::jsonb #>> '{biteship,status}'),
  shipping_updated_at = COALESCE(shipping_updated_at, (data::jsonb #>> '{biteship,syncedAt}')::TIMESTAMPTZ),
  shipping_reference  = COALESCE(shipping_reference, CASE WHEN biteship_order_id IS NOT NULL THEN number END)
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE name = 'biteship_columns_backfilled');

INSERT INTO settings (name, value) VALUES ('biteship_columns_backfilled', '1') ON CONFLICT (name) DO NOTHING;

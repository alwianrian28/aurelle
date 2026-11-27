-- Shipment map: where an area is (geocoded once), the route from the store to it, and the last answer Biteship gave about an order.
-- Only adds three tables; nothing that exists is changed. Safe to run more than once.
-- The backend runs the same statements on every start (app/db.py, SHIPMENT_MAP_MIGRATION).

CREATE TABLE IF NOT EXISTS geo_areas (
  area_key   VARCHAR(300) PRIMARY KEY,
  province   VARCHAR(80)  NOT NULL,
  city       VARCHAR(80)  NOT NULL,
  district   VARCHAR(120),
  lat        DOUBLE PRECISION,
  lng        DOUBLE PRECISION,
  precision  VARCHAR(10),
  checked_at TIMESTAMPTZ  NOT NULL,
  CONSTRAINT geo_areas_point CHECK ((lat IS NULL) = (lng IS NULL) AND (lat IS NULL) = (precision IS NULL)),
  CONSTRAINT geo_areas_precision CHECK (precision IN ('district', 'city'))
);

CREATE TABLE IF NOT EXISTS shipment_routes (
  origin_key  VARCHAR(40)  NOT NULL,
  area_key    VARCHAR(300) NOT NULL,
  kind        VARCHAR(10)  NOT NULL,
  coords      JSONB,
  distance_km DOUBLE PRECISION NOT NULL,
  fetched_at  TIMESTAMPTZ  NOT NULL,
  PRIMARY KEY (origin_key, area_key),
  FOREIGN KEY (area_key) REFERENCES geo_areas(area_key) ON DELETE CASCADE,
  CONSTRAINT shipment_routes_kind CHECK (kind IN ('road', 'straight')),
  CONSTRAINT shipment_routes_coords CHECK ((kind = 'road') = (coords IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS shipment_routes_area ON shipment_routes (area_key);

CREATE TABLE IF NOT EXISTS shipment_tracking_cache (
  order_id    VARCHAR(80) PRIMARY KEY,
  tracking_id TEXT        NOT NULL,
  payload     JSONB       NOT NULL,
  fetched_at  TIMESTAMPTZ NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

ALTER TABLE geo_areas ENABLE ROW LEVEL SECURITY;

ALTER TABLE shipment_routes ENABLE ROW LEVEL SECURITY;

ALTER TABLE shipment_tracking_cache ENABLE ROW LEVEL SECURITY;

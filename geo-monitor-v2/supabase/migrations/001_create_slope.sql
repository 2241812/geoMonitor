-- Enable PostGIS (idempotent)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Slope classification polygons (64 features across 14 watersheds)
CREATE TABLE IF NOT EXISTS slope (
  id BIGSERIAL PRIMARY KEY,
  basin_code TEXT NOT NULL,        -- e.g. AGN, ABR, UCH
  gridcode INTEGER NOT NULL,       -- 1 = 0-8%, 2 = 8-18%, 3 = 18-30%, 4 = 30-50%, 5 = 50%+
  geom geometry(MultiPolygon, 4326) NOT NULL
);

-- Query performance indexes
CREATE INDEX IF NOT EXISTS idx_slope_basin_code ON slope (basin_code);
CREATE INDEX IF NOT EXISTS idx_slope_geom ON slope USING GIST (geom);

-- Allow anonymous read access (used by the public map frontend)
ALTER TABLE slope ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_slope ON slope FOR SELECT USING (true);

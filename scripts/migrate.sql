-- Run this in Supabase Dashboard → SQL Editor → New Query

-- Drop existing tables if any
DROP TABLE IF EXISTS slope CASCADE;
DROP TABLE IF EXISTS lcm CASCADE;

-- Slope table
CREATE TABLE slope (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  basin_code text NOT NULL,
  gridcode integer,
  geom jsonb NOT NULL
);
CREATE INDEX idx_slope_basin ON slope(basin_code);

-- LCM table
CREATE TABLE lcm (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  basin_code text NOT NULL,
  lcm_class text,
  properties jsonb,
  geom jsonb NOT NULL
);
CREATE INDEX idx_lcm_basin ON lcm(basin_code);

-- Performance optimization indexes for PostgreSQL
-- Add these indexes to improve query performance

-- For places table (most frequently queried)
CREATE INDEX IF NOT EXISTS idx_places_coordinates ON places(longitude, latitude);
CREATE INDEX IF NOT EXISTS idx_places_industry ON places(industry);
CREATE INDEX IF NOT EXISTS idx_places_category ON places(category);
CREATE INDEX IF NOT EXISTS idx_places_composite ON places(longitude, latitude, industry, category);

-- For trade_areas table
CREATE INDEX IF NOT EXISTS idx_trade_areas_pid ON trade_areas(pid);
CREATE INDEX IF NOT EXISTS idx_trade_areas_composite ON trade_areas(pid, trade_area);

-- For zipcodes tables
CREATE INDEX IF NOT EXISTS idx_zipcodes_code ON zipcodes(id);
CREATE INDEX IF NOT EXISTS idx_home_zipcodes_pid ON home_zipcodes(pid);
CREATE INDEX IF NOT EXISTS idx_home_zipcodes_zipcode_id ON home_zipcodes(zipcode_id);

-- PostGIS spatial indexes for better geographic queries (if PostGIS is enabled)
-- CREATE INDEX IF NOT EXISTS idx_places_spatial ON places USING GIST(ST_MakePoint(longitude, latitude));

-- JSONB indexes for polygon queries (PostgreSQL specific)
CREATE INDEX IF NOT EXISTS idx_zipcodes_polygon_gin ON zipcodes USING GIN(polygon);
CREATE INDEX IF NOT EXISTS idx_trade_areas_polygon_gin ON trade_areas USING GIN(polygon);

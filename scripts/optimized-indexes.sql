-- CRITICAL PostgreSQL Performance Optimizations for Trade Areas
-- Based on research of PostgreSQL best practices for large JSONB datasets

-- Drop existing inefficient indexes first
DROP INDEX IF EXISTS idx_trade_areas_pid;
DROP INDEX IF EXISTS idx_trade_areas_composite;
DROP INDEX IF EXISTS idx_trade_areas_polygon_gin;

-- 1. COMPOSITE B-TREE INDEX for primary queries (most important)
-- This supports WHERE pid = ? AND trade_area = ? queries efficiently
CREATE INDEX CONCURRENTLY idx_trade_areas_pid_trade_area_btree 
ON trade_areas(pid, trade_area) 
INCLUDE (polygon);

-- 2. SPECIALIZED GIN INDEX for JSONB polygon containment queries  
-- Uses jsonb_path_ops for better performance on large datasets
CREATE INDEX CONCURRENTLY idx_trade_areas_polygon_gin_path_ops 
ON trade_areas USING GIN (polygon jsonb_path_ops);

-- 3. B-TREE INDEX for pagination optimization (cursor-based pagination)
-- This replaces slow LIMIT/OFFSET with cursor-based pagination
CREATE INDEX CONCURRENTLY idx_trade_areas_cursor 
ON trade_areas(pid, trade_area, id);

-- 4. PARTIAL INDEX for most common queries (30, 50, 70 trade areas)
-- This optimizes the most frequent queries significantly
CREATE INDEX CONCURRENTLY idx_trade_areas_common_percentages 
ON trade_areas(pid) 
WHERE trade_area IN (30, 50, 70);

-- 5. EXPRESSION INDEX for polygon type checking (if needed)
-- Helps with polygon validation queries
CREATE INDEX CONCURRENTLY idx_trade_areas_polygon_type 
ON trade_areas((polygon->>'type')) 
WHERE polygon IS NOT NULL;

-- For zipcodes table optimizations
DROP INDEX IF EXISTS idx_zipcodes_polygon_gin;

-- Optimized zipcode polygon index
CREATE INDEX CONCURRENTLY idx_zipcodes_polygon_gin_path_ops 
ON zipcodes USING GIN (polygon jsonb_path_ops);

-- For places table optimizations  
CREATE INDEX CONCURRENTLY idx_places_coordinates_gist 
ON places USING GIST (point(longitude, latitude));

-- Update table statistics to help query planner
ANALYZE trade_areas;
ANALYZE zipcodes;
ANALYZE places;

-- Configure autovacuum for better performance on large tables
ALTER TABLE trade_areas SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05,
  autovacuum_vacuum_cost_limit = 1000
);

ALTER TABLE zipcodes SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05  
);

-- Create statistics for multi-column correlations
CREATE STATISTICS stat_trade_areas_correlation (dependencies) 
ON pid, trade_area FROM trade_areas;

-- Refresh statistics
ANALYZE trade_areas;

-- Show index sizes for monitoring
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE tablename IN ('trade_areas', 'zipcodes', 'places')
ORDER BY pg_relation_size(indexrelid) DESC;

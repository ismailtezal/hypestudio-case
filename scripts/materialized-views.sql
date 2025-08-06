-- Materialized view for ultra-fast trade area queries
-- This pre-computes commonly requested data for instant access

-- Create optimized materialized view for common trade area queries
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_trade_areas_optimized AS
SELECT 
    ta.pid,
    ta.trade_area,
    ta.polygon,
    ta.id,
    p.name as place_name,
    p.longitude as place_longitude,
    p.latitude as place_latitude,
    -- Pre-compute polygon bounding box for faster spatial queries
    (ta.polygon->>'type') as polygon_type,
    -- Add ranking for most requested combinations
    ROW_NUMBER() OVER (PARTITION BY ta.pid ORDER BY ta.trade_area) as area_rank
FROM trade_areas ta
JOIN places p ON ta.pid = p.id
WHERE ta.trade_area IN (30, 50, 70) -- Most commonly requested
ORDER BY ta.pid, ta.trade_area;

-- Create indexes on materialized view
CREATE UNIQUE INDEX idx_mv_trade_areas_pk ON mv_trade_areas_optimized(pid, trade_area);
CREATE INDEX idx_mv_trade_areas_polygon_gin ON mv_trade_areas_optimized USING GIN (polygon jsonb_path_ops);
CREATE INDEX idx_mv_trade_areas_place_coords ON mv_trade_areas_optimized(place_longitude, place_latitude);

-- Function to refresh materialized view efficiently
CREATE OR REPLACE FUNCTION refresh_trade_areas_mv()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_trade_areas_optimized;
    ANALYZE mv_trade_areas_optimized;
END;
$$ LANGUAGE plpgsql;

-- Create scheduled refresh (run this in production)
-- SELECT cron.schedule('refresh-trade-areas-mv', '0 2 * * *', 'SELECT refresh_trade_areas_mv();');

-- Alternative: Create a high-performance aggregate view for dashboard stats
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_trade_areas_stats AS
SELECT 
    COUNT(*) as total_trade_areas,
    COUNT(DISTINCT pid) as total_places,
    COUNT(*) FILTER (WHERE trade_area = 30) as areas_30,
    COUNT(*) FILTER (WHERE trade_area = 50) as areas_50,
    COUNT(*) FILTER (WHERE trade_area = 70) as areas_70,
    AVG(pg_column_size(polygon)) as avg_polygon_size_bytes,
    MIN(pid) as min_pid,
    MAX(pid) as max_pid
FROM trade_areas;

-- Performance monitoring view
CREATE OR REPLACE VIEW v_performance_stats AS
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    CASE 
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_tup_fetch::float / NULLIF(idx_tup_read, 0) < 0.1 THEN 'LOW_SELECTIVITY'
        ELSE 'GOOD'
    END as index_health
FROM pg_stat_user_indexes 
WHERE tablename IN ('trade_areas', 'zipcodes', 'places', 'mv_trade_areas_optimized')
ORDER BY pg_relation_size(indexrelid) DESC;

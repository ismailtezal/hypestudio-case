import { pgPool } from '../lib/db';
import fs from 'fs';
import path from 'path';

async function applyOptimizations() {
  const client = await pgPool.connect();
  
  try {
    console.log('🔧 Starting PostgreSQL optimizations...');
    
    // 1. Apply optimized indexes
    console.log('📊 Creating optimized indexes...');
    const indexesSql = fs.readFileSync(
      path.join(process.cwd(), 'scripts', 'optimized-indexes.sql'), 
      'utf8'
    );
    
    await client.query(indexesSql);
    console.log('✅ Optimized indexes created');
    
    // 2. Apply materialized views
    console.log('📈 Creating materialized views...');
    const mvSql = fs.readFileSync(
      path.join(process.cwd(), 'scripts', 'materialized-views.sql'), 
      'utf8'
    );
    
    await client.query(mvSql);
    console.log('✅ Materialized views created');
    
    // 3. Update PostgreSQL settings for better performance
    console.log('⚡ Applying performance settings...');
    
    await client.query(`
      -- Optimize for JSONB workloads
      SET work_mem = '256MB';
      SET maintenance_work_mem = '1GB';
      SET effective_cache_size = '4GB';
      SET random_page_cost = 1.1;
      SET seq_page_cost = 1.0;
      
      -- Optimize for streaming/large result sets  
      SET tcp_keepalives_idle = 600;
      SET tcp_keepalives_interval = 30;
      SET tcp_keepalives_count = 3;
      
      -- Better statistics for query planning
      SET default_statistics_target = 1000;
      
      -- Optimize checkpoint behavior
      SET checkpoint_completion_target = 0.9;
      SET wal_buffers = '16MB';
    `);
    
    console.log('✅ Performance settings applied');
    
    // 4. Generate performance report
    console.log('📈 Generating performance report...');
    
    const report = await client.query(`
      SELECT 
        'Index Usage' as metric,
        COUNT(*) as total_indexes,
        COUNT(*) FILTER (WHERE idx_scan > 0) as used_indexes,
        ROUND(COUNT(*) FILTER (WHERE idx_scan > 0)::numeric / COUNT(*) * 100, 2) as usage_percentage
      FROM pg_stat_user_indexes 
      WHERE tablename IN ('trade_areas', 'zipcodes', 'places')
      
      UNION ALL
      
      SELECT 
        'Table Size' as metric,
        NULL as total_indexes,
        NULL as used_indexes,
        ROUND(pg_total_relation_size('trade_areas')::numeric / 1024 / 1024, 2) as usage_percentage
      FROM information_schema.tables WHERE table_name = 'trade_areas'
      
      UNION ALL
      
      SELECT 
        'Trade Areas Count' as metric,
        NULL as total_indexes, 
        NULL as used_indexes,
        COUNT(*)::numeric as usage_percentage
      FROM trade_areas;
    `);
    
    console.table(report.rows);
    
    // 5. Test query performance
    console.log('🧪 Testing query performance...');
    
    const startTime = Date.now();
    const testResult = await client.query(`
      SELECT COUNT(*) 
      FROM trade_areas 
      WHERE trade_area IN (30, 50, 70)
      ORDER BY pid LIMIT 100;
    `);
    const queryTime = Date.now() - startTime;
    
    console.log(`✅ Test query completed in ${queryTime}ms`);
    console.log(`📊 Optimizations applied successfully!`);
    
    return {
      success: true,
      queryTime,
      reportData: report.rows,
      message: 'All optimizations applied successfully'
    };
    
  } catch (error) {
    console.error('❌ Error applying optimizations:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Benchmark function to test performance improvements
async function benchmarkPerformance() {
  const client = await pgPool.connect();
  
  try {
    console.log('🏃‍♂️ Running performance benchmarks...');
    
    // Test 1: Large pagination query (old method)
    const start1 = Date.now();
    await client.query(`
      SELECT pid, polygon, trade_area 
      FROM trade_areas 
      ORDER BY pid, trade_area 
      LIMIT 500 OFFSET 2000;
    `);
    const offsetTime = Date.now() - start1;
    
    // Test 2: Cursor-based pagination (new method)
    const start2 = Date.now();
    await client.query(`
      SELECT pid, polygon, trade_area, id
      FROM trade_areas 
      WHERE (pid, trade_area, id) > (50, 30, 1000)
      ORDER BY pid, trade_area, id 
      LIMIT 500;
    `);
    const cursorTime = Date.now() - start2;
    
    // Test 3: JSONB containment query
    const start3 = Date.now();
    await client.query(`
      SELECT COUNT(*) 
      FROM trade_areas 
      WHERE polygon @> '{"type": "Polygon"}';
    `);
    const jsonbTime = Date.now() - start3;
    
    console.log('📊 Benchmark Results:');
    console.log(`   OFFSET pagination: ${offsetTime}ms`);
    console.log(`   Cursor pagination: ${cursorTime}ms`);
    console.log(`   JSONB containment: ${jsonbTime}ms`);
    console.log(`   Performance improvement: ${Math.round((offsetTime - cursorTime) / offsetTime * 100)}%`);
    
    return {
      offsetTime,
      cursorTime,
      jsonbTime,
      improvement: Math.round((offsetTime - cursorTime) / offsetTime * 100)
    };
    
  } finally {
    client.release();
  }
}

// Run optimizations if this file is executed directly
if (require.main === module) {
  applyOptimizations()
    .then(result => {
      console.log('🎉 Optimization completed:', result);
      return benchmarkPerformance();
    })
    .then(benchmarkResult => {
      console.log('🏁 Benchmark completed:', benchmarkResult);
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Optimization failed:', error);
      process.exit(1);
    });
}

export { applyOptimizations, benchmarkPerformance };

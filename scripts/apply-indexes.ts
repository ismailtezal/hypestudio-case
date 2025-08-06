import { db } from '../lib/db';

async function applyIndexes() {
  console.log('🚀 Applying database indexes for Turso cloud database...');

  const indexes = [
    // Places table indexes for better performance
    'CREATE INDEX IF NOT EXISTS idx_places_coordinates ON places(longitude, latitude)',
    'CREATE INDEX IF NOT EXISTS idx_places_industry ON places(industry)',
    'CREATE INDEX IF NOT EXISTS idx_places_category ON places(category)',
    'CREATE INDEX IF NOT EXISTS idx_places_composite ON places(longitude, latitude, industry, category)',
    
    // Trade areas indexes
    'CREATE INDEX IF NOT EXISTS idx_trade_areas_pid ON trade_areas(pid)',
    'CREATE INDEX IF NOT EXISTS idx_trade_areas_composite ON trade_areas(pid, trade_area)',
    
    // Zipcodes indexes (corrected column names for Turso)
    'CREATE INDEX IF NOT EXISTS idx_zipcodes_id ON zipcodes(id)',
    'CREATE INDEX IF NOT EXISTS idx_home_zipcodes_pid ON home_zipcodes(pid)',
    'CREATE INDEX IF NOT EXISTS idx_home_zipcodes_zipcode ON home_zipcodes(zipcode_id)',
    
    // Spatial index for geographic queries (Turso compatible)
    'CREATE INDEX IF NOT EXISTS idx_places_valid_coords ON places(longitude, latitude) WHERE longitude IS NOT NULL AND latitude IS NOT NULL',
  ];

  try {
    console.log('📊 Connecting to Turso database...');
    
    for (const [index, sql] of indexes.entries()) {
      console.log(`📊 Applying index ${index + 1}/${indexes.length}: ${sql.split(' ')[2]}`);
      await db.execute(sql);
      console.log(`✅ Index ${index + 1} applied successfully`);
    }
    
    console.log('✅ All database indexes applied successfully!');
    console.log('🎯 Turso database performance optimizations complete.');
    console.log('🚀 Your cloud database is now optimized for production!');
  } catch (error) {
    console.error('❌ Error applying indexes to Turso database:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  applyIndexes().then(() => {
    console.log('🎉 Turso database optimization complete!');
    process.exit(0);
  }).catch((error) => {
    console.error('💥 Failed to optimize database:', error);
    process.exit(1);
  });
}

export { applyIndexes };

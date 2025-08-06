// Test script to verify trade areas data format
import { db } from '../lib/db';

async function testTradeAreasData() {
  try {
    console.log('🧪 Testing trade areas data format...');
    
    // Test basic query
    const result = await db.execute('SELECT pid, polygon, trade_area FROM trade_areas LIMIT 5');
    console.log('📊 Sample raw data:', result.rows);
    
    // Test data structure
    if (result.rows.length > 0) {
      const sample = result.rows[0];
      console.log('📋 Sample record structure:');
      console.log('  - pid:', typeof sample.pid, sample.pid);
      console.log('  - trade_area:', typeof sample.trade_area, sample.trade_area);
      console.log('  - polygon type:', typeof sample.polygon);
      
      if (sample.polygon) {
        try {
          const parsed = typeof sample.polygon === 'string' ? JSON.parse(sample.polygon) : sample.polygon;
          console.log('  - polygon.type:', parsed.type);
          console.log('  - polygon.coordinates length:', parsed.coordinates?.length);
        } catch (e) {
          console.error('❌ Failed to parse polygon:', e);
        }
      }
    }
    
    // Test count by trade area
    const countResult = await db.execute(`
      SELECT trade_area, COUNT(*) as count 
      FROM trade_areas 
      GROUP BY trade_area 
      ORDER BY trade_area
    `);
    console.log('📊 Trade areas distribution:', countResult.rows);
    
    // Test streaming format simulation
    console.log('\n🌊 Testing streaming format...');
    const streamResult = await db.execute('SELECT pid, polygon, trade_area FROM trade_areas LIMIT 3');
    
    const streamFormatted = streamResult.rows.map(row => ({
      pid: row.pid,
      trade_area: row.trade_area,
      polygon: row.polygon // Direct format for deck.gl
    }));
    
    console.log('📦 Stream formatted data:', JSON.stringify(streamFormatted, null, 2));
    
    console.log('✅ Trade areas data test completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run test if executed directly
if (require.main === module) {
  testTradeAreasData()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('💥 Test script failed:', error);
      process.exit(1);
    });
}

export { testTradeAreasData };

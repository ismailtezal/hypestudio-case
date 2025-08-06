const { createClient } = require('@libsql/client');

const checkLocalDb = async () => {
  const db = createClient({ url: 'file:local.db' });
  
  try {
    console.log('🔍 Checking local database...');
    
    const tables = await db.execute(`SELECT name FROM sqlite_master WHERE type='table'`);
    console.log('📋 Tables found:', tables.rows.map(r => r.name));
    
    for (const table of tables.rows) {
      const count = await db.execute(`SELECT COUNT(*) as count FROM ${table.name}`);
      console.log(`📊 ${table.name}: ${count.rows[0].count} records`);
    }
    
    // Show sample data from places table if it exists
    if (tables.rows.some(r => r.name === 'places')) {
      const samplePlaces = await db.execute('SELECT * FROM places LIMIT 3');
      console.log('📍 Sample places data:');
      samplePlaces.rows.forEach(place => {
        console.log(`  - ${place.name} (${place.city}, ${place.state}) - Category: ${place.category}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking local database:', error.message);
  } finally {
    await db.close();
  }
};

checkLocalDb();

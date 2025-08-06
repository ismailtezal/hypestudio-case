require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const checkPostgresDb = async () => {
  // Get connection string from environment
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable not set');
    console.log('💡 Create a .env.local file with your PostgreSQL connection string');
    return;
  }

  const pool = new Pool({ connectionString });
  
  try {
    console.log('🔍 Checking PostgreSQL database...');
    
    // Check tables
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    
    const tables = tablesResult.rows.map(r => r.table_name);
    console.log('📋 Tables found:', tables);
    
    // Count records in each table
    for (const table of tables) {
      const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`📊 ${table}: ${countResult.rows[0].count} records`);
    }
    
    // Show sample data from places table if it exists
    if (tables.includes('places')) {
      const samplePlaces = await pool.query('SELECT * FROM places LIMIT 3');
      console.log('📍 Sample places data:');
      samplePlaces.rows.forEach(place => {
        console.log(`  - ${place.name} (${place.city}, ${place.state}) - Category: ${place.category}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking PostgreSQL database:', error.message);
  } finally {
    await pool.end();
  }
};

checkPostgresDb();

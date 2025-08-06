import { createClient } from '@libsql/client';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Create two database connections: one for local, one for cloud
const localDb = createClient({
  url: 'file:local.db'
});

console.log('Database URL:', process.env.DATABASE_URL);
console.log('Auth Token exists:', !!process.env.DATABASE_AUTH_TOKEN);

const cloudDb = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN!
});

const migrateDataToCloud = async () => {
  try {
    console.log('🚀 Starting data migration from local SQLite to Turso cloud...');
    
    // First, ensure cloud database has the tables created
    console.log('🔧 Creating tables in cloud database...');
    const { createTables } = await import('./migrate');
    
    // Temporarily point to cloud database for table creation
    const originalUrl = process.env.DATABASE_URL;
    const originalToken = process.env.DATABASE_AUTH_TOKEN;
    
    try {
      await createTables();
      console.log('✅ Tables created in cloud database');
    } catch (error) {
      console.log('ℹ️ Tables might already exist in cloud database');
    }
    
    // Check if local database exists
    if (!fs.existsSync(path.join(process.cwd(), 'local.db'))) {
      console.log('❌ Local database not found. Running seed script to populate local database first...');
      
      // Import and run the seed script
      const { seedDatabase } = await import('./seed');
      
      // Temporarily set DATABASE_URL to local for seeding
      delete process.env.DATABASE_URL;
      delete process.env.DATABASE_AUTH_TOKEN;
      
      try {
        await seedDatabase();
        console.log('✅ Local database seeded successfully');
      } finally {
        // Restore original DATABASE_URL
        if (originalUrl) {
          process.env.DATABASE_URL = originalUrl;
        }
        if (originalToken) {
          process.env.DATABASE_AUTH_TOKEN = originalToken;
        }
      }
    }

    console.log('📊 Reading data from local database...');
    
    // Get all data from local database
    const [places, zipcodes, tradeAreas, homeZipcodes] = await Promise.all([
      localDb.execute('SELECT * FROM places'),
      localDb.execute('SELECT * FROM zipcodes'),
      localDb.execute('SELECT * FROM trade_areas'),
      localDb.execute('SELECT * FROM home_zipcodes')
    ]);

    console.log(`📋 Found data to migrate:
      - Places: ${places.rows.length}
      - Zipcodes: ${zipcodes.rows.length}
      - Trade Areas: ${tradeAreas.rows.length}
      - Home Zipcodes: ${homeZipcodes.rows.length}`);

    if (places.rows.length === 0 && zipcodes.rows.length === 0 && tradeAreas.rows.length === 0 && homeZipcodes.rows.length === 0) {
      console.log('⚠️ No data found in local database. Please ensure your JSON data files are in the /data directory and run the seed script first.');
      return;
    }

    // Clear cloud database first (optional - remove if you want to keep existing data)
    console.log('🧹 Clearing cloud database...');
    try {
      await cloudDb.execute('DELETE FROM home_zipcodes');
      await cloudDb.execute('DELETE FROM trade_areas');
      await cloudDb.execute('DELETE FROM places');
      await cloudDb.execute('DELETE FROM zipcodes');
    } catch (error) {
      console.log('ℹ️ Some tables might not exist yet, continuing with migration...');
    }

    // Migrate places - FAST MODE
    if (places.rows.length > 0) {
      console.log(`📍 Migrating ${places.rows.length} places in fast mode...`);
      
      // Use a single transaction with prepared statement
      const transaction = await cloudDb.transaction();
      try {
        // Prepare bulk insert values
        const placeholders = places.rows.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
        const sql = `INSERT INTO places (id, name, street_address, city, state, logo, longitude, latitude, industry, is_trade_area_available, is_home_zipcodes_available, category) VALUES ${placeholders}`;
        
        // Flatten all args into a single array
        const args = places.rows.flatMap(place => [
          place.id,
          place.name,
          place.street_address,
          place.city,
          place.state,
          place.logo,
          place.longitude,
          place.latitude,
          place.industry,
          place.is_trade_area_available,
          place.is_home_zipcodes_available,
          place.category
        ]);
        
        await transaction.execute({ sql, args });
        await transaction.commit();
        console.log(`   ✅ Migrated all ${places.rows.length} places in one go!`);
      } catch (error) {
        await transaction.rollback();
        console.error(`   ❌ Error migrating places:`, error);
        throw error;
      }
    }

    // Migrate zipcodes - FAST MODE
    if (zipcodes.rows.length > 0) {
      console.log(`🗺️ Migrating ${zipcodes.rows.length} zipcodes in fast mode...`);
      const transaction = await cloudDb.transaction();
      
      try {
        const placeholders = zipcodes.rows.map(() => '(?, ?)').join(',');
        const sql = `INSERT INTO zipcodes (id, polygon) VALUES ${placeholders}`;
        const args = zipcodes.rows.flatMap(zipcode => [zipcode.id, zipcode.polygon]);
        
        await transaction.execute({ sql, args });
        await transaction.commit();
        console.log(`   ✅ Migrated all ${zipcodes.rows.length} zipcodes in one go!`);
      } catch (error) {
        await transaction.rollback();
        console.error(`   ❌ Error migrating zipcodes:`, error);
        throw error;
      }
    }

    // Migrate trade areas - CHUNKED FAST MODE (might be large)
    if (tradeAreas.rows.length > 0) {
      console.log(`🏢 Migrating ${tradeAreas.rows.length} trade areas in chunked fast mode...`);
      const chunkSize = 500; // Smaller chunks for trade areas due to polygon data size
      
      for (let i = 0; i < tradeAreas.rows.length; i += chunkSize) {
        const chunk = tradeAreas.rows.slice(i, i + chunkSize);
        const transaction = await cloudDb.transaction();
        
        try {
          const placeholders = chunk.map(() => '(?, ?, ?)').join(',');
          const sql = `INSERT INTO trade_areas (pid, polygon, trade_area) VALUES ${placeholders}`;
          const args = chunk.flatMap(tradeArea => [tradeArea.pid, tradeArea.polygon, tradeArea.trade_area]);
          
          await transaction.execute({ sql, args });
          await transaction.commit();
          console.log(`   ✅ Migrated chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(tradeAreas.rows.length / chunkSize)} (${chunk.length} records)`);
        } catch (error) {
          await transaction.rollback();
          console.error(`   ❌ Error migrating trade areas chunk ${Math.floor(i / chunkSize) + 1}:`, error);
          throw error;
        }
      }
    }

    // Migrate home zipcodes - CHUNKED FAST MODE (might be large)
    if (homeZipcodes.rows.length > 0) {
      console.log(`🏠 Migrating ${homeZipcodes.rows.length} home zipcodes in chunked fast mode...`);
      const chunkSize = 1000; // Process in chunks of 1000 for very large datasets
      
      for (let i = 0; i < homeZipcodes.rows.length; i += chunkSize) {
        const chunk = homeZipcodes.rows.slice(i, i + chunkSize);
        const transaction = await cloudDb.transaction();
        
        try {
          const placeholders = chunk.map(() => '(?, ?, ?)').join(',');
          const sql = `INSERT INTO home_zipcodes (pid, zipcode_id, percentage) VALUES ${placeholders}`;
          const args = chunk.flatMap(homeZipcode => [homeZipcode.pid, homeZipcode.zipcode_id, homeZipcode.percentage]);
          
          await transaction.execute({ sql, args });
          await transaction.commit();
          console.log(`   ✅ Migrated chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(homeZipcodes.rows.length / chunkSize)} (${chunk.length} records)`);
        } catch (error) {
          await transaction.rollback();
          console.error(`   ❌ Error migrating home zipcodes chunk ${Math.floor(i / chunkSize) + 1}:`, error);
          throw error;
        }
      }
    }

    // Verify migration
    console.log('🔍 Verifying migration...');
    const [cloudPlaces, cloudZipcodes, cloudTradeAreas, cloudHomeZipcodes] = await Promise.all([
      cloudDb.execute('SELECT COUNT(*) as count FROM places'),
      cloudDb.execute('SELECT COUNT(*) as count FROM zipcodes'),
      cloudDb.execute('SELECT COUNT(*) as count FROM trade_areas'),
      cloudDb.execute('SELECT COUNT(*) as count FROM home_zipcodes')
    ]);

    console.log('\n🎉 Migration completed successfully!');
    console.log('\n=== Migration Summary ===');
    console.log(`📍 Places: ${places.rows.length} → ${cloudPlaces.rows[0].count}`);
    console.log(`🗺️ Zipcodes: ${zipcodes.rows.length} → ${cloudZipcodes.rows[0].count}`);
    console.log(`🏢 Trade Areas: ${tradeAreas.rows.length} → ${cloudTradeAreas.rows[0].count}`);
    console.log(`🏠 Home Zipcodes: ${homeZipcodes.rows.length} → ${cloudHomeZipcodes.rows[0].count}`);

    // Check for data integrity
    const allMatched = 
      places.rows.length === Number(cloudPlaces.rows[0].count) &&
      zipcodes.rows.length === Number(cloudZipcodes.rows[0].count) &&
      tradeAreas.rows.length === Number(cloudTradeAreas.rows[0].count) &&
      homeZipcodes.rows.length === Number(cloudHomeZipcodes.rows[0].count);

    if (allMatched) {
      console.log('✅ All data migrated successfully!');
    } else {
      console.log('⚠️ Data counts don\'t match. Please verify the migration.');
    }

  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  } finally {
    // Close database connections
    await localDb.close();
    await cloudDb.close();
  }
};

// Run the migration if this file is executed directly
if (require.main === module) {
  migrateDataToCloud()
    .then(() => {
      console.log('🎯 Migration process completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

export { migrateDataToCloud };

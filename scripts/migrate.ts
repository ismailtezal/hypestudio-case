import { db } from '../lib/db';

export const createTables = async () => {
  try {
    // Create places table (my_place + competitors)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS places (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        street_address TEXT,
        city TEXT,
        state TEXT,
        logo TEXT,
        longitude DECIMAL(10, 7) NOT NULL,
        latitude DECIMAL(10, 7) NOT NULL,
        industry TEXT,
        is_trade_area_available BOOLEAN DEFAULT false,
        is_home_zipcodes_available BOOLEAN DEFAULT false,
        category TEXT DEFAULT 'competitor' -- 'user_place' or 'competitor'
      )
    `);

    // Create zipcodes table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS zipcodes (
        id TEXT PRIMARY KEY,
        polygon JSONB NOT NULL -- JSON object of polygon coordinates
      )
    `);

    // Create trade_areas table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS trade_areas (
        id SERIAL PRIMARY KEY,
        pid TEXT NOT NULL, -- place ID reference
        polygon JSONB NOT NULL, -- JSON object of polygon coordinates
        trade_area INTEGER NOT NULL, -- 30, 50, or 70
        FOREIGN KEY (pid) REFERENCES places(id)
      )
    `);

    // Create home_zipcodes table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS home_zipcodes (
        id SERIAL PRIMARY KEY,
        pid TEXT NOT NULL, -- place ID reference
        zipcode_id TEXT NOT NULL,
        percentage DECIMAL(5, 2) NOT NULL,
        FOREIGN KEY (pid) REFERENCES places(id),
        FOREIGN KEY (zipcode_id) REFERENCES zipcodes(id)
      )
    `);

    console.log('All tables created successfully!');
  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  }
};

export const dropTables = async () => {
  try {
    await db.execute('DROP TABLE IF EXISTS home_zipcodes CASCADE');
    await db.execute('DROP TABLE IF EXISTS trade_areas CASCADE');
    await db.execute('DROP TABLE IF EXISTS zipcodes CASCADE');
    await db.execute('DROP TABLE IF EXISTS places CASCADE');
    console.log('All tables dropped successfully!');
  } catch (error) {
    console.error('Error dropping tables:', error);
    throw error;
  }
};

// Run migration if this file is executed directly
if (require.main === module) {
  createTables()
    .then(() => {
      console.log('Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

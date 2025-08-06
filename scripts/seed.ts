import fs from 'fs';
import path from 'path';
import { db } from '../lib/db';
import { createTables, dropTables } from './migrate';

interface MyPlaceData {
  id: string;
  name: string;
  street_address: string;
  city: string;
  state: string;
  logo: string | null;
  longitude: number;
  latitude: number;
  industry: string;
  isTradeAreaAvailable: boolean;
  isHomeZipcodesAvailable: boolean;
}

interface CompetitorData {
  pid: string;
  name: string;
  street_address: string;
  city: string;
  region: string;
  logo: string | null;
  latitude: number;
  longitude: number;
  sub_category: string;
  trade_area_activity: boolean;
  home_locations_activity: boolean;
  distance: number;
}

interface ZipcodeData {
  id: string;
  polygon: string;
}

interface TradeAreaData {
  pid: string;
  polygon: string;
  trade_area: number;
}

interface HomeZipcodeEntry {
  pid: string;
  locations: { [zipcode: string]: string }[];
}

const loadJSONFile = (filename: string): any => {
  const filePath = path.join(process.cwd(), 'data', filename);
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(fileContent);
};

const seedDatabase = async () => {
  try {
    console.log('Starting database migration...');
    
    // Drop and recreate tables
    await dropTables();
    await createTables();
    
    // Load JSON data
    console.log('Loading JSON data...');
    const myPlaceData: MyPlaceData = loadJSONFile('my_place.json');
    const competitorsData: CompetitorData[] = loadJSONFile('competitors.json');
    const zipcodesData: ZipcodeData[] = loadJSONFile('zipcodes.json');
    
    // Trade areas file is too large, we'll handle it separately
    console.log('Loading trade areas data...');
    let tradeAreasData: TradeAreaData[] = [];
    try {
      const tradeAreasRaw = loadJSONFile('trade_areas.json');
      tradeAreasData = tradeAreasRaw.features || tradeAreasRaw || [];
    } catch (error) {
      console.warn('Trade areas file might be too large or corrupted, skipping...');
    }

    // Load home zipcodes data
    console.log('Loading home zipcodes data...');
    let homeZipcodesData: HomeZipcodeEntry[] = [];
    try {
      homeZipcodesData = loadJSONFile('home_zipcodes.json');
    } catch (error) {
      console.warn('Home zipcodes file might be too large or corrupted, skipping...');
    }

    // Insert my place
    console.log('Inserting my place...');
    await db.execute(
      `INSERT INTO places (id, name, street_address, city, state, logo, longitude, latitude, industry, is_trade_area_available, is_home_zipcodes_available, category) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO NOTHING`,
      [
        myPlaceData.id,
        myPlaceData.name,
        myPlaceData.street_address,
        myPlaceData.city,
        myPlaceData.state,
        myPlaceData.logo,
        myPlaceData.longitude,
        myPlaceData.latitude,
        myPlaceData.industry,
        myPlaceData.isTradeAreaAvailable,
        myPlaceData.isHomeZipcodesAvailable,
        'user_place'
      ]
    );

    // Insert competitors
    console.log(`Inserting ${competitorsData.length} competitors...`);
    for (const competitor of competitorsData) {
      await db.execute(
        `INSERT INTO places (id, name, street_address, city, state, logo, longitude, latitude, industry, is_trade_area_available, is_home_zipcodes_available, category) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO NOTHING`,
        [
          competitor.pid,
          competitor.name,
          competitor.street_address,
          competitor.city,
          competitor.region,
          competitor.logo,
          competitor.longitude,
          competitor.latitude,
          competitor.sub_category,
          competitor.trade_area_activity,
          competitor.home_locations_activity,
          'competitor'
        ]
      );
    }

    // Insert zipcodes
    console.log(`Inserting ${zipcodesData.length} zipcodes...`);
    for (const zipcode of zipcodesData) {
      const polygonStr = typeof zipcode.polygon === 'string' 
        ? zipcode.polygon 
        : JSON.stringify(zipcode.polygon);
        
      await db.execute(
        `INSERT INTO zipcodes (id, polygon) VALUES ($1, $2)
         ON CONFLICT (id) DO NOTHING`,
        [zipcode.id, polygonStr]
      );
    }

    // Insert trade areas if available
    if (tradeAreasData.length > 0) {
      console.log(`Inserting ${tradeAreasData.length} trade areas...`);
      for (const tradeArea of tradeAreasData) {
        const polygonStr = typeof tradeArea.polygon === 'string' 
          ? tradeArea.polygon 
          : JSON.stringify(tradeArea.polygon);
          
        await db.execute(
          `INSERT INTO trade_areas (pid, polygon, trade_area) VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          [tradeArea.pid, polygonStr, tradeArea.trade_area]
        );
      }
    }

    // Insert home zipcodes if available
    if (homeZipcodesData.length > 0) {
      console.log(`Processing ${homeZipcodesData.length} home zipcode entries...`);
      let totalInserted = 0;
      
      for (const entry of homeZipcodesData) {
        for (const location of entry.locations) {
          for (const [zipcodeId, percentage] of Object.entries(location)) {
            await db.execute(
              `INSERT INTO home_zipcodes (pid, zipcode_id, percentage) VALUES ($1, $2, $3)
               ON CONFLICT DO NOTHING`,
              [entry.pid, zipcodeId, parseFloat(percentage)]
            );
            totalInserted++;
          }
        }
        
        if (totalInserted % 1000 === 0) {
          console.log(`Inserted ${totalInserted} home zipcode records...`);
        }
      }
      console.log(`Total home zipcode records inserted: ${totalInserted}`);
    }

    console.log('Database migration completed successfully!');
    
    // Show summary
    const placesCount = await db.execute('SELECT COUNT(*) as count FROM places');
    const zipcodesCount = await db.execute('SELECT COUNT(*) as count FROM zipcodes');
    const tradeAreasCount = await db.execute('SELECT COUNT(*) as count FROM trade_areas');
    const homeZipcodesCount = await db.execute('SELECT COUNT(*) as count FROM home_zipcodes');
    
    console.log('\n=== Migration Summary ===');
    console.log(`Places: ${placesCount.rows[0].count}`);
    console.log(`Zipcodes: ${zipcodesCount.rows[0].count}`);
    console.log(`Trade Areas: ${tradeAreasCount.rows[0].count}`);
    console.log(`Home Zipcodes: ${homeZipcodesCount.rows[0].count}`);
    
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  }
};

// Run the migration if this file is executed directly
if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { seedDatabase };

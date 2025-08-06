import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/db';

export async function GET() {
  try {
    const result = await db.execute(`
      SELECT 
        id as pid,
        name,
        street_address,
        city,
        state as region,
        logo,
        longitude,
        latitude,
        industry as sub_category,
        is_trade_area_available as trade_area_activity,
        is_home_zipcodes_available as home_locations_activity
      FROM places 
      WHERE category = 'competitor'
      ORDER BY name ASC
    `);

    const competitors = result.rows.map(row => ({
      pid: row.pid,
      name: row.name,
      street_address: row.street_address,
      city: row.city,
      region: row.region,
      logo: row.logo,
      latitude: row.latitude,
      longitude: row.longitude,
      sub_category: row.sub_category,
      trade_area_activity: Boolean(row.trade_area_activity),
      home_locations_activity: Boolean(row.home_locations_activity),
      distance: 0 // Distance calculation would need to be done separately
    }));

    return NextResponse.json(competitors);
  } catch (error) {
    console.error('Error fetching competitors:', error);
    return NextResponse.json(
      { error: 'Failed to fetch competitors' },
      { status: 500 }
    );
  }
}

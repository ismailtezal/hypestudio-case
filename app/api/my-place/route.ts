import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/db';

export async function GET() {
  try {
    const result = await db.execute(`
      SELECT 
        id,
        name,
        street_address,
        city,
        state,
        logo,
        longitude,
        latitude,
        industry,
        is_trade_area_available as isTradeAreaAvailable,
        is_home_zipcodes_available as isHomeZipcodesAvailable
      FROM places 
      WHERE category = 'user_place'
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'My place not found' },
        { status: 404 }
      );
    }

    const place = result.rows[0];
    const myPlace = {
      id: place.id,
      name: place.name,
      street_address: place.street_address,
      city: place.city,
      state: place.state,
      logo: place.logo,
      longitude: place.longitude,
      latitude: place.latitude,
      industry: place.industry,
      isTradeAreaAvailable: Boolean(place.isTradeAreaAvailable),
      isHomeZipcodesAvailable: Boolean(place.isHomeZipcodesAvailable)
    };

    return NextResponse.json(myPlace);
  } catch (error) {
    console.error('Error fetching my place:', error);
    return NextResponse.json(
      { error: 'Failed to fetch my place' },
      { status: 500 }
    );
  }
}

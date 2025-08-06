import { NextRequest, NextResponse } from 'next/server';
import { db, getFromCache, setCache } from '../../../lib/db';

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters for filtering and pagination
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '1000');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const industry = url.searchParams.get('industry');
    const bounds = url.searchParams.get('bounds'); // "minLng,minLat,maxLng,maxLat"
    
    // Create cache key based on parameters
    const cacheKey = `places_${limit}_${offset}_${industry || 'all'}_${bounds || 'nobounds'}`;
    
    // Check cache first
    const cached = getFromCache(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          'Content-Type': 'application/json',
        }
      });
    }

    // Build optimized query
    let query = `
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
        is_home_zipcodes_available as isHomeZipcodesAvailable,
        category
      FROM places 
      WHERE longitude IS NOT NULL AND latitude IS NOT NULL
    `;
    
    const params: any[] = [];
    
    // Add industry filter
    if (industry && industry !== 'all') {
      query += ` AND industry = ?`;
      params.push(industry);
    }
    
    // Add geographic bounds filter
    if (bounds) {
      const [minLng, minLat, maxLng, maxLat] = bounds.split(',').map(Number);
      query += ` AND longitude BETWEEN ? AND ? AND latitude BETWEEN ? AND ?`;
      params.push(minLng, maxLng, minLat, maxLat);
    }
    
    query += ` ORDER BY category DESC, name ASC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const result = await db.execute(query, params);

    const places = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      street_address: row.street_address,
      city: row.city,
      state: row.state,
      logo: row.logo,
      longitude: row.longitude,
      latitude: row.latitude,
      industry: row.industry,
      isTradeAreaAvailable: Boolean(row.isTradeAreaAvailable),
      isHomeZipcodesAvailable: Boolean(row.isHomeZipcodesAvailable),
      category: row.category,
    }));

    const response = { places };
    
    // Cache the result for 5 minutes
    setCache(cacheKey, response, 300);

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'Content-Type': 'application/json',
      }
    });
  } catch (error) {
    console.error('Error fetching places:', error);
    return NextResponse.json(
      { error: 'Failed to fetch places' },
      { status: 500 }
    );
  }
}

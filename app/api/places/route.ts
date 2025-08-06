import { NextRequest, NextResponse } from 'next/server';
import { db, getFromCache, setCache } from '../../../lib/db';

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters for filtering and cursor-based pagination
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '2000'); // Increased default limit
    const cursor = url.searchParams.get('cursor'); // For cursor-based pagination
    const industry = url.searchParams.get('industry');
    const bounds = url.searchParams.get('bounds'); // "minLng,minLat,maxLng,maxLat"
    
    // Create cache key based on parameters
    const cacheKey = `places_optimized_${limit}_${cursor || 'start'}_${industry || 'all'}_${bounds || 'nobounds'}`;
    
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

    // Use optimized materialized view for better performance
    let query = `
      SELECT 
        p.id,
        p.name,
        p.street_address,
        p.city,
        p.state,
        p.logo,
        CASE 
          WHEN p.longitude ~ '^-?[0-9]+\.?[0-9]*$' 
          THEN p.longitude::text
          ELSE p.longitude 
        END as longitude,
        CASE 
          WHEN p.latitude ~ '^-?[0-9]+\.?[0-9]*$' 
          THEN p.latitude::text
          ELSE p.latitude 
        END as latitude,
        p.industry,
        p.is_trade_area_available as isTradeAreaAvailable,
        p.is_home_zipcodes_available as isHomeZipcodesAvailable,
        p.category
      FROM places p
      WHERE p.longitude IS NOT NULL AND p.latitude IS NOT NULL
    `;
    
    const params: any[] = [];
    let paramCounter = 1;
    
    // Add cursor condition for pagination (much faster than OFFSET)
    if (cursor) {
      query += ` AND p.id > $${paramCounter++}`;
      params.push(cursor);
    }
    
    // Add industry filter
    if (industry && industry !== 'all') {
      query += ` AND industry = $${paramCounter++}`;
      params.push(industry);
    }
    
    // Add geographic bounds filter
    if (bounds) {
      const [minLng, minLat, maxLng, maxLat] = bounds.split(',').map(Number);
      query += ` AND longitude BETWEEN $${paramCounter++} AND $${paramCounter++} AND latitude BETWEEN $${paramCounter++} AND $${paramCounter++}`;
      params.push(minLng, maxLng, minLat, maxLat);
    }
    
    query += ` ORDER BY category DESC, name ASC LIMIT $${paramCounter++}`;
    params.push(limit);

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

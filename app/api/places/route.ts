import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { jsonWithETag } from '../../../lib/http';

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters for filtering and cursor-based pagination
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '2000'); // Increased default limit
    const cursor = url.searchParams.get('cursor'); // For cursor-based pagination
    const industry = url.searchParams.get('industry');
    const bounds = url.searchParams.get('bounds'); // "minLng,minLat,maxLng,maxLat"
    
    // Consider adding ETag generation here in the future for HTTP caching

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
      longitude: typeof row.longitude === 'string' ? parseFloat(row.longitude) : row.longitude,
      latitude: typeof row.latitude === 'string' ? parseFloat(row.latitude) : row.latitude,
      industry: row.industry,
      isTradeAreaAvailable: Boolean(row.isTradeAreaAvailable),
      isHomeZipcodesAvailable: Boolean(row.isHomeZipcodesAvailable),
      category: row.category,
    }));

    const response = { places };

    return jsonWithETag(request, response, {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      'Content-Type': 'application/json',
    });
  } catch (error) {
    console.error('Error fetching places:', error);
    return NextResponse.json(
      { error: 'Failed to fetch places' },
      { status: 500 }
    );
  }
}

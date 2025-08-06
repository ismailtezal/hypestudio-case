import { NextRequest, NextResponse } from 'next/server';
import { db, getFromCache, setCache } from '../../../lib/db';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const pid = url.searchParams.get('pid');
    const tradeArea = url.searchParams.get('trade_area');
    
    // Create cache key
    const cacheKey = `trade_areas_${pid || 'all'}_${tradeArea || 'all'}`;
    
    // Check cache first
    const cached = getFromCache(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
          'Content-Type': 'application/json',
        }
      });
    }

    let query = 'SELECT pid, polygon, trade_area FROM trade_areas';
    const params: any[] = [];
    const conditions: string[] = [];
    let paramCounter = 1;

    if (pid) {
      conditions.push(`pid = $${paramCounter++}`);
      params.push(parseInt(pid));
    }

    if (tradeArea) {
      conditions.push(`trade_area = $${paramCounter++}`);
      params.push(parseInt(tradeArea));
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY pid ASC, trade_area ASC';

    console.log('🔍 Loading trade areas data...');
    
    const result = await db.execute(query, params);
    
    console.log(`📊 Processing ${result.rows.length} trade areas...`);
    
    const tradeAreas = result.rows.map(row => ({
      pid: row.pid,
      polygon: row.polygon, // PostgreSQL JSONB automatically parses JSON
      trade_area: row.trade_area
    }));

    console.log(`✅ Trade areas loaded successfully! (${tradeAreas.length} features)`);

    const response = { features: tradeAreas };
    
    // Cache for 10 minutes (trade areas change infrequently)
    setCache(cacheKey, response, 600);

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
        'Content-Type': 'application/json',
        'X-Total-Features': tradeAreas.length.toString(),
      }
    });
  } catch (error) {
    console.error('Error fetching trade areas:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trade areas' },
      { status: 500 }
    );
  }
}

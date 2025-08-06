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

    if (pid) {
      conditions.push('pid = ?');
      params.push(parseInt(pid));
    }

    if (tradeArea) {
      conditions.push('trade_area = ?');
      params.push(parseInt(tradeArea));
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY pid ASC, trade_area ASC';

    console.log('🔍 Loading trade areas data in database chunks...');
    
    // Fetch data in database-level chunks to avoid 502 errors
    const dbChunkSize = 500; // Fetch 500 records per database query
    const tradeAreas: any[] = [];
    let offset = 0;
    let hasMoreData = true;
    let totalFetched = 0;
    
    while (hasMoreData) {
      try {
        // Create paginated query for database-level chunking
        const paginatedQuery = query + ` LIMIT ${dbChunkSize} OFFSET ${offset}`;
        console.log(`⏳ Fetching trade areas chunk ${Math.floor(offset / dbChunkSize) + 1} (${offset + 1}-${offset + dbChunkSize})...`);
        
        const result = await db.execute(paginatedQuery, params);
        
        if (result.rows.length === 0) {
          hasMoreData = false;
          break;
        }
        
        console.log(`📊 Processing ${result.rows.length} trade areas from database chunk...`);
        
        // Process the fetched chunk in smaller memory chunks
        const memoryChunkSize = 100;
        for (let i = 0; i < result.rows.length; i += memoryChunkSize) {
          const chunk = result.rows.slice(i, i + memoryChunkSize);
          
          for (const row of chunk) {
            try {
              const polygon = typeof row.polygon === 'string' ? JSON.parse(row.polygon) : row.polygon;
              tradeAreas.push({
                pid: row.pid,
                polygon: polygon,
                trade_area: row.trade_area
              });
            } catch (error) {
              console.warn(`⚠️ Skipping invalid polygon for pid ${row.pid}:`, error.message);
              continue;
            }
          }
        }
        
        totalFetched += result.rows.length;
        offset += dbChunkSize;
        
        // If we got fewer rows than requested, we've reached the end
        if (result.rows.length < dbChunkSize) {
          hasMoreData = false;
        }
        
        console.log(`✅ Processed ${totalFetched} trade areas so far...`);
        
      } catch (chunkError) {
        console.error(`❌ Error fetching chunk at offset ${offset}:`, chunkError);
        // Try to continue with next chunk or break if too many errors
        offset += dbChunkSize;
        if (offset > 10000) { // Safety limit
          console.error('Too many errors, stopping fetch');
          break;
        }
      }
    }

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

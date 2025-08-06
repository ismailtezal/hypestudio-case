import { NextRequest, NextResponse } from 'next/server';
import { db, getFromCache, setCache } from '../../../lib/db';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const pid = url.searchParams.get('pid');
    const tradeArea = url.searchParams.get('trade_area');
    const limit = url.searchParams.get('limit');
    const offset = url.searchParams.get('offset');
    const stream = url.searchParams.get('stream') === 'true';
    
    // Create cache key
    const cacheKey = `trade_areas_${pid || 'all'}_${tradeArea || 'all'}_${limit || 'all'}_${offset || '0'}`;
    
    // Check cache first for non-streaming requests
    if (!stream) {
      const cached = getFromCache(cacheKey);
      if (cached) {
        return NextResponse.json(cached, {
          headers: {
            'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
            'Content-Type': 'application/json',
          }
        });
      }
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

    // Add pagination for better performance - default to reasonable limit
    const finalLimit = limit ? parseInt(limit) : 500; // Default to 500 if no limit specified
    const finalOffset = offset ? parseInt(offset) : 0;
    
    query += ` LIMIT $${paramCounter++}`;
    params.push(finalLimit);
    
    query += ` OFFSET $${paramCounter++}`;
    params.push(finalOffset);

    console.log('🔍 Loading trade areas data...');
    
    // For streaming responses with large datasets
    if (stream && !limit) {
      return createStreamingResponse(query, params);
    }

    const result = await db.execute(query, params);
    
    console.log(`📊 Processing ${result.rows.length} trade areas...`);
    
    const tradeAreas = result.rows.map(row => ({
      pid: row.pid,
      polygon: row.polygon, // PostgreSQL JSONB automatically parses JSON
      trade_area: row.trade_area
    }));

    console.log(`✅ Trade areas loaded successfully! (${tradeAreas.length} features)`);

    const response = { 
      features: tradeAreas,
      pagination: {
        limit: finalLimit,
        offset: finalOffset,
        hasMore: tradeAreas.length === finalLimit,
        total: tradeAreas.length
      }
    };
    
    // Cache for 10 minutes (trade areas change infrequently)
    if (!stream) {
      setCache(cacheKey, response, 600);
    }

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

// Create streaming response for large datasets
async function createStreamingResponse(query: string, params: any[]) {
  const encoder = new TextEncoder();
  
  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode('{"features":['));
        
        // Use cursor-based approach for memory efficiency
        const batchSize = 500; // Process in smaller batches
        let offset = 0;
        let isFirst = true;
        
        while (true) {
          const batchQuery = `${query} LIMIT ${batchSize} OFFSET ${offset}`;
          const result = await db.execute(batchQuery, params);
          
          if (result.rows.length === 0) break;
          
          for (const row of result.rows) {
            const feature = {
              pid: row.pid,
              polygon: row.polygon,
              trade_area: row.trade_area
            };
            
            const prefix = isFirst ? '' : ',';
            isFirst = false;
            
            controller.enqueue(encoder.encode(prefix + JSON.stringify(feature)));
          }
          
          offset += batchSize;
          
          // If we got fewer rows than batch size, we're done
          if (result.rows.length < batchSize) break;
        }
        
        controller.enqueue(encoder.encode(']}'));
        controller.close();
      } catch (error) {
        console.error('Streaming error:', error);
        controller.error(error);
      }
    }
  });

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering for streaming
    }
  });
}

import { NextRequest } from 'next/server';
import { db } from '../../../../lib/db';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const pid = url.searchParams.get('pid');
  const tradeArea = url.searchParams.get('trade_area');
  const batchSize = parseInt(url.searchParams.get('batch_size') || '500'); // Increased batch size
  const cursor = url.searchParams.get('cursor'); // For cursor-based pagination
  
  console.log('🚀 Starting optimized streaming response for trade areas...');
  
  const encoder = new TextEncoder();
  
  // Create streaming response using ReadableStream (NDJSON)
  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        // NDJSON: each line is a JSON object
        
        // Build optimized query with cursor-based pagination
        let query = 'SELECT pid, polygon, trade_area FROM trade_areas';
        const params: any[] = [];
        const conditions: string[] = [];
        let paramCounter = 1;

        // Add cursor condition for pagination (much faster than OFFSET)
        if (cursor) {
          const parts = cursor.split(',');
          if (parts.length === 2) {
            const [cursorPid, cursorTradeArea] = parts as [string, string];
            conditions.push(`(pid > $${paramCounter++} OR (pid = $${paramCounter++} AND trade_area > $${paramCounter++}))`);
            params.push(parseInt(cursorPid, 10), parseInt(cursorPid, 10), parseInt(cursorTradeArea, 10));
          }
        }

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

        // Critical: Order by indexed columns for optimal performance
        query += ' ORDER BY pid ASC, trade_area ASC';
        
        let lastPid: number | null = null;
        let lastTradeArea: number | null = null;
        let totalFeatures = 0;
        
        console.log(`⚡ Processing with cursor-based pagination, batch size: ${batchSize}...`);
        
        while (true) {
          // Build cursor-based query (no OFFSET - much faster!)
          let batchQuery = query;
          let batchParams = [...params];
          
          if (lastPid !== null && lastTradeArea !== null) {
            // Add cursor condition for next batch
            const cursorCondition = `(pid > $${batchParams.length + 1} OR (pid = $${batchParams.length + 2} AND trade_area > $${batchParams.length + 3}))`;
            
            if (batchQuery.includes('WHERE')) {
              // Find the ORDER BY clause and insert cursor condition before it
              const orderByIndex = batchQuery.indexOf('ORDER BY');
              const beforeOrderBy = batchQuery.substring(0, orderByIndex);
              const orderByClause = batchQuery.substring(orderByIndex);
              batchQuery = `${beforeOrderBy} AND ${cursorCondition} ${orderByClause}`;
            } else {
              // Insert cursor condition before ORDER BY
              const orderByIndex = batchQuery.indexOf('ORDER BY');
              const beforeOrderBy = batchQuery.substring(0, orderByIndex);
              const orderByClause = batchQuery.substring(orderByIndex);
              batchQuery = `${beforeOrderBy} WHERE ${cursorCondition} ${orderByClause}`;
            }
            
            batchParams.push(lastPid, lastPid, lastTradeArea);
          }
          
          batchQuery += ` LIMIT ${batchSize}`;
          
          // Debug: Log the generated query
          console.log(`🔍 Generated query:`, batchQuery);
          console.log(`🔍 Query params:`, batchParams);
          
          try {
            const result = await db.execute(batchQuery, batchParams);
            
            if (result.rows.length === 0) {
              console.log('✅ No more data to stream');
              break;
            }
            
            console.log(`⚡ Streaming batch: ${result.rows.length} features (cursor: ${lastPid || 'start'},${lastTradeArea || 'start'})`);
            
            for (const row of result.rows) {
              // Validate row data before streaming
              if (!row || typeof row !== 'object') {
                console.error('❌ Invalid row data:', row);
                continue;
              }
              
              if (row.pid === null || row.pid === undefined) {
                console.error('❌ Row missing pid:', row);
                continue;
              }
              
              if (row.trade_area === null || row.trade_area === undefined) {
                console.error('❌ Row missing trade_area:', row);
                continue;
              }
              
              if (!row.polygon) {
                console.error('❌ Row missing polygon:', row);
                continue;
              }
              
              // Normalize polygon to object and validate structure
              let polygonObj: any;
              try {
                polygonObj = typeof row.polygon === 'string' ? JSON.parse(row.polygon) : row.polygon;
                if (!polygonObj || !polygonObj.type) {
                  console.error('❌ Invalid polygon structure:', polygonObj);
                  continue;
                }
              } catch (e) {
                console.error('❌ Failed to parse polygon for validation:', e);
                continue;
              }
              
              // Format data to match what deck.gl layers expect
              const feature = {
                pid: row.pid,
                trade_area: row.trade_area,
                polygon: polygonObj
              };
              totalFeatures++;
              
              // Update cursor for next iteration
              lastPid = row.pid;
              lastTradeArea = row.trade_area;
              
              // Stream each feature immediately as NDJSON
              controller.enqueue(encoder.encode(JSON.stringify(feature) + '\n'));
              
              // Optional: Add artificial delay to prevent overwhelming the client
              // await new Promise(resolve => setTimeout(resolve, 1));
            }
            
            // If we got fewer rows than batch size, we're done
            if (result.rows.length < batchSize) {
              console.log('✅ Reached end of dataset');
              break;
            }
            
          } catch (error) {
            console.error('Error in batch processing:', error);
            throw error;
          }
        }
        
        // Nothing to close for NDJSON
        controller.close();
        
        console.log(`✅ Streaming completed! Total features: ${totalFeatures}`);
        
      } catch (error) {
        console.error('❌ Streaming error:', error);
        
        // Send error in JSON format
        const errorResponse = {
          error: 'Streaming failed',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        };
        
        controller.error(error);
      }
    },
    
    cancel() {
      console.log('🚫 Stream cancelled by client');
    }
  });

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Transfer-Encoding': 'chunked',
    }
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

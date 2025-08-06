import { NextRequest } from 'next/server';
import { db } from '../../../../lib/db';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const pid = url.searchParams.get('pid');
  const tradeArea = url.searchParams.get('trade_area');
  const batchSize = parseInt(url.searchParams.get('batch_size') || '500');
  const cursor = url.searchParams.get('cursor'); // For cursor-based pagination
  
  console.log('🌊 Starting optimized streaming response for trade areas...');
  
  const encoder = new TextEncoder();
  
  // Create streaming response using ReadableStream with cursor-based pagination
  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        // Start JSON array response
        controller.enqueue(encoder.encode('['));
        
        // Build optimized query using cursor-based pagination instead of OFFSET
        let query: string;
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

        // Cursor-based pagination for better performance on large datasets
        if (cursor) {
          const [cursorPid, cursorTradeArea, cursorId] = cursor.split(':');
          conditions.push(`(pid, trade_area, id) > ($${paramCounter++}, $${paramCounter++}, $${paramCounter++})`);
          params.push(parseInt(cursorPid), parseInt(cursorTradeArea), parseInt(cursorId));
        }

        // Use the optimized composite index: pid, trade_area, id
        if (conditions.length > 0) {
          query = `
            SELECT pid, polygon, trade_area, id 
            FROM trade_areas 
            WHERE ${conditions.join(' AND ')}
            ORDER BY pid ASC, trade_area ASC, id ASC
            LIMIT $${paramCounter++}
          `;
        } else {
          query = `
            SELECT pid, polygon, trade_area, id 
            FROM trade_areas 
            ORDER BY pid ASC, trade_area ASC, id ASC
            LIMIT $${paramCounter++}
          `;
        }
        
        params.push(batchSize);
        
        let isFirst = true;
        let totalFeatures = 0;
        let lastCursor = cursor;
        
        console.log(`📦 Processing in optimized batches of ${batchSize}...`);
        
        while (true) {
          try {
            // Use prepared statement for better performance on repeated queries
            const prepareName = `trade_areas_stream_${conditions.length}_${Date.now()}`;
            const result = await db.execute(query, params);
            
            if (result.rows.length === 0) {
              console.log('✅ No more data to stream');
              break;
            }
            
            console.log(`📊 Streaming batch: ${totalFeatures + 1}-${totalFeatures + result.rows.length} features`);
            
            for (const row of result.rows) {
              // Format data to match what deck.gl layers expect
              const feature = {
                pid: row.pid,
                trade_area: row.trade_area,
                polygon: row.polygon // Keep polygon as direct property for deck.gl compatibility
              };
              
              const prefix = isFirst ? '' : ',';
              isFirst = false;
              totalFeatures++;
              
              // Stream each feature immediately
              controller.enqueue(encoder.encode(prefix + JSON.stringify(feature)));
              
              // Update cursor for next batch
              lastCursor = `${row.pid}:${row.trade_area}:${row.id}`;
            }
            
            // If we got fewer rows than batch size, we're done
            if (result.rows.length < batchSize) {
              console.log('✅ Reached end of dataset');
              break;
            }
            
            // Update cursor for next iteration
            if (result.rows.length > 0) {
              const lastRow = result.rows[result.rows.length - 1];
              lastCursor = `${lastRow.pid}:${lastRow.trade_area}:${lastRow.id}`;
              
              // Update params for next iteration
              if (cursor) {
                // Update cursor parameters
                const cursorParamIndex = params.length - 4; // cursor params are before limit
                params[cursorParamIndex] = lastRow.pid;
                params[cursorParamIndex + 1] = lastRow.trade_area;
                params[cursorParamIndex + 2] = lastRow.id;
              } else {
                // Add cursor condition for subsequent queries
                conditions.push(`(pid, trade_area, id) > ($${paramCounter++}, $${paramCounter++}, $${paramCounter++})`);
                params.splice(-1, 0, lastRow.pid, lastRow.trade_area, lastRow.id);
                
                // Rebuild query with cursor
                query = `
                  SELECT pid, polygon, trade_area, id 
                  FROM trade_areas 
                  WHERE ${conditions.join(' AND ')}
                  ORDER BY pid ASC, trade_area ASC, id ASC
                  LIMIT $${params.length}
                `;
              }
            }
            
          } catch (error) {
            console.error('Error in batch processing:', error);
            throw error;
          }
        }
        
        // Close JSON array response
        controller.enqueue(encoder.encode(`]`));
        controller.close();
        
        console.log(`✅ Optimized streaming completed! Total features: ${totalFeatures}`);
        
      } catch (error) {
        console.error('❌ Streaming error:', error);
        
        try {
          controller.enqueue(encoder.encode(']'));
        } catch (e) {
          console.error('Failed to send error response:', e);
        }
        
        controller.error(error);
      }
    },
    
    cancel() {
      console.log('🚫 Stream cancelled by client');
    }
  });

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Transfer-Encoding': 'chunked',
      // Add performance headers
      'X-Optimization': 'cursor-pagination-enabled',
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

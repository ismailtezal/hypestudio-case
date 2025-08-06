import { NextRequest } from 'next/server';
import { db } from '../../../../lib/db';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const pid = url.searchParams.get('pid');
  const tradeArea = url.searchParams.get('trade_area');
  const batchSize = parseInt(url.searchParams.get('batch_size') || '250');
  
  console.log('🌊 Starting streaming response for trade areas...');
  
  const encoder = new TextEncoder();
  
  // Create streaming response using ReadableStream
  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        // Start JSON array response
        controller.enqueue(encoder.encode('['));
        
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
        
        let offset = 0;
        let isFirst = true;
        let totalFeatures = 0;
        
        console.log(`📦 Processing in batches of ${batchSize}...`);
        
        while (true) {
          const batchQuery = `${query} LIMIT ${batchSize} OFFSET ${offset}`;
          
          try {
            const result = await db.execute(batchQuery, params);
            
            if (result.rows.length === 0) {
              console.log('✅ No more data to stream');
              break;
            }
            
            console.log(`📊 Streaming batch: ${offset + 1}-${offset + result.rows.length} features`);
            
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
              
              // Validate polygon structure
              try {
                const polygonTest = typeof row.polygon === 'string' ? JSON.parse(row.polygon) : row.polygon;
                if (!polygonTest || !polygonTest.type) {
                  console.error('❌ Invalid polygon structure:', polygonTest);
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
                polygon: row.polygon // Keep polygon as direct property for deck.gl compatibility
              };
              
              const prefix = isFirst ? '' : ',';
              isFirst = false;
              totalFeatures++;
              
              // Stream each feature immediately
              controller.enqueue(encoder.encode(prefix + JSON.stringify(feature)));
              
              // Optional: Add artificial delay to prevent overwhelming the client
              // await new Promise(resolve => setTimeout(resolve, 1));
            }
            
            offset += batchSize;
            
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
        
        // Close JSON array response
        controller.enqueue(encoder.encode(`]`));
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

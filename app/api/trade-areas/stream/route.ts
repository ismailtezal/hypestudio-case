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
        // Start JSON response
        controller.enqueue(encoder.encode('{"type":"FeatureCollection","features":['));
        
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
              const feature = {
                type: "Feature",
                properties: {
                  pid: row.pid,
                  trade_area: row.trade_area
                },
                geometry: row.polygon // Already parsed as JSONB
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
        
        // Close JSON response
        controller.enqueue(encoder.encode(`],"metadata":{"totalFeatures":${totalFeatures},"streamedAt":"${new Date().toISOString()}"}}`));
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
          controller.enqueue(encoder.encode(']}'));
          controller.enqueue(encoder.encode(`,"error":${JSON.stringify(errorResponse)}`));
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

import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/db';

export async function GET() {
  try {
    const result = await db.execute(`
      SELECT 
        hz.pid,
        hz.zipcode_id,
        hz.percentage
      FROM home_zipcodes hz
      ORDER BY hz.pid ASC, hz.zipcode_id ASC
    `);

    // Group by pid to match original JSON structure
    const grouped: { [pid: string]: { [zipcode: string]: number }[] } = {};
    
    for (const row of result.rows) {
      const pid = row.pid as string;
      const zipcodeId = row.zipcode_id as string;
      const percentage = row.percentage as number;
      
      if (!grouped[pid]) {
        grouped[pid] = [];
      }
      
      // Each location is a separate object as per case study specification
      grouped[pid].push({ [zipcodeId]: percentage });
    }

    // Convert to original JSON structure
    const homeZipcodes = Object.entries(grouped).map(([pid, locations]) => ({
      place_id: pid,  // Use place_id as per case study specification
      locations  // Array of Location objects: [{ "zipcode1": number }, { "zipcode2": number }]
    }));

    return NextResponse.json(homeZipcodes);
  } catch (error) {
    console.error('Error fetching home zipcodes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch home zipcodes' },
      { status: 500 }
    );
  }
}

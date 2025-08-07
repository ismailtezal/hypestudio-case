import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { jsonWithETag } from '../../../lib/http';

export async function GET(request: NextRequest) {
  try {
    const result = await db.execute(`
      SELECT id, polygon
      FROM zipcodes
      ORDER BY id ASC
    `);

    const zipcodes = result.rows.map(row => {
      const polygon = typeof row.polygon === 'string' ? JSON.parse(row.polygon) : row.polygon;
      return {
        id: row.id,
        polygon,
      };
    });

    return jsonWithETag(request, zipcodes, {
      'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
      'Content-Type': 'application/json',
    });
  } catch (error) {
    console.error('Error fetching zipcodes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch zipcodes' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/db';

export async function GET() {
  try {
    const result = await db.execute(`
      SELECT id, polygon
      FROM zipcodes
      ORDER BY id ASC
    `);

    const zipcodes = result.rows.map(row => ({
      id: row.id,
      polygon: row.polygon // PostgreSQL JSONB automatically parses JSON
    }));

    return NextResponse.json(zipcodes);
  } catch (error) {
    console.error('Error fetching zipcodes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch zipcodes' },
      { status: 500 }
    );
  }
}

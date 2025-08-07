import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';

function computeETag(data: unknown): string {
  const json = typeof data === 'string' ? data : JSON.stringify(data);
  const hash = createHash('sha1').update(json).digest('hex');
  // Weak ETag is fine for our use case
  return `W/"${hash}"`;
}

export function jsonWithETag(
  request: NextRequest,
  data: unknown,
  headers: Record<string, string> = {}
) {
  const etag = computeETag(data);
  const ifNoneMatch = request.headers.get('if-none-match');

  if (ifNoneMatch && ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        ...headers,
      },
    });
  }

  return NextResponse.json(data, {
    headers: {
      ETag: etag,
      ...headers,
    },
  });
}


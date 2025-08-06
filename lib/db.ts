import { createClient } from '@libsql/client';

const url = process.env.DATABASE_URL || 'file:local.db';
const authToken = process.env.DATABASE_AUTH_TOKEN;

// Create database client with optimized configuration for large queries
export const db = createClient({
  url,
  ...(authToken && { authToken }),
  // Optimize for large result sets with proper libSQL config
  syncUrl: undefined, // Disable sync for performance
  intMode: 'number', // Use numbers instead of BigInt for better performance
});

// Simple in-memory cache for API responses
const cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

export const getFromCache = (key: string) => {
  const cached = cache.get(key);
  if (!cached) return null;
  
  if (Date.now() - cached.timestamp > cached.ttl) {
    cache.delete(key);
    return null;
  }
  
  return cached.data;
};

export const setCache = (key: string, data: any, ttlSeconds: number = 300) => {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttlSeconds * 1000,
  });
};

// Clear cache periodically to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > value.ttl) {
      cache.delete(key);
    }
  }
}, 60000); // Clean every minute

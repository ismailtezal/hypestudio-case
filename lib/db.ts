import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

// PostgreSQL client for direct database operations
export const pgPool = new Pool({
  connectionString: databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Database interface that matches your existing API
export const db = {
  async execute(sql: string, params?: any[]) {
    const client = await pgPool.connect();
    try {
      const result = await client.query(sql, params);
      return {
        rows: result.rows,
        rowCount: result.rowCount,
      };
    } finally {
      client.release();
    }
  },

  async transaction() {
    const client = await pgPool.connect();
    await client.query('BEGIN');
    
    return {
      async execute(sql: string, params?: any[]) {
        const result = await client.query(sql, params);
        return {
          rows: result.rows,
          rowCount: result.rowCount,
        };
      },
      
      async commit() {
        try {
          await client.query('COMMIT');
        } finally {
          client.release();
        }
      },
      
      async rollback() {
        try {
          await client.query('ROLLBACK');
        } finally {
          client.release();
        }
      }
    };
  }
};

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

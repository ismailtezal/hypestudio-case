import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Optimized PostgreSQL connection pool for large datasets
export const pgPool = new Pool({
  connectionString: databaseUrl,
  // Increased connection pool for better concurrency
  max: 25,
  min: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // Performance optimizations for large JSONB datasets
  statement_timeout: 120000, // 2 minutes for large queries
  query_timeout: 120000,     // 2 minutes
  application_name: 'hypestudio-trade-areas',
  // Connection-level optimizations
  options: '-c default_statistics_target=1000 -c random_page_cost=1.1 -c effective_cache_size=1GB',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Enhanced database interface with prepared statements support
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

  // New method for prepared statements (better performance for repeated queries)
  async executePrepared(name: string, sql: string, params?: any[]) {
    const client = await pgPool.connect();
    try {
      // Prepare statement if not already prepared
      await client.query(`PREPARE ${name} AS ${sql}`);
      const result = await client.query(`EXECUTE ${name}(${params?.map((_, i) => `$${i + 1}`).join(',') || ''})`, params);
      return {
        rows: result.rows,
        rowCount: result.rowCount,
      };
    } catch (error) {
      // If statement already exists, just execute it
      if ((error as any).code === '42P05') {
        const result = await client.query(`EXECUTE ${name}(${params?.map((_, i) => `$${i + 1}`).join(',') || ''})`, params);
        return {
          rows: result.rows,
          rowCount: result.rowCount,
        };
      }
      throw error;
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

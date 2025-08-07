import { Pool } from 'pg';

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


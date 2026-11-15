import { Pool, PoolClient } from 'pg';
import { env } from '../config/env';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  min: env.DB_POOL_MIN,
  max: env.DB_POOL_MAX,
  connectionTimeoutMillis: env.DB_TIMEOUT_MS,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle database client', err);
});

/**
 * Execute a query with tenant context set in PostgreSQL session variable
 * This automatically activates Row Level Security (RLS) policies for app.current_org_id
 */
export async function withTenantContext<T>(
  organizationId: string,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("SELECT set_config('app.current_org_id', $1, true)", [organizationId]);
    return await callback(client);
  } finally {
    // Reset tenant context to prevent contamination in connection pool
    try {
      await client.query("SELECT set_config('app.current_org_id', '', true)");
    } catch {
      // ignore clean-up error
    }
    client.release();
  }
}

/**
 * Direct parameter query helper with standard pool
 */
export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

/**
 * Query returning single row
 */
export async function queryOne<T = any>(text: string, params: any[] = []): Promise<T | null> {
  const res = await pool.query(text, params);
  return res.rows.length > 0 ? (res.rows[0] as T) : null;
}

import fs from 'fs';
import path from 'path';
import { pool } from './pool';

export async function runMigrations() {
  console.log('[DB] Running database migrations...');
  const migrationPath = path.resolve(__dirname, '../../../database/migrations/001_initial_schema.sql');
  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration file not found at ${migrationPath}`);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('[DB] Migration 001_initial_schema.sql executed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DB] Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('[DB] Migrations finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[DB] Migration script error:', err);
      process.exit(1);
    });
}

import fs from 'fs';
import path from 'path';
import { pool } from './pool';

export async function runSeeds() {
  console.log('[DB] Running database seeds...');
  const seedPath = path.resolve(__dirname, '../../../database/seeds/001_seed_demo_data.sql');
  if (!fs.existsSync(seedPath)) {
    throw new Error(`Seed file not found at ${seedPath}`);
  }

  const sql = fs.readFileSync(seedPath, 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('[DB] Seed data inserted successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DB] Seeding failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runSeeds()
    .then(() => {
      console.log('[DB] Seed finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[DB] Seed script error:', err);
      process.exit(1);
    });
}

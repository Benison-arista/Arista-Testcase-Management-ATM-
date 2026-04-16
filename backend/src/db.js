const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 30000,
  idle_in_transaction_session_timeout: 60000,
});

pool.on('error', (err) => {
  console.error('Unexpected pool error:', err.message);
});

async function runMigrations() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');

  // Ensure tracking table exists (from 001_init or manual bootstrap)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version   TEXT PRIMARY KEY,
      name      TEXT,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Read all .sql files in order
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const version = file.replace('.sql', '');
    const { rows } = await pool.query(
      'SELECT 1 FROM schema_migrations WHERE version = $1',
      [version]
    );
    if (rows.length) continue; // already applied

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await pool.query(sql);
    await pool.query(
      'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
      [version, file]
    );
    console.log(`Migration applied: ${file}`);
  }
  console.log('All migrations up to date.');
}

module.exports = { pool, runMigrations };

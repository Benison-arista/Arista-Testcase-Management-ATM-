/**
 * Seed script: Creates the initial run_manager user.
 * Run once after migrations: node scripts/seed-admin.js
 *
 * Usage:
 *   node scripts/seed-admin.js [username] [email] [password]
 *
 * Defaults: admin / admin@atm.local / admin123
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');

async function seed() {
  const username = process.argv[2] || 'admin';
  const email    = process.argv[3] || 'admin@atm.local';
  const password = process.argv[4] || 'admin123';

  const hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, 'run_manager')
       ON CONFLICT (username) DO NOTHING
       RETURNING id, username, role`,
      [username, email, hash]
    );
    if (rows.length) {
      console.log(`Admin user created: ${rows[0].username} (id=${rows[0].id}, role=${rows[0].role})`);
    } else {
      console.log(`User "${username}" already exists.`);
    }
  } catch (err) {
    console.error('Seed failed:', err.message);
  }
  await pool.end();
}

seed();

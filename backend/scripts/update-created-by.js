/**
 * Updates the created_by field for all VeloCloud TCs using the
 * "Created By" column from the original Excel export.
 *
 * Matches TCs by qtest_id (Name_1 in the Excel, e.g. "TC-45868").
 *
 * Usage: node scripts/update-created-by.js
 */
require('dotenv').config();
const XLSX = require('xlsx');
const { pool } = require('../src/db');

const EXCEL_PATH = '/Users/benison.rajan-babu/Downloads/VEL-VeloCloud SD-WAN-Test Case-Master_list.xlsx';

async function main() {
  console.log('Reading Excel...');
  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets['Test Cases'];
  const data = XLSX.utils.sheet_to_json(ws, { defval: '' });

  // Build map: qtest_id -> Created By (first row per TC)
  const creatorMap = {};
  for (const row of data) {
    const id = row.Name_1;
    if (!id || creatorMap[id]) continue;
    const creator = row['Created By'];
    if (creator && creator !== 'string') {
      creatorMap[id] = creator;
    }
  }
  console.log('Unique TCs with creator info:', Object.keys(creatorMap).length);

  // Batch update in chunks
  const BATCH = 500;
  const entries = Object.entries(creatorMap);
  let updated = 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (let i = 0; i < entries.length; i += BATCH) {
      const chunk = entries.slice(i, i + BATCH);

      for (const [qtestId, creator] of chunk) {
        const { rowCount } = await client.query(
          "UPDATE testcases SET created_by = $1 WHERE section = 'velocloud' AND data->>'qtest_id' = $2",
          [creator, qtestId]
        );
        updated += rowCount;
      }

      process.stdout.write('\r  Updated: ' + updated + ' TCs (' + Math.min(i + BATCH, entries.length) + '/' + entries.length + ' processed)');
    }

    await client.query('COMMIT');
    console.log('\n\nDone. Updated ' + updated + ' test cases.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\nFailed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();

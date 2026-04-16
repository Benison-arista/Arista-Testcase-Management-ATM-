/**
 * Import VeloCloud test cases from the qTest Excel export.
 *
 * Rules:
 *  1. Column "Module" (stripped of "MD-XXXX " prefix) = parent folder
 *  2. Column "Section" = sub-folder under the parent
 *  3. If Module value is empty, Section itself becomes the folder
 *  4. Dataplane modules get organized into sub-folders mirroring the
 *     hapy/scale/data_plane directory structure
 *  5. Multiple rows per TC (test steps) are merged into one TC record
 *
 * Usage:
 *   node scripts/import-velocloud-excel.js [path-to-xlsx]
 */
require('dotenv').config();
const XLSX = require('xlsx');
const { pool } = require('../src/db');

const EXCEL_PATH = process.argv[2] ||
  '/Users/benison.rajan-babu/Downloads/VEL-VeloCloud SD-WAN-Test Case-Master_list.xlsx';
const SECTION = 'velocloud';
const BATCH_SIZE = 500;

// Dataplane sub-folder mapping based on hapy/scale/data_plane directory
const DATAPLANE_SUBFOLDER_MAP = {
  'DataPlane':                       'DataPlane',
  'Data Plane interop':              'DataPlane/Interop',
  'DataplaneScalability':            'DataPlane/Scalability',
  'Archived_DataplaneScale':         'DataPlane/Scalability/Archived',
  'StatefulFirewallDataplane':       'DataPlane/Feature Scale/Firewall',
  'SecondaryVLANIP - Dataplane':     'DataPlane/Feature Scale/Device Settings',
  'IPv6 green field Data Plane upgrade': 'DataPlane/Interop/IPv6 Upgrade',
  'Checkpoint-VNF-Dataplane':        'DataPlane/VNF/Checkpoint',
  'Fortinet-VNF-Dataplane':          'DataPlane/VNF/Fortinet',
  'PAN-VNF-Dataplane':               'DataPlane/VNF/PAN',
};

function isDataplaneModule(modName) {
  const lower = modName.toLowerCase();
  return lower.includes('dataplane') || lower.includes('data plane') || lower.includes('data_plane');
}

/**
 * Determine the folder path [parent, child] for a row.
 * Returns an array of path segments, e.g. ['BGP', 'BGP'] or ['DataPlane', 'Interop']
 */
function getFolderPath(moduleName, sectionName) {
  // Strip MD-XXXX prefix
  const mod = moduleName.replace(/^MD-\d+\s+/, '').trim();
  const sec = sectionName.trim();

  // Rule 3: empty module -> section is the folder
  if (!mod) {
    return sec ? [sec] : ['Uncategorized'];
  }

  // Rule 4: Dataplane modules get special sub-folder mapping
  if (isDataplaneModule(mod)) {
    const mapped = DATAPLANE_SUBFOLDER_MAP[mod];
    if (mapped) {
      const parts = mapped.split('/');
      // If section differs from module and is meaningful, add as leaf
      if (sec && sec !== mod && sec !== 'string' && sec !== '(empty)') {
        parts.push(sec);
      }
      return parts;
    }
    // Unmapped dataplane module: DataPlane / <module name>
    const parts = ['DataPlane', mod];
    if (sec && sec !== mod && sec !== 'string') {
      parts.push(sec);
    }
    return parts;
  }

  // Rules 1 & 2: Module is parent, Section is child
  // Skip section if it's same as module, empty, or "string" (junk value)
  if (!sec || sec === mod || sec === 'string') {
    return [mod];
  }
  return [mod, sec];
}

/**
 * Merge multiple rows (test steps) for the same TC into one record.
 */
function mergeTestSteps(rows) {
  const first = rows[0];
  let testSteps = '';
  let expectedResult = '';

  if (rows.length > 1) {
    testSteps = rows
      .sort((a, b) => (a['Test Step #'] || 0) - (b['Test Step #'] || 0))
      .map(r => 'Step ' + r['Test Step #'] + ': ' + (r['Test Step Description'] || ''))
      .join('\n\n');
    expectedResult = rows
      .map(r => r['Test Step Expected Result'] || '')
      .filter(Boolean)
      .join('\n\n');
  } else {
    testSteps = first['Test Step Description'] || '';
    expectedResult = first['Test Step Expected Result'] || '';
  }

  return {
    title: first['Name'] || '',
    qtest_id: first['Name_1'] || '',
    description: first['Description'] || '',
    precondition: first['Precondition'] || '',
    test_steps: testSteps,
    expected_result: expectedResult,
    priority: first['Priority'] || '',
    testrail_id: first['TestRail Id'] || '',
    automatable_call: first['Automatable Call'] || '',
    automated_by: first['Automated By'] || '',
    automation_status: first['Automation Status'] || '',
    blocked_by: first['Blocked By'] || '',
    customer_found: first['Customer Found'] === 'Yes',
    milestone: first['Milestone'] || '',
    module: first['Module'].replace(/^MD-\d+\s+/, '').trim() || '',
    jira_defect: first['Jira Defect'] || '',
    section: first['Section'] || '',
    template: first['Template'] || '',
    hardware_platforms: first['Hardware Platforms'] || '',
    pillar: first['Pillar'] || '',
    state: first['State'] || '',
  };
}

async function ensureFolderPath(client, pathParts, sectionValue, folderCache) {
  let parentId = null;
  let currentPath = '';

  for (const part of pathParts) {
    currentPath += '/' + part;
    const cacheKey = currentPath;

    if (folderCache[cacheKey]) {
      parentId = folderCache[cacheKey];
      continue;
    }

    // Check if folder exists
    const { rows: existing } = await client.query(
      'SELECT id FROM folders WHERE name = $1 AND section = $2 AND ' +
      (parentId ? 'parent_id = $3' : 'parent_id IS NULL'),
      parentId ? [part, sectionValue, parentId] : [part, sectionValue]
    );

    if (existing.length) {
      folderCache[cacheKey] = existing[0].id;
      parentId = existing[0].id;
    } else {
      const { rows: created } = await client.query(
        'INSERT INTO folders (name, parent_id, section) VALUES ($1, $2, $3) RETURNING id',
        [part, parentId, sectionValue]
      );
      folderCache[cacheKey] = created[0].id;
      parentId = created[0].id;
    }
  }

  return parentId;
}

async function main() {
  console.log('Reading Excel file...');
  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets['Test Cases'];
  const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
  console.log('Total rows:', data.length);

  // Group rows by TC ID (Name_1) to merge test steps
  console.log('Grouping test steps...');
  const tcGroups = {};
  for (const row of data) {
    const id = row.Name_1;
    if (!id) continue;
    if (!tcGroups[id]) tcGroups[id] = { rows: [], module: row.Module, section: row.Section };
    tcGroups[id].rows.push(row);
  }
  const tcIds = Object.keys(tcGroups);
  console.log('Unique test cases:', tcIds.length);

  // Merge test steps and compute folder paths
  console.log('Merging test steps and computing folder paths...');
  const tcRecords = [];
  for (const id of tcIds) {
    const { rows, module, section: sec } = tcGroups[id];
    const tcData = mergeTestSteps(rows);
    const folderPath = getFolderPath(module, sec);
    tcRecords.push({ tcData, folderPath });
  }

  // Group by folder path for batch processing
  const byFolder = {};
  for (const rec of tcRecords) {
    const pathKey = rec.folderPath.join('/');
    if (!byFolder[pathKey]) byFolder[pathKey] = { path: rec.folderPath, tcs: [] };
    byFolder[pathKey].tcs.push(rec.tcData);
  }
  const folderPaths = Object.keys(byFolder);
  console.log('Unique folder paths:', folderPaths.length);

  // Import into database
  const client = await pool.connect();
  const folderCache = {};
  let totalImported = 0;
  let totalFolders = 0;

  try {
    await client.query('BEGIN');

    // Get user ID for created_by (use admin user)
    const { rows: users } = await client.query(
      "SELECT id, username FROM users WHERE role = 'run_manager' LIMIT 1"
    );
    const userId = users[0]?.id || 1;
    const username = users[0]?.username || 'admin';

    console.log('Importing as user:', username);
    console.log('');

    for (let fi = 0; fi < folderPaths.length; fi++) {
      const pathKey = folderPaths[fi];
      const { path, tcs } = byFolder[pathKey];

      // Create folder hierarchy
      const folderId = await ensureFolderPath(client, path, SECTION, folderCache);
      totalFolders = Object.keys(folderCache).length;

      // Batch insert TCs
      for (let i = 0; i < tcs.length; i += BATCH_SIZE) {
        const chunk = tcs.slice(i, i + BATCH_SIZE);

        const values = [];
        const params = [];
        chunk.forEach((data, j) => {
          const off = j * 5;
          values.push('($' + (off + 1) + ', $' + (off + 2) + ', $' + (off + 3) + ', $' + (off + 4) + ', $' + (off + 5) + ')');
          params.push(folderId, SECTION, JSON.stringify(data), username, userId);
        });

        const { rows: inserted } = await client.query(
          'INSERT INTO testcases (folder_id, section, data, created_by, created_by_id) ' +
          'VALUES ' + values.join(', ') + ' RETURNING id',
          params
        );

        // Batch insert history
        const histValues = [];
        const histParams = [];
        inserted.forEach((tc, j) => {
          const off = j * 4;
          histValues.push('($' + (off + 1) + ', $' + (off + 2) + ', $' + (off + 3) + ', $' + (off + 4) + ')');
          histParams.push(tc.id, JSON.stringify(chunk[j]), username, userId);
        });

        await client.query(
          'INSERT INTO testcase_history (testcase_id, data, changed_by, changed_by_id) ' +
          'VALUES ' + histValues.join(', '),
          histParams
        );

        totalImported += inserted.length;
      }

      // Progress indicator
      if ((fi + 1) % 100 === 0 || fi === folderPaths.length - 1) {
        process.stdout.write('\r  Folders: ' + (fi + 1) + '/' + folderPaths.length +
          '  TCs: ' + totalImported + '/' + tcIds.length);
      }
    }

    await client.query('COMMIT');
    console.log('\n');
    console.log('=== Import Complete ===');
    console.log('Folders created:', totalFolders);
    console.log('Test cases imported:', totalImported);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\nImport failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();

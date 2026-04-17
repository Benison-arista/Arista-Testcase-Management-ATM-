/**
 * Reorganize VeloCloud TCs into the correct folder structure.
 *
 * Uses the 2nd Module column (Module_1 in parsed data) as the parent folder,
 * and Section as the sub-folder.
 *
 * If Module_1 is empty: places under Unorganized/<1st Module stripped>.
 *
 * Maps modules to hapy directory structure:
 *   - Data Plane modules → DataPlane/...
 *   - VCO-* modules → Management Plane/...
 *   - Platform → Platform/...
 *   - Routing, VPN, Firewall, etc. → DataPlane/Feature Scale/...
 *   - Upgrade, Interop → Interop & Upgrade/...
 *   - Performance, Stress → Performance & Stress/...
 *
 * Usage: node scripts/reorganize-folders.js
 */
require('dotenv').config();
const XLSX = require('xlsx');
const { pool } = require('../src/db');

const EXCEL_PATH = '/Users/benison.rajan-babu/Downloads/VEL-VeloCloud SD-WAN-Test Case-Master_list.xlsx';
const SECTION = 'velocloud';

// Map 2nd Module values to hapy-inspired top-level folders
const MODULE_TO_FOLDER = {
  // DataPlane area (hapy/scale/data_plane)
  'Device settings':     ['DataPlane', 'Device Settings'],
  'Routing':             ['DataPlane', 'Routing'],
  'VPN':                 ['DataPlane', 'VPN'],
  'High availability':   ['DataPlane', 'High Availability'],
  'Firewall':            ['DataPlane', 'Firewall'],
  'Business policy':     ['DataPlane', 'Business Policy'],
  'QoS':                 ['DataPlane', 'QoS'],
  'Wan overlay':         ['DataPlane', 'WAN Overlay'],
  'Partner gateway':     ['DataPlane', 'Partner Gateway'],
  'Application map':     ['DataPlane', 'Application Map'],
  'VCMP':                ['DataPlane', 'VCMP'],
  'Customer Topology':   ['DataPlane', 'Customer Topology'],
  'NVS':                 ['DataPlane', 'NVS'],
  'USB Modem':           ['DataPlane', 'USB Modem'],
  'SFP testing':         ['DataPlane', 'SFP Testing'],
  'MGD':                 ['DataPlane', 'MGD'],

  // Management Plane area (hapy/management_plane)
  'VCO - UI':                      ['Management Plane', 'UI'],
  'VCO - Monitoring':              ['Management Plane', 'Monitoring'],
  'VCO - Configuration Management': ['Management Plane', 'Configuration Management'],
  'VCO - IPV6':                    ['Management Plane', 'IPv6'],
  'VCO - Device Settings':         ['Management Plane', 'Device Settings'],
  'VCO - Security':                ['Management Plane', 'Security'],
  'VCO - API':                     ['Management Plane', 'API'],
  'VCO - Reporting':               ['Management Plane', 'Reporting'],
  'VCO - Cloud Services':          ['Management Plane', 'Cloud Services'],
  'VCO - Edge Activation':         ['Management Plane', 'Edge Activation'],
  'VCO - DR':                      ['Management Plane', 'DR'],
  'VCO - Gateway Management':      ['Management Plane', 'Gateway Management'],
  'VCO - Analytics':               ['Management Plane', 'Analytics'],
  'VCO - Validation':              ['Management Plane', 'Validation'],
  'VCO - Flow Stats':              ['Management Plane', 'Flow Stats'],
  'VCO - Infrastructure':          ['Management Plane', 'Infrastructure'],

  // Interop & Upgrade (hapy/interop_upgrade)
  'Upgrade':             ['Interop & Upgrade', 'Upgrade'],
  'Interop':             ['Interop & Upgrade', 'Interop'],
  'Factory Image Upgrade': ['Interop & Upgrade', 'Factory Image Upgrade'],

  // Platform (hapy/velocloud_platform)
  'Platform':            ['Platform'],
  'Security':            ['Platform', 'Security'],

  // VNF
  'VNF':                 ['DataPlane', 'VNF'],

  // Performance & Stress
  'Stress':              ['Performance & Stress', 'Stress'],
};

function getFolderPath(module1, module2, section) {
  const mod2 = (module2 || '').trim();
  const sec = (section || '').trim();
  const mod1Stripped = (module1 || '').replace(/^MD-\d+\s+/, '').trim();

  // Rule: Module_1 is empty → Unorganized/<1st Module stripped>
  if (!mod2) {
    if (mod1Stripped) {
      return ['Unorganized', mod1Stripped];
    }
    return sec ? ['Unorganized', sec] : ['Unorganized'];
  }

  // Look up mapping
  const mapped = MODULE_TO_FOLDER[mod2];
  if (mapped) {
    // Add section as leaf if meaningful
    if (sec && sec !== mod2 && sec !== 'string' && sec !== 'DataPlane') {
      return [...mapped, sec];
    }
    return mapped;
  }

  // Fallback: use Module_1 as parent, Section as child
  if (sec && sec !== mod2 && sec !== 'string') {
    return [mod2, sec];
  }
  return [mod2];
}

async function ensureFolderPath(client, pathParts, folderCache) {
  let parentId = null;
  let currentPath = '';

  for (const part of pathParts) {
    currentPath += '/' + part;
    if (folderCache[currentPath]) {
      parentId = folderCache[currentPath];
      continue;
    }

    const { rows: existing } = await client.query(
      'SELECT id FROM folders WHERE name = $1 AND section = $2 AND ' +
      (parentId ? 'parent_id = $3' : 'parent_id IS NULL'),
      parentId ? [part, SECTION, parentId] : [part, SECTION]
    );

    if (existing.length) {
      folderCache[currentPath] = existing[0].id;
      parentId = existing[0].id;
    } else {
      const { rows: created } = await client.query(
        'INSERT INTO folders (name, parent_id, section) VALUES ($1, $2, $3) RETURNING id',
        [part, parentId, SECTION]
      );
      folderCache[currentPath] = created[0].id;
      parentId = created[0].id;
    }
  }
  return parentId;
}

async function main() {
  const startTime = Date.now();
  console.log('Reading Excel...');
  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets['Test Cases'];
  const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
  console.log('Total rows:', data.length);

  // Group by TC ID (Name_1), take first row per TC
  const tcMap = {};
  for (const row of data) {
    const id = row.Name_1;
    if (!id || tcMap[id]) continue;
    tcMap[id] = {
      qtestId: id,
      module1: row.Module,
      module2: row.Module_1,
      section: row.Section,
    };
  }
  const tcIds = Object.keys(tcMap);
  console.log('Unique TCs:', tcIds.length);

  // Compute folder path for each TC
  const tcFolders = {};
  for (const id of tcIds) {
    const { module1, module2, section } = tcMap[id];
    tcFolders[id] = getFolderPath(module1, module2, section);
  }

  // Count folder distribution
  const folderCounts = {};
  for (const path of Object.values(tcFolders)) {
    const key = path[0];
    folderCounts[key] = (folderCounts[key] || 0) + 1;
  }
  console.log('\nTop-level folder distribution:');
  Object.entries(folderCounts).sort((a,b) => b[1] - a[1]).forEach(([name, count]) => {
    console.log('  ' + name + ': ' + count + ' TCs');
  });

  const client = await pool.connect();
  // Remove statement timeout for this long-running script
  await client.query('SET statement_timeout = 0');
  const folderCache = {};
  let moved = 0;
  let notFound = 0;
  let lastReport = Date.now();

  try {
    // Create all folders first in one transaction
    console.log('\nCreating folder structure...');
    await client.query('BEGIN');
    const folderIds = {};
    for (let i = 0; i < tcIds.length; i++) {
      const path = tcFolders[tcIds[i]];
      const pathKey = path.join('/');
      if (!folderIds[pathKey]) {
        folderIds[pathKey] = await ensureFolderPath(client, path, folderCache);
      }
    }
    await client.query('COMMIT');
    console.log('Created ' + Object.keys(folderCache).length + ' folders');

    // Move TCs in batches using autocommit (no single huge transaction)
    console.log('\nMoving TCs to new folders...');

    for (let i = 0; i < tcIds.length; i++) {
      const qtestId = tcIds[i];
      const pathKey = tcFolders[qtestId].join('/');
      const folderId = folderIds[pathKey];

      const { rowCount } = await client.query(
        "UPDATE testcases SET folder_id = $1 WHERE section = $2 AND data->>'qtest_id' = $3",
        [folderId, SECTION, qtestId]
      );

      if (rowCount > 0) moved += rowCount;
      else notFound++;

      // Progress report every 2 minutes
      const now = Date.now();
      if (now - lastReport >= 120000 || i === tcIds.length - 1) {
        const elapsed = Math.round((now - startTime) / 1000);
        const pct = Math.round(((i + 1) / tcIds.length) * 100);
        console.log(
          '  [' + elapsed + 's] ' + (i + 1) + '/' + tcIds.length +
          ' (' + pct + '%) — ' + moved + ' TCs moved, ' +
          Object.keys(folderCache).length + ' folders'
        );
        lastReport = now;
      }
    }

    // Delete old empty folders
    console.log('\nCleaning up empty folders...');
    const { rowCount: deleted } = await client.query(
      "DELETE FROM folders WHERE section = $1 AND id NOT IN (SELECT DISTINCT folder_id FROM testcases WHERE folder_id IS NOT NULL) AND id NOT IN (SELECT DISTINCT parent_id FROM folders WHERE parent_id IS NOT NULL)",
      [SECTION]
    );
    console.log('Removed ' + deleted + ' empty folders');

    const totalTime = Math.round((Date.now() - startTime) / 1000);
    console.log('\n=== Reorganization Complete ===');
    console.log('TCs moved: ' + moved);
    console.log('TCs not found in DB: ' + notFound);
    console.log('Folders created: ' + Object.keys(folderCache).length);
    console.log('Time: ' + totalTime + 's');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\nFailed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();

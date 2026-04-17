const { pool } = require('../db');

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit) || DEFAULT_LIMIT));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function paginatedResponse(rows, total, { page, limit }) {
  return {
    data: rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// --- Run Folders ---

async function getRunFolderTree(req, res, next) {
  try {
    const { rows } = await pool.query(
      `WITH RECURSIVE tree AS (
         SELECT id, name, parent_id, created_by, created_at
         FROM run_folders WHERE parent_id IS NULL
         UNION ALL
         SELECT f.id, f.name, f.parent_id, f.created_by, f.created_at
         FROM run_folders f JOIN tree t ON f.parent_id = t.id
       )
       SELECT * FROM tree ORDER BY name LIMIT 1000`
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function createRunFolder(req, res, next) {
  const { name, parent_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const username = req.user.username;
  const userId = req.user.id;
  try {
    const { rows } = await pool.query(
      `INSERT INTO run_folders (name, parent_id, created_by, created_by_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, parent_id || null, username, userId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A run folder with this name already exists in the same parent' });
    }
    next(err);
  }
}

async function deleteRunFolder(req, res, next) {
  try {
    await pool.query('DELETE FROM run_folders WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch (err) { next(err); }
}

// --- Test Run Items ---

async function getRunItems(req, res, next) {
  const { run_folder_id } = req.query;
  if (!run_folder_id) return res.status(400).json({ error: 'run_folder_id is required' });
  const { page, limit, offset } = parsePagination(req.query);
  try {
    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(
        `SELECT tr.*, tc.section, tc.data, tc.created_by AS tc_created_by
         FROM test_runs tr
         JOIN testcases tc ON tc.id = tr.testcase_id
         WHERE tr.run_folder_id = $1
         ORDER BY tr.id
         LIMIT $2 OFFSET $3`,
        [run_folder_id, limit, offset]
      ),
      pool.query(
        'SELECT COUNT(*)::int AS total FROM test_runs WHERE run_folder_id = $1',
        [run_folder_id]
      ),
    ]);
    res.json(paginatedResponse(rows, countRows[0].total, { page, limit }));
  } catch (err) { next(err); }
}

async function addRunItem(req, res, next) {
  const { run_folder_id, testcase_id } = req.body;
  if (!run_folder_id || !testcase_id) {
    return res.status(400).json({ error: 'run_folder_id and testcase_id are required' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO test_runs (run_folder_id, testcase_id) VALUES ($1, $2) RETURNING *',
      [run_folder_id, testcase_id]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

async function updateRunItem(req, res, next) {
  const { status, version, bugs, comments, lock_version } = req.body;
  const { id } = req.params;
  const username = req.user.username;
  const userId = req.user.id;
  try {
    let query, params;
    if (lock_version != null) {
      query = `UPDATE test_runs
               SET status = COALESCE($1, status),
                   version = COALESCE($2, version),
                   bugs = COALESCE($3, bugs),
                   comments = COALESCE($4, comments),
                   executed_by = $5,
                   executed_by_id = $6,
                   executed_at = NOW(),
                   lock_version = lock_version + 1
               WHERE id = $7 AND lock_version = $8 RETURNING *`;
      params = [status, version, bugs, comments, username, userId, id, lock_version];
    } else {
      query = `UPDATE test_runs
               SET status = COALESCE($1, status),
                   version = COALESCE($2, version),
                   bugs = COALESCE($3, bugs),
                   comments = COALESCE($4, comments),
                   executed_by = $5,
                   executed_by_id = $6,
                   executed_at = NOW(),
                   lock_version = lock_version + 1
               WHERE id = $7 RETURNING *`;
      params = [status, version, bugs, comments, username, userId, id];
    }
    const { rows } = await pool.query(query, params);
    if (!rows.length) {
      if (lock_version != null) {
        return res.status(409).json({ error: 'Conflict: this run item was modified by another user. Please refresh.' });
      }
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function deleteRunItem(req, res, next) {
  try {
    await pool.query('DELETE FROM test_runs WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch (err) { next(err); }
}

// --- Release-based runs ---

// Get releases tree with features as children (read-only for runs tab)
async function getReleasesWithFeatures(req, res, next) {
  try {
    const { rows: releases } = await pool.query(
      'SELECT id, name, parent_id, status, target_date FROM releases ORDER BY name'
    );
    const { rows: features } = await pool.query(
      'SELECT id, name, release_id, status, priority FROM features ORDER BY name'
    );
    res.json({ releases, features });
  } catch (err) { next(err); }
}

// Get run items by release_id (optionally filtered by feature_id)
async function getRunsByRelease(req, res, next) {
  const { release_id, feature_id } = req.query;
  if (!release_id) return res.status(400).json({ error: 'release_id is required' });
  const { page, limit, offset } = parsePagination(req.query);
  try {
    let where = 'tr.release_id = $1';
    const params = [release_id];
    if (feature_id) {
      params.push(feature_id);
      where += ` AND tr.feature_id = $${params.length}`;
    }
    const countParams = [...params];
    params.push(limit, offset);

    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(
        `SELECT tr.*, tc.section, tc.data, tc.created_by AS tc_created_by
         FROM test_runs tr
         JOIN testcases tc ON tc.id = tr.testcase_id
         WHERE ${where}
         ORDER BY tr.id
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total FROM test_runs WHERE ${where.replace(/tr\./g, '')}`,
        countParams
      ),
    ]);
    res.json(paginatedResponse(rows, countRows[0].total, { page, limit }));
  } catch (err) { next(err); }
}

// Add TCs to a release (optionally linked to a feature)
async function addRunToRelease(req, res, next) {
  const { release_id, feature_id, testcase_ids } = req.body;
  if (!release_id || !testcase_ids?.length) {
    return res.status(400).json({ error: 'release_id and testcase_ids are required' });
  }
  try {
    const values = [];
    const params = [];
    testcase_ids.forEach((tcId, i) => {
      const off = i * 3;
      values.push(`($${off+1}, $${off+2}, $${off+3})`);
      params.push(release_id, feature_id || null, tcId);
    });
    const { rows } = await pool.query(
      `INSERT INTO test_runs (release_id, feature_id, testcase_id) VALUES ${values.join(', ')} RETURNING *`,
      params
    );
    res.status(201).json({ added: rows.length });
  } catch (err) { next(err); }
}

// Get TCs from a folder (for folder-select in modal)
async function getTCsByFolder(req, res, next) {
  const { folder_id, section } = req.query;
  if (!folder_id) return res.status(400).json({ error: 'folder_id is required' });
  try {
    // Get TCs from this folder and all sub-folders
    const { rows } = await pool.query(
      `WITH RECURSIVE sub AS (
         SELECT id FROM folders WHERE id = $1
         UNION ALL
         SELECT f.id FROM folders f JOIN sub s ON f.parent_id = s.id
       )
       SELECT t.id, t.data, t.section, t.folder_id
       FROM testcases t
       WHERE t.folder_id IN (SELECT id FROM sub)
       ${section ? 'AND t.section = $2' : ''}
       ORDER BY t.id LIMIT 500`,
      section ? [folder_id, section] : [folder_id]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// Release run summary
async function getReleaseRunSummary(req, res, next) {
  const { release_id, feature_id } = req.query;
  if (!release_id) return res.status(400).json({ error: 'release_id is required' });
  try {
    let where = 'release_id = $1';
    const params = [release_id];
    if (feature_id) {
      params.push(feature_id);
      where += ` AND feature_id = $${params.length}`;
    }
    const { rows } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pass')    AS pass,
         COUNT(*) FILTER (WHERE status = 'fail')    AS fail,
         COUNT(*) FILTER (WHERE status = 'blocked') AS blocked,
         COUNT(*) FILTER (WHERE status = 'pending') AS pending,
         COUNT(*) AS total
       FROM test_runs WHERE ${where}`,
      params
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
}

// --- Named test runs under a release ---

async function getTestRunsByRelease(req, res, next) {
  const { release_id } = req.query;
  if (!release_id) return res.status(400).json({ error: 'release_id is required' });
  try {
    // Get manually created test runs (from run_folders)
    const { rows: manualRuns } = await pool.query(
      `SELECT rf.id, rf.name, rf.release_id, rf.created_by, rf.created_at, 'manual' AS source,
         (SELECT COUNT(*)::int FROM test_runs WHERE run_folder_id = rf.id) AS total,
         (SELECT COUNT(*)::int FROM test_runs WHERE run_folder_id = rf.id AND status = 'pass') AS pass,
         (SELECT COUNT(*)::int FROM test_runs WHERE run_folder_id = rf.id AND status = 'fail') AS fail,
         (SELECT COUNT(*)::int FROM test_runs WHERE run_folder_id = rf.id AND status = 'blocked') AS blocked,
         (SELECT COUNT(*)::int FROM test_runs WHERE run_folder_id = rf.id AND status = 'pending') AS pending
       FROM run_folders rf
       WHERE rf.release_id = $1
       ORDER BY rf.created_at DESC`,
      [release_id]
    );

    // Get feature-based test runs (each feature = a test run)
    const { rows: featureRuns } = await pool.query(
      `SELECT f.id, f.name, f.release_id, f.status AS feature_status, f.priority, f.created_by, f.created_at, 'feature' AS source,
         (SELECT COUNT(*)::int FROM test_runs WHERE release_id = $1 AND feature_id = f.id) AS total,
         (SELECT COUNT(*)::int FROM test_runs WHERE release_id = $1 AND feature_id = f.id AND status = 'pass') AS pass,
         (SELECT COUNT(*)::int FROM test_runs WHERE release_id = $1 AND feature_id = f.id AND status = 'fail') AS fail,
         (SELECT COUNT(*)::int FROM test_runs WHERE release_id = $1 AND feature_id = f.id AND status = 'blocked') AS blocked,
         (SELECT COUNT(*)::int FROM test_runs WHERE release_id = $1 AND feature_id = f.id AND status = 'pending') AS pending
       FROM features f
       WHERE f.release_id = $1
       ORDER BY f.created_at DESC`,
      [release_id]
    );

    res.json({ manualRuns, featureRuns });
  } catch (err) { next(err); }
}

async function createTestRun(req, res, next) {
  const { name, release_id } = req.body;
  if (!name || !release_id) return res.status(400).json({ error: 'name and release_id are required' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO run_folders (name, release_id, created_by) VALUES ($1, $2, $3) RETURNING *',
      [name, release_id, req.user.username]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

// --- Report ---

async function getReport(req, res, next) {
  const { run_folder_id } = req.query;
  if (!run_folder_id) return res.status(400).json({ error: 'run_folder_id is required' });
  try {
    // Summary counts + detailed rows in parallel
    const [{ rows: summary }, { rows: details }] = await Promise.all([
      pool.query(
        `WITH RECURSIVE sub AS (
           SELECT id FROM run_folders WHERE id = $1
           UNION ALL
           SELECT rf.id FROM run_folders rf JOIN sub s ON rf.parent_id = s.id
         )
         SELECT
           COUNT(*) FILTER (WHERE status = 'pass')    AS pass,
           COUNT(*) FILTER (WHERE status = 'fail')    AS fail,
           COUNT(*) FILTER (WHERE status = 'blocked') AS blocked,
           COUNT(*) FILTER (WHERE status = 'pending') AS pending,
           COUNT(*) AS total
         FROM test_runs
         WHERE run_folder_id IN (SELECT id FROM sub)`,
        [run_folder_id]
      ),
      pool.query(
        `WITH RECURSIVE sub AS (
           SELECT id, name FROM run_folders WHERE id = $1
           UNION ALL
           SELECT rf.id, rf.name FROM run_folders rf JOIN sub s ON rf.parent_id = s.id
         )
         SELECT tr.*, rf.name AS run_folder_name, tc.section, tc.data
         FROM test_runs tr
         JOIN run_folders rf ON rf.id = tr.run_folder_id
         JOIN testcases tc ON tc.id = tr.testcase_id
         WHERE tr.run_folder_id IN (SELECT id FROM sub)
         ORDER BY rf.name, tr.id
         LIMIT 1000`,
        [run_folder_id]
      ),
    ]);

    res.json({ summary: summary[0], details });
  } catch (err) { next(err); }
}

module.exports = {
  getRunFolderTree, createRunFolder, deleteRunFolder,
  getRunItems, addRunItem, updateRunItem, deleteRunItem,
  getReport,
  getReleasesWithFeatures, getRunsByRelease, addRunToRelease, getTCsByFolder, getReleaseRunSummary,
  getTestRunsByRelease, createTestRun,
};

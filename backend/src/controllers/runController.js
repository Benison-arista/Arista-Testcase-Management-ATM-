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
};

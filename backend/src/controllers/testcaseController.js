const { pool } = require('../db');

// Pagination defaults
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
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function listTestcases(req, res, next) {
  const { folder_id, section } = req.query;
  const { page, limit, offset } = parsePagination(req.query);
  try {
    let where = 'WHERE 1=1';
    const params = [];
    if (folder_id) { params.push(folder_id); where += ` AND folder_id = $${params.length}`; }
    if (section)   { params.push(section);   where += ` AND section = $${params.length}`; }

    const countParams = [...params];
    params.push(limit, offset);

    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(`SELECT * FROM testcases ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params),
      pool.query(`SELECT COUNT(*)::int AS total FROM testcases ${where}`, countParams),
    ]);
    res.json(paginatedResponse(rows, countRows[0].total, { page, limit }));
  } catch (err) { next(err); }
}

async function getTestcase(req, res, next) {
  try {
    const { rows } = await pool.query('SELECT * FROM testcases WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function searchTestcases(req, res, next) {
  const { q, section } = req.query;
  if (!q) return res.status(400).json({ error: 'q is required' });
  const { page, limit, offset } = parsePagination(req.query);
  try {
    const params = [`%${q}%`];
    let sectionClause = '';
    if (section) { params.push(section); sectionClause = ` AND section = $${params.length}`; }

    const countParams = [...params];
    params.push(limit, offset);

    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(
        `SELECT * FROM testcases WHERE data::text ILIKE $1${sectionClause} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total FROM testcases WHERE data::text ILIKE $1${sectionClause}`,
        countParams
      ),
    ]);
    res.json(paginatedResponse(rows, countRows[0].total, { page, limit }));
  } catch (err) { next(err); }
}

async function createTestcase(req, res, next) {
  const { folder_id, section, data } = req.body;
  if (!section || !data) {
    return res.status(400).json({ error: 'section and data are required' });
  }
  const userId = req.user.id;
  const username = req.user.username;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO testcases (folder_id, section, data, created_by, created_by_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [folder_id || null, section, data, username, userId]
    );
    const tc = rows[0];
    await client.query(
      `INSERT INTO testcase_history (testcase_id, data, changed_by, changed_by_id)
       VALUES ($1, $2, $3, $4)`,
      [tc.id, data, username, userId]
    );
    await client.query('COMMIT');
    res.status(201).json(tc);
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
}

async function updateTestcase(req, res, next) {
  const { data, folder_id, version } = req.body;
  const { id } = req.params;
  if (!data) {
    return res.status(400).json({ error: 'data is required' });
  }
  const userId = req.user.id;
  const username = req.user.username;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Optimistic locking: if version is provided, require it to match
    let query, params;
    if (version != null) {
      query = `UPDATE testcases
               SET data = $1, last_edited_by = $2, last_edited_by_id = $3,
                   last_edited_at = NOW(), folder_id = COALESCE($4, folder_id), version = version + 1
               WHERE id = $5 AND version = $6 RETURNING *`;
      params = [data, username, userId, folder_id || null, id, version];
    } else {
      query = `UPDATE testcases
               SET data = $1, last_edited_by = $2, last_edited_by_id = $3,
                   last_edited_at = NOW(), folder_id = COALESCE($4, folder_id), version = version + 1
               WHERE id = $5 RETURNING *`;
      params = [data, username, userId, folder_id || null, id];
    }

    const { rows } = await client.query(query, params);
    if (!rows.length) {
      await client.query('ROLLBACK');
      if (version != null) {
        return res.status(409).json({ error: 'Conflict: this test case was modified by another user. Please refresh and try again.' });
      }
      return res.status(404).json({ error: 'Not found' });
    }
    await client.query(
      `INSERT INTO testcase_history (testcase_id, data, changed_by, changed_by_id)
       VALUES ($1, $2, $3, $4)`,
      [id, data, username, userId]
    );
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
}

async function deleteTestcase(req, res, next) {
  try {
    await pool.query('DELETE FROM testcases WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch (err) { next(err); }
}

async function importTestcases(req, res, next) {
  const { rows: tcRows, section, folder_id } = req.body;
  if (!tcRows?.length || !section) {
    return res.status(400).json({ error: 'rows and section are required' });
  }
  const userId = req.user.id;
  const username = req.user.username;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Batch insert in chunks of 500 to stay within parameter limits
    const CHUNK_SIZE = 500;
    const allInserted = [];
    for (let i = 0; i < tcRows.length; i += CHUNK_SIZE) {
      const chunk = tcRows.slice(i, i + CHUNK_SIZE);

      // Build multi-value INSERT for testcases
      const tcValues = [];
      const tcParams = [];
      chunk.forEach((data, j) => {
        const off = j * 5;
        tcValues.push(`($${off+1}, $${off+2}, $${off+3}, $${off+4}, $${off+5})`);
        tcParams.push(folder_id || null, section, JSON.stringify(data), username, userId);
      });

      const { rows: inserted } = await client.query(
        `INSERT INTO testcases (folder_id, section, data, created_by, created_by_id)
         VALUES ${tcValues.join(', ')} RETURNING *`,
        tcParams
      );

      // Batch insert history records
      const histValues = [];
      const histParams = [];
      inserted.forEach((tc, j) => {
        const off = j * 4;
        histValues.push(`($${off+1}, $${off+2}, $${off+3}, $${off+4})`);
        histParams.push(tc.id, JSON.stringify(tc.data), username, userId);
      });

      await client.query(
        `INSERT INTO testcase_history (testcase_id, data, changed_by, changed_by_id)
         VALUES ${histValues.join(', ')}`,
        histParams
      );

      allInserted.push(...inserted);
    }

    await client.query('COMMIT');
    res.status(201).json({ imported: allInserted.length });
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
}

async function getHistory(req, res, next) {
  const { page, limit, offset } = parsePagination(req.query);
  try {
    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(
        'SELECT * FROM testcase_history WHERE testcase_id = $1 ORDER BY changed_at DESC LIMIT $2 OFFSET $3',
        [req.params.id, limit, offset]
      ),
      pool.query(
        'SELECT COUNT(*)::int AS total FROM testcase_history WHERE testcase_id = $1',
        [req.params.id]
      ),
    ]);
    res.json(paginatedResponse(rows, countRows[0].total, { page, limit }));
  } catch (err) { next(err); }
}

async function getTestcaseCounts(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT section,
         COUNT(DISTINCT COALESCE(data->>'title', data->>'description', id::text))::int AS tc_count,
         COUNT(DISTINCT folder_id)::int AS folder_count
       FROM testcases GROUP BY section`
    );
    const result = {};
    rows.forEach(r => { result[r.section] = { tc_count: r.tc_count, folder_count: r.folder_count }; });
    res.json(result);
  } catch (err) { next(err); }
}

module.exports = { listTestcases, getTestcase, searchTestcases, createTestcase, updateTestcase, deleteTestcase, importTestcases, getHistory, getTestcaseCounts };

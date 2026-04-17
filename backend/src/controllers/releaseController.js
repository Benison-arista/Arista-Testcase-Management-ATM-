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
  return { data: rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

// --- Release Tree ---

async function getReleaseTree(req, res, next) {
  try {
    const { rows } = await pool.query(
      `WITH RECURSIVE tree AS (
         SELECT id, name, parent_id, status, target_date, description, created_by, created_at
         FROM releases WHERE parent_id IS NULL
         UNION ALL
         SELECT r.id, r.name, r.parent_id, r.status, r.target_date, r.description, r.created_by, r.created_at
         FROM releases r JOIN tree t ON r.parent_id = t.id
       )
       SELECT * FROM tree ORDER BY name LIMIT 10000`
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function createRelease(req, res, next) {
  const { name, parent_id, status, target_date, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO releases (name, parent_id, status, target_date, description, created_by, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, parent_id || null, status || 'planning', target_date || null, description || null, req.user.username, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

async function deleteRelease(req, res, next) {
  try {
    await pool.query('DELETE FROM releases WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch (err) { next(err); }
}

// --- Features ---

async function getFeatures(req, res, next) {
  const { releaseId } = req.params;
  const { page, limit, offset } = parsePagination(req.query);
  try {
    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(
        'SELECT * FROM features WHERE release_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [releaseId, limit, offset]
      ),
      pool.query('SELECT COUNT(*)::int AS total FROM features WHERE release_id = $1', [releaseId]),
    ]);
    res.json(paginatedResponse(rows, countRows[0].total, { page, limit }));
  } catch (err) { next(err); }
}

async function getFeature(req, res, next) {
  try {
    const { rows } = await pool.query('SELECT * FROM features WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function createFeature(req, res, next) {
  const { releaseId } = req.params;
  const { name, status, priority, description, qa_assignee, dev_assignee, pm, jira_id, target_date, dev_eta, qa_eta, tags, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO features (release_id, name, status, priority, description, qa_assignee, dev_assignee, pm, jira_id, target_date, dev_eta, qa_eta, tags, notes, created_by, created_by_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [releaseId, name, status || 'requested', priority || null, description || null, qa_assignee || null, dev_assignee || null, pm || null, jira_id || null, target_date || null, dev_eta || null, qa_eta || null, tags || null, notes || null, req.user.username, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

async function updateFeature(req, res, next) {
  const { id } = req.params;
  const { name, status, priority, description, qa_assignee, dev_assignee, pm, jira_id, target_date, dev_eta, qa_eta, tags, notes, version } = req.body;
  try {
    let query, params;
    if (version != null) {
      query = `UPDATE features SET name=COALESCE($1,name), status=COALESCE($2,status), priority=$3, description=$4,
               qa_assignee=$5, dev_assignee=$6, pm=$7, jira_id=$8, target_date=$9, dev_eta=$10, qa_eta=$11,
               tags=$12, notes=$13, updated_at=NOW(), version=version+1
               WHERE id=$14 AND version=$15 RETURNING *`;
      params = [name, status, priority||null, description||null, qa_assignee||null, dev_assignee||null, pm||null, jira_id||null, target_date||null, dev_eta||null, qa_eta||null, tags||null, notes||null, id, version];
    } else {
      query = `UPDATE features SET name=COALESCE($1,name), status=COALESCE($2,status), priority=$3, description=$4,
               qa_assignee=$5, dev_assignee=$6, pm=$7, jira_id=$8, target_date=$9, dev_eta=$10, qa_eta=$11,
               tags=$12, notes=$13, updated_at=NOW(), version=version+1
               WHERE id=$14 RETURNING *`;
      params = [name, status, priority||null, description||null, qa_assignee||null, dev_assignee||null, pm||null, jira_id||null, target_date||null, dev_eta||null, qa_eta||null, tags||null, notes||null, id];
    }
    const { rows } = await pool.query(query, params);
    if (!rows.length) {
      if (version != null) return res.status(409).json({ error: 'Conflict: feature was modified by another user.' });
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function deleteFeature(req, res, next) {
  const { id } = req.params;
  try {
    // Check if the feature has any test runs linked to it
    const { rows: [{ count }] } = await pool.query(
      'SELECT COUNT(*)::int AS count FROM test_runs WHERE feature_id = $1',
      [id]
    );
    if (count > 0) {
      return res.status(400).json({ error: 'Cannot delete this feature — it has ' + count + ' test case(s) in its test run. Remove them first.' });
    }
    await pool.query('DELETE FROM features WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) { next(err); }
}

async function getReleaseSummary(req, res, next) {
  const { releaseId } = req.params;
  try {
    const { rows } = await pool.query(
      `WITH RECURSIVE sub AS (
         SELECT id FROM releases WHERE id = $1
         UNION ALL
         SELECT r.id FROM releases r JOIN sub s ON r.parent_id = s.id
       )
       SELECT
         COUNT(*) FILTER (WHERE status = 'requested')    AS requested,
         COUNT(*) FILTER (WHERE status = 'committed')    AS committed,
         COUNT(*) FILTER (WHERE status = 'in_progress')  AS in_progress,
         COUNT(*) FILTER (WHERE status = 'dev_complete') AS dev_complete,
         COUNT(*) FILTER (WHERE status = 'in_testing')   AS in_testing,
         COUNT(*) FILTER (WHERE status = 'completed')    AS completed,
         COUNT(*) FILTER (WHERE status = 'deferred')     AS deferred,
         COUNT(*) AS total
       FROM features WHERE release_id IN (SELECT id FROM sub)`,
      [releaseId]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
}

module.exports = { getReleaseTree, createRelease, deleteRelease, getFeatures, getFeature, createFeature, updateFeature, deleteFeature, getReleaseSummary };

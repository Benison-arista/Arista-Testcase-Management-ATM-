const { pool } = require('../db');

// Recursive CTE to fetch full tree for a section (capped at 1000 nodes)
async function getTree(req, res, next) {
  const { section } = req.query;
  if (!section) return res.status(400).json({ error: 'section is required' });
  try {
    const { rows } = await pool.query(
      `WITH RECURSIVE tree AS (
         SELECT id, name, parent_id, created_at
         FROM folders
         WHERE section = $1 AND parent_id IS NULL
         UNION ALL
         SELECT f.id, f.name, f.parent_id, f.created_at
         FROM folders f
         JOIN tree t ON f.parent_id = t.id
       )
       SELECT * FROM tree ORDER BY name LIMIT 10000`,
      [section]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function createFolder(req, res, next) {
  const { name, parent_id, section } = req.body;
  if (!name || !section) return res.status(400).json({ error: 'name and section are required' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO folders (name, parent_id, section) VALUES ($1, $2, $3) RETURNING *',
      [name, parent_id || null, section]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A folder with this name already exists in the same parent' });
    }
    next(err);
  }
}

async function moveFolder(req, res, next) {
  const { id } = req.params;
  const { parent_id } = req.body;

  // Cannot move a folder into itself
  if (parent_id !== null && parent_id !== undefined && String(parent_id) === String(id)) {
    return res.status(400).json({ error: 'Cannot move a folder into itself' });
  }

  try {
    // If moving into a subfolder, check it's not a descendant (prevents circular reference)
    if (parent_id) {
      const { rows: descendants } = await pool.query(
        `WITH RECURSIVE sub AS (
           SELECT id FROM folders WHERE parent_id = $1
           UNION ALL
           SELECT f.id FROM folders f JOIN sub s ON f.parent_id = s.id
         )
         SELECT id FROM sub WHERE id = $2`,
        [id, parent_id]
      );
      if (descendants.length) {
        return res.status(400).json({ error: 'Cannot move a folder into its own descendant' });
      }
    }

    const { rows } = await pool.query(
      'UPDATE folders SET parent_id = $1 WHERE id = $2 RETURNING *',
      [parent_id ?? null, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Folder not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A folder with this name already exists in the target folder' });
    }
    next(err);
  }
}

async function deleteFolder(req, res, next) {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM folders WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) { next(err); }
}

module.exports = { getTree, createFolder, moveFolder, deleteFolder };

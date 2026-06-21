const db = require('../db');

async function routes(fastify) {
  fastify.get('/api/versions/:versionId/annotations', async (req) => {
    const versionId = Number(req.params.versionId);
    const rows = db.prepare(`
      SELECT * FROM annotations WHERE version_id = ? ORDER BY id DESC
    `).all(versionId);
    const buildTree = (items, parentId = null) => {
      return items
        .filter(i => i.parent_id === parentId)
        .map(i => ({ ...i, replies: buildTree(items, i.id) }));
    };
    return buildTree(rows);
  });

  fastify.post('/api/versions/:versionId/annotations', async (req) => {
    const versionId = Number(req.params.versionId);
    const { user_name, anchor_text, comment, parent_id } = req.body;
    if (!comment) {
      const err = new Error('批注内容不能为空');
      err.statusCode = 400;
      throw err;
    }
    const info = db.prepare(`
      INSERT INTO annotations (version_id, user_name, anchor_text, comment, parent_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(versionId, user_name || '匿名学者', anchor_text || '', comment, parent_id || null);
    return { id: info.lastInsertRowid };
  });

  fastify.delete('/api/annotations/:id', async (req) => {
    db.prepare('DELETE FROM annotations WHERE id = ?').run(Number(req.params.id));
    return { ok: true };
  });
}

module.exports = routes;

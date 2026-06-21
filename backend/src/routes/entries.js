const db = require('../db');

async function routes(fastify) {
  fastify.get('/api/entries', async () => {
    const rows = db.prepare(`
      SELECT e.*, 
        (SELECT COUNT(*) FROM versions v WHERE v.entry_id = e.id) AS version_count
      FROM entries e ORDER BY e.id DESC
    `).all();
    return rows;
  });

  fastify.get('/api/entries/:id', async (req) => {
    const id = Number(req.params.id);
    const entry = db.prepare('SELECT * FROM entries WHERE id = ?').get(id);
    if (!entry) throw fastify.httpErrors.notFound('词条不存在');
    const versions = db.prepare('SELECT * FROM versions WHERE entry_id = ? ORDER BY id').all(id);
    return { ...entry, versions };
  });

  fastify.post('/api/entries', async (req) => {
    const { title, author, dynasty, summary, cover_url } = req.body;
    const info = db.prepare(`
      INSERT INTO entries (title, author, dynasty, summary, cover_url)
      VALUES (?, ?, ?, ?, ?)
    `).run(title || '', author || '', dynasty || '', summary || '', cover_url || '');
    return { id: info.lastInsertRowid };
  });

  fastify.put('/api/entries/:id', async (req) => {
    const id = Number(req.params.id);
    const { title, author, dynasty, summary, cover_url } = req.body;
    db.prepare(`
      UPDATE entries SET title=?, author=?, dynasty=?, summary=?, cover_url=?,
        updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(title, author, dynasty, summary, cover_url, id);
    return { ok: true };
  });

  fastify.delete('/api/entries/:id', async (req) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM entries WHERE id = ?').run(id);
    return { ok: true };
  });
}

module.exports = routes;

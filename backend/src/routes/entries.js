const { db, createRevisionsFromDiff } = require('../db');
const { authenticate, requirePermission } = require('../auth');

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
    if (!entry) {
      const err = new Error('词条不存在');
      err.statusCode = 404;
      throw err;
    }
    const versions = db.prepare('SELECT * FROM versions WHERE entry_id = ? ORDER BY id').all(id);
    return { ...entry, versions };
  });

  fastify.post('/api/entries', {
    preHandler: [authenticate(), requirePermission('entries:write')]
  }, async (req) => {
    const { title, author, dynasty, summary, cover_url } = req.body;
    const info = db.prepare(`
      INSERT INTO entries (title, author, dynasty, summary, cover_url)
      VALUES (?, ?, ?, ?, ?)
    `).run(title || '', author || '', dynasty || '', summary || '', cover_url || '');
    return { id: info.lastInsertRowid };
  });

  fastify.put('/api/entries/:id', {
    preHandler: [authenticate(), requirePermission('entries:write')]
  }, async (req) => {
    const id = Number(req.params.id);
    const { title, author, dynasty, summary, cover_url } = req.body;
    const oldEntry = db.prepare('SELECT * FROM entries WHERE id = ?').get(id);
    if (!oldEntry) {
      const err = new Error('词条不存在');
      err.statusCode = 404;
      throw err;
    }
    const newData = {
      title: title ?? oldEntry.title,
      author: author ?? oldEntry.author,
      dynasty: dynasty ?? oldEntry.dynasty,
      summary: summary ?? oldEntry.summary,
      cover_url: cover_url ?? oldEntry.cover_url
    };
    db.prepare(`
      UPDATE entries SET title=?, author=?, dynasty=?, summary=?, cover_url=?,
        updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(newData.title, newData.author, newData.dynasty, newData.summary, newData.cover_url, id);

    createRevisionsFromDiff('entry', id, oldEntry, newData, ['title', 'author', 'dynasty', 'summary', 'cover_url'], req.user);

    return { ok: true };
  });

  fastify.delete('/api/entries/:id', {
    preHandler: [authenticate(), requirePermission('entries:write')]
  }, async (req) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM entries WHERE id = ?').run(id);
    return { ok: true };
  });
}

module.exports = routes;

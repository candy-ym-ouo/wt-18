const { db, createRevisionsFromDiff } = require('../db');
const { authenticate, requirePermission } = require('../auth');

async function routes(fastify) {
  fastify.get('/api/versions/:id', async (req) => {
    const id = Number(req.params.id);
    const version = db.prepare('SELECT * FROM versions WHERE id = ?').get(id);
    if (!version) {
      const err = new Error('版本不存在');
      err.statusCode = 404;
      throw err;
    }
    const entry = db.prepare('SELECT id, title FROM entries WHERE id = ?').get(version.entry_id);
    return { ...version, entry };
  });

  fastify.get('/api/entries/:entryId/versions', async (req) => {
    const entryId = Number(req.params.entryId);
    return db.prepare('SELECT * FROM versions WHERE entry_id = ? ORDER BY id').all(entryId);
  });

  fastify.get('/api/compare', async (req) => {
    const ids = (req.query.ids || '').split(',').map(Number).filter(Boolean);
    if (ids.length < 2) return [];
    return db.prepare(`SELECT * FROM versions WHERE id IN (${ids.join(',')})`).all();
  });

  fastify.post('/api/versions', {
    preHandler: [authenticate(), requirePermission('versions:write')]
  }, async (req) => {
    const { entry_id, version_name, publisher, pub_year, pages, isbn, description, full_text } = req.body;
    const info = db.prepare(`
      INSERT INTO versions (entry_id, version_name, publisher, pub_year, pages, isbn, description, full_text)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(entry_id, version_name, publisher || '', pub_year || '', pages || null, isbn || '', description || '', full_text || '');
    return { id: info.lastInsertRowid };
  });

  fastify.put('/api/versions/:id', {
    preHandler: [authenticate(), requirePermission('versions:write')]
  }, async (req) => {
    const id = Number(req.params.id);
    const { version_name, publisher, pub_year, pages, isbn, description, full_text } = req.body;
    const oldVersion = db.prepare('SELECT * FROM versions WHERE id = ?').get(id);
    if (!oldVersion) {
      const err = new Error('版本不存在');
      err.statusCode = 404;
      throw err;
    }
    const newData = {
      version_name: version_name ?? oldVersion.version_name,
      publisher: publisher ?? oldVersion.publisher,
      pub_year: pub_year ?? oldVersion.pub_year,
      pages: pages ?? oldVersion.pages,
      isbn: isbn ?? oldVersion.isbn,
      description: description ?? oldVersion.description,
      full_text: full_text ?? oldVersion.full_text
    };
    db.prepare(`
      UPDATE versions SET version_name=?, publisher=?, pub_year=?, pages=?, isbn=?, description=?, full_text=?
      WHERE id = ?
    `).run(newData.version_name, newData.publisher, newData.pub_year, newData.pages, newData.isbn, newData.description, newData.full_text, id);

    createRevisionsFromDiff('version', id, oldVersion, newData, ['version_name', 'publisher', 'pub_year', 'pages', 'isbn', 'description', 'full_text'], req.user);

    return { ok: true };
  });

  fastify.delete('/api/versions/:id', {
    preHandler: [authenticate(), requirePermission('versions:write')]
  }, async (req) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM versions WHERE id = ?').run(id);
    return { ok: true };
  });
}

module.exports = routes;

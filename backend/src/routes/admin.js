const db = require('../db');

async function routes(fastify) {
  fastify.get('/api/admin/stats', async () => {
    return {
      entries: db.prepare('SELECT COUNT(*) AS c FROM entries').get().c,
      versions: db.prepare('SELECT COUNT(*) AS c FROM versions').get().c,
      images: db.prepare('SELECT COUNT(*) AS c FROM images').get().c,
      annotations: db.prepare('SELECT COUNT(*) AS c FROM annotations').get().c,
      references: db.prepare('SELECT COUNT(*) AS c FROM refs').get().c
    };
  });

  fastify.get('/api/admin/entries', async () => {
    return db.prepare(`
      SELECT e.*,
        (SELECT COUNT(*) FROM versions v WHERE v.entry_id = e.id) AS version_count,
        (SELECT COUNT(*) FROM refs r WHERE r.from_entry_id = e.id OR r.to_entry_id = e.id) AS ref_count
      FROM entries e ORDER BY e.id DESC
    `).all();
  });

  fastify.get('/api/admin/versions', async () => {
    return db.prepare(`
      SELECT v.*, e.title AS entry_title
      FROM versions v JOIN entries e ON v.entry_id = e.id
      ORDER BY v.id DESC
    `).all();
  });

  fastify.get('/api/admin/users', async () => {
    return db.prepare('SELECT * FROM users').all();
  });

  fastify.get('/api/admin/all-entries', async () => {
    return db.prepare('SELECT id, title FROM entries ORDER BY title').all();
  });
}

module.exports = routes;

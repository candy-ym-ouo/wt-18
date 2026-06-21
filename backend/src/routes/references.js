const db = require('../db');

async function routes(fastify) {
  fastify.get('/api/entries/:entryId/references', async (req) => {
    const id = Number(req.params.entryId);
    const outgoing = db.prepare(`
      SELECT r.*, e.title AS to_title, e.author AS to_author
      FROM refs r
      JOIN entries e ON r.to_entry_id = e.id
      WHERE r.from_entry_id = ?
    `).all(id);
    const incoming = db.prepare(`
      SELECT r.*, e.title AS from_title, e.author AS from_author
      FROM refs r
      JOIN entries e ON r.from_entry_id = e.id
      WHERE r.to_entry_id = ?
    `).all(id);
    return { outgoing, incoming };
  });

  fastify.post('/api/references', async (req) => {
    const { from_entry_id, to_entry_id, relation_type, note } = req.body;
    if (!from_entry_id || !to_entry_id || from_entry_id === to_entry_id) {
      throw fastify.httpErrors.badRequest('参数无效');
    }
    const info = db.prepare(`
      INSERT INTO refs (from_entry_id, to_entry_id, relation_type, note)
      VALUES (?, ?, ?, ?)
    `).run(from_entry_id, to_entry_id, relation_type || '相关', note || '');
    return { id: info.lastInsertRowid };
  });

  fastify.delete('/api/references/:id', async (req) => {
    db.prepare('DELETE FROM refs WHERE id = ?').run(Number(req.params.id));
    return { ok: true };
  });

  fastify.get('/api/references/graph', async () => {
    const entries = db.prepare('SELECT id, title FROM entries').all();
    const refs = db.prepare('SELECT from_entry_id AS source, to_entry_id AS target, relation_type AS label FROM refs').all();
    return { nodes: entries.map(e => ({ id: e.id, label: e.title })), edges: refs };
  });
}

module.exports = routes;

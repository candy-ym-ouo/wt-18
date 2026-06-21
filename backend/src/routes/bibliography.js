const { db } = require('../db');
const { authenticate, requirePermission } = require('../auth');

async function routes(fastify) {
  fastify.get('/api/bibliography', async (req) => {
    const { type, keyword, status } = req.query;
    let sql = `
      SELECT b.*,
        (SELECT COUNT(*) FROM bibliography_entries be WHERE be.bibliography_id = b.id) AS entry_count,
        (SELECT COUNT(*) FROM bibliography_versions bv WHERE bv.bibliography_id = b.id) AS version_count,
        u.display_name AS creator_name
      FROM bibliography b
      LEFT JOIN users u ON b.creator_id = u.id
      WHERE 1=1
    `;
    const params = [];
    if (type) {
      sql += ' AND b.bib_type = ?';
      params.push(type);
    }
    if (keyword) {
      sql += ' AND (b.title LIKE ? OR b.author LIKE ? OR b.keywords LIKE ?)';
      const kw = `%${keyword}%`;
      params.push(kw, kw, kw);
    }
    if (status) {
      sql += ' AND b.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY b.id DESC';
    return db.prepare(sql).all(...params);
  });

  fastify.get('/api/bibliography/:id', async (req) => {
    const id = Number(req.params.id);
    const bib = db.prepare('SELECT * FROM bibliography WHERE id = ?').get(id);
    if (!bib) {
      const err = new Error('书目资料不存在');
      err.statusCode = 404;
      throw err;
    }
    const entries = db.prepare(`
      SELECT be.*, e.title AS entry_title, e.author AS entry_author
      FROM bibliography_entries be
      JOIN entries e ON be.entry_id = e.id
      WHERE be.bibliography_id = ?
    `).all(id);
    const versions = db.prepare(`
      SELECT bv.*, v.version_name, v.publisher, v.pub_year, e.title AS entry_title
      FROM bibliography_versions bv
      JOIN versions v ON bv.version_id = v.id
      JOIN entries e ON v.entry_id = e.id
      WHERE bv.bibliography_id = ?
    `).all(id);
    const outgoingRefs = db.prepare(`
      SELECT br.*, b.title AS to_title, b.author AS to_author, b.bib_type AS to_type
      FROM bibliography_refs br
      JOIN bibliography b ON br.to_bib_id = b.id
      WHERE br.from_bib_id = ?
    `).all(id);
    const incomingRefs = db.prepare(`
      SELECT br.*, b.title AS from_title, b.author AS from_author, b.bib_type AS from_type
      FROM bibliography_refs br
      JOIN bibliography b ON br.from_bib_id = b.id
      WHERE br.to_bib_id = ?
    `).all(id);
    return { ...bib, entries, versions, outgoingRefs, incomingRefs };
  });

  fastify.post('/api/bibliography', {
    preHandler: [authenticate(), requirePermission('bibliography:write')]
  }, async (req) => {
    const {
      bib_type, title, author, publisher, pub_year, pub_place, edition,
      volume, issue, pages, isbn, issn, doi, url, language, keywords,
      summary, full_text, call_number, location, access_status, status
    } = req.body;
    const info = db.prepare(`
      INSERT INTO bibliography (
        bib_type, title, author, publisher, pub_year, pub_place, edition,
        volume, issue, pages, isbn, issn, doi, url, language, keywords,
        summary, full_text, call_number, location, access_status, status,
        creator_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      bib_type, title || '', author || '', publisher || '', pub_year || '',
      pub_place || '', edition || '', volume || '', issue || '', pages || '',
      isbn || '', issn || '', doi || '', url || '', language || '',
      keywords || '', summary || '', full_text || '', call_number || '',
      location || '', access_status || 'public', status || 'active',
      req.user?.id || null
    );
    return { id: info.lastInsertRowid };
  });

  fastify.put('/api/bibliography/:id', {
    preHandler: [authenticate(), requirePermission('bibliography:write')]
  }, async (req) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT id FROM bibliography WHERE id = ?').get(id);
    if (!existing) {
      const err = new Error('书目资料不存在');
      err.statusCode = 404;
      throw err;
    }
    const {
      bib_type, title, author, publisher, pub_year, pub_place, edition,
      volume, issue, pages, isbn, issn, doi, url, language, keywords,
      summary, full_text, call_number, location, access_status, status
    } = req.body;
    db.prepare(`
      UPDATE bibliography SET
        bib_type=?, title=?, author=?, publisher=?, pub_year=?, pub_place=?,
        edition=?, volume=?, issue=?, pages=?, isbn=?, issn=?, doi=?, url=?,
        language=?, keywords=?, summary=?, full_text=?, call_number=?,
        location=?, access_status=?, status=?,
        updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(
      bib_type, title, author, publisher, pub_year, pub_place, edition,
      volume, issue, pages, isbn, issn, doi, url, language, keywords,
      summary, full_text, call_number, location, access_status, status, id
    );
    return { ok: true };
  });

  fastify.delete('/api/bibliography/:id', {
    preHandler: [authenticate(), requirePermission('bibliography:write')]
  }, async (req) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM bibliography WHERE id = ?').run(id);
    return { ok: true };
  });

  fastify.post('/api/bibliography/:id/entries', {
    preHandler: [authenticate(), requirePermission('bibliography:write')]
  }, async (req) => {
    const bibId = Number(req.params.id);
    const { entry_id, relation_type, note } = req.body;
    if (!entry_id) {
      const err = new Error('词条ID不能为空');
      err.statusCode = 400;
      throw err;
    }
    const info = db.prepare(`
      INSERT INTO bibliography_entries (bibliography_id, entry_id, relation_type, note)
      VALUES (?, ?, ?, ?)
    `).run(bibId, entry_id, relation_type || 'cites', note || '');
    return { id: info.lastInsertRowid };
  });

  fastify.delete('/api/bibliography/entries/:id', {
    preHandler: [authenticate(), requirePermission('bibliography:write')]
  }, async (req) => {
    db.prepare('DELETE FROM bibliography_entries WHERE id = ?').run(Number(req.params.id));
    return { ok: true };
  });

  fastify.post('/api/bibliography/:id/versions', {
    preHandler: [authenticate(), requirePermission('bibliography:write')]
  }, async (req) => {
    const bibId = Number(req.params.id);
    const { version_id, relation_type, note, page_ref } = req.body;
    if (!version_id) {
      const err = new Error('版本ID不能为空');
      err.statusCode = 400;
      throw err;
    }
    const info = db.prepare(`
      INSERT INTO bibliography_versions (bibliography_id, version_id, relation_type, note, page_ref)
      VALUES (?, ?, ?, ?, ?)
    `).run(bibId, version_id, relation_type || 'cites', note || '', page_ref || '');
    return { id: info.lastInsertRowid };
  });

  fastify.delete('/api/bibliography/versions/:id', {
    preHandler: [authenticate(), requirePermission('bibliography:write')]
  }, async (req) => {
    db.prepare('DELETE FROM bibliography_versions WHERE id = ?').run(Number(req.params.id));
    return { ok: true };
  });

  fastify.post('/api/bibliography/:id/refs', {
    preHandler: [authenticate(), requirePermission('bibliography:write')]
  }, async (req) => {
    const fromBibId = Number(req.params.id);
    const { to_bib_id, relation_type, note } = req.body;
    if (!to_bib_id || fromBibId === Number(to_bib_id)) {
      const err = new Error('参数无效');
      err.statusCode = 400;
      throw err;
    }
    const info = db.prepare(`
      INSERT INTO bibliography_refs (from_bib_id, to_bib_id, relation_type, note)
      VALUES (?, ?, ?, ?)
    `).run(fromBibId, to_bib_id, relation_type || 'cites', note || '');
    return { id: info.lastInsertRowid };
  });

  fastify.delete('/api/bibliography/refs/:id', {
    preHandler: [authenticate(), requirePermission('bibliography:write')]
  }, async (req) => {
    db.prepare('DELETE FROM bibliography_refs WHERE id = ?').run(Number(req.params.id));
    return { ok: true };
  });

  fastify.get('/api/entries/:entryId/bibliography', async (req) => {
    const entryId = Number(req.params.entryId);
    return db.prepare(`
      SELECT be.*, b.*, u.display_name AS creator_name
      FROM bibliography_entries be
      JOIN bibliography b ON be.bibliography_id = b.id
      LEFT JOIN users u ON b.creator_id = u.id
      WHERE be.entry_id = ?
      ORDER BY be.id DESC
    `).all(entryId);
  });

  fastify.get('/api/versions/:versionId/bibliography', async (req) => {
    const versionId = Number(req.params.versionId);
    return db.prepare(`
      SELECT bv.*, b.*, u.display_name AS creator_name
      FROM bibliography_versions bv
      JOIN bibliography b ON bv.bibliography_id = b.id
      LEFT JOIN users u ON b.creator_id = u.id
      WHERE bv.version_id = ?
      ORDER BY bv.id DESC
    `).all(versionId);
  });

  fastify.get('/api/bibliography/graph', async () => {
    const bibs = db.prepare('SELECT id, title, author, bib_type FROM bibliography').all();
    const refs = db.prepare(`
      SELECT from_bib_id AS source, to_bib_id AS target, relation_type AS label
      FROM bibliography_refs
    `).all();
    return {
      nodes: bibs.map(b => ({ id: b.id, label: b.title, author: b.author, type: b.bib_type })),
      edges: refs
    };
  });

  fastify.get('/api/bibliography/stats', async () => {
    const stats = db.prepare(`
      SELECT
        bib_type,
        COUNT(*) as count
      FROM bibliography
      GROUP BY bib_type
    `).all();
    const total = db.prepare('SELECT COUNT(*) as total FROM bibliography').get().total;
    return { total, by_type: stats };
  });
}

module.exports = routes;

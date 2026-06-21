const { db } = require('../db');
const { authenticate, requirePermission, requireRole, ROLES } = require('../auth');

const ADMIN_ROLES = [ROLES.ADMIN, ROLES.EDITOR];

async function routes(fastify) {

  fastify.get('/api/topics', async () => {
    return db.prepare(`
      SELECT t.*,
        (SELECT COUNT(*) FROM chapters c WHERE c.topic_id = t.id) AS chapter_count,
        (SELECT COUNT(*) FROM topic_entries te WHERE te.topic_id = t.id) AS entry_count
      FROM topics t
      WHERE t.status = 'published'
      ORDER BY t.sort_order ASC, t.id DESC
    `).all();
  });

  fastify.get('/api/topics/:id', async (req) => {
    const id = Number(req.params.id);
    const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(id);
    if (!topic) {
      const err = new Error('专题不存在');
      err.statusCode = 404;
      throw err;
    }
    if (topic.status !== 'published') {
      const err = new Error('专题未发布');
      err.statusCode = 403;
      throw err;
    }
    const chapters = db.prepare(`
      SELECT * FROM chapters
      WHERE topic_id = ? AND status = 'published'
      ORDER BY sort_order ASC, id ASC
    `).all(id);
    const entries = db.prepare(`
      SELECT te.*, e.title AS entry_title, e.author AS entry_author, e.dynasty AS entry_dynasty, e.cover_url AS entry_cover
      FROM topic_entries te
      JOIN entries e ON te.entry_id = e.id
      WHERE te.topic_id = ? AND te.chapter_id IS NULL
      ORDER BY te.sort_order ASC, te.id ASC
    `).all(id);
    return { ...topic, chapters, entries };
  });

  fastify.get('/api/topics/:id/chapters/:chapterId', async (req) => {
    const topicId = Number(req.params.id);
    const chapterId = Number(req.params.chapterId);
    const chapter = db.prepare(`
      SELECT c.*, t.title AS topic_title
      FROM chapters c
      JOIN topics t ON c.topic_id = t.id
      WHERE c.id = ? AND c.topic_id = ?
    `).get(chapterId, topicId);
    if (!chapter) {
      const err = new Error('章节不存在');
      err.statusCode = 404;
      throw err;
    }
    if (chapter.status !== 'published') {
      const err = new Error('章节未发布');
      err.statusCode = 403;
      throw err;
    }
    const entries = db.prepare(`
      SELECT te.*, e.title AS entry_title, e.author AS entry_author, e.dynasty AS entry_dynasty, e.cover_url AS entry_cover
      FROM topic_entries te
      JOIN entries e ON te.entry_id = e.id
      WHERE te.chapter_id = ?
      ORDER BY te.sort_order ASC, te.id ASC
    `).all(chapterId);
    const allChapters = db.prepare(`
      SELECT id, title, sort_order FROM chapters
      WHERE topic_id = ? AND status = 'published'
      ORDER BY sort_order ASC, id ASC
    `).all(topicId);
    const idx = allChapters.findIndex(c => c.id === chapterId);
    const prev = idx > 0 ? allChapters[idx - 1] : null;
    const next = idx < allChapters.length - 1 ? allChapters[idx + 1] : null;
    return { ...chapter, entries, prevChapter: prev, nextChapter: next, allChapters };
  });

  fastify.get('/api/admin/topics', {
    preHandler: [authenticate(), requireRole(...ADMIN_ROLES)]
  }, async () => {
    return db.prepare(`
      SELECT t.*,
        (SELECT COUNT(*) FROM chapters c WHERE c.topic_id = t.id) AS chapter_count,
        (SELECT COUNT(*) FROM topic_entries te WHERE te.topic_id = t.id OR te.chapter_id IN (SELECT id FROM chapters WHERE topic_id = t.id)) AS entry_count
      FROM topics t
      ORDER BY t.sort_order ASC, t.id DESC
    `).all();
  });

  fastify.get('/api/admin/topics/:id', {
    preHandler: [authenticate(), requireRole(...ADMIN_ROLES)]
  }, async (req) => {
    const id = Number(req.params.id);
    const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(id);
    if (!topic) {
      const err = new Error('专题不存在');
      err.statusCode = 404;
      throw err;
    }
    const chapters = db.prepare(`
      SELECT * FROM chapters WHERE topic_id = ?
      ORDER BY sort_order ASC, id ASC
    `).all(id);
    const entries = db.prepare(`
      SELECT te.*, e.title AS entry_title
      FROM topic_entries te
      JOIN entries e ON te.entry_id = e.id
      WHERE te.topic_id = ? AND te.chapter_id IS NULL
      ORDER BY te.sort_order ASC, te.id ASC
    `).all(id);
    return { ...topic, chapters, entries };
  });

  fastify.post('/api/admin/topics', {
    preHandler: [authenticate(), requirePermission('topics:write')]
  }, async (req) => {
    const { title, subtitle, author, summary, cover_url, status, sort_order } = req.body;
    const info = db.prepare(`
      INSERT INTO topics (title, subtitle, author, summary, cover_url, status, sort_order, creator_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title || '',
      subtitle || '',
      author || '',
      summary || '',
      cover_url || '',
      status || 'draft',
      sort_order || 0,
      req.user.id
    );
    return { id: info.lastInsertRowid };
  });

  fastify.put('/api/admin/topics/:id', {
    preHandler: [authenticate(), requirePermission('topics:write')]
  }, async (req) => {
    const id = Number(req.params.id);
    const { title, subtitle, author, summary, cover_url, status, sort_order } = req.body;
    db.prepare(`
      UPDATE topics SET title=?, subtitle=?, author=?, summary=?, cover_url=?, status=?, sort_order=?,
        updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(
      title, subtitle, author, summary, cover_url, status, sort_order, id
    );
    return { ok: true };
  });

  fastify.delete('/api/admin/topics/:id', {
    preHandler: [authenticate(), requirePermission('topics:write')]
  }, async (req) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM topics WHERE id = ?').run(id);
    return { ok: true };
  });

  fastify.get('/api/admin/topics/:id/chapters', {
    preHandler: [authenticate(), requireRole(...ADMIN_ROLES)]
  }, async (req) => {
    const topicId = Number(req.params.id);
    return db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM topic_entries te WHERE te.chapter_id = c.id) AS entry_count
      FROM chapters c
      WHERE c.topic_id = ?
      ORDER BY c.sort_order ASC, c.id ASC
    `).all(topicId);
  });

  fastify.get('/api/admin/chapters/:id', {
    preHandler: [authenticate(), requireRole(...ADMIN_ROLES)]
  }, async (req) => {
    const id = Number(req.params.id);
    const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(id);
    if (!chapter) {
      const err = new Error('章节不存在');
      err.statusCode = 404;
      throw err;
    }
    const entries = db.prepare(`
      SELECT te.*, e.title AS entry_title, e.author AS entry_author
      FROM topic_entries te
      JOIN entries e ON te.entry_id = e.id
      WHERE te.chapter_id = ?
      ORDER BY te.sort_order ASC, te.id ASC
    `).all(id);
    return { ...chapter, entries };
  });

  fastify.post('/api/admin/topics/:id/chapters', {
    preHandler: [authenticate(), requirePermission('chapters:write')]
  }, async (req) => {
    const topicId = Number(req.params.id);
    const { title, subtitle, content, sort_order, status } = req.body;
    const info = db.prepare(`
      INSERT INTO chapters (topic_id, title, subtitle, content, sort_order, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      topicId,
      title || '',
      subtitle || '',
      content || '',
      sort_order || 0,
      status || 'draft'
    );
    return { id: info.lastInsertRowid };
  });

  fastify.put('/api/admin/chapters/:id', {
    preHandler: [authenticate(), requirePermission('chapters:write')]
  }, async (req) => {
    const id = Number(req.params.id);
    const { title, subtitle, content, sort_order, status } = req.body;
    db.prepare(`
      UPDATE chapters SET title=?, subtitle=?, content=?, sort_order=?, status=?,
        updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(title, subtitle, content, sort_order, status, id);
    return { ok: true };
  });

  fastify.delete('/api/admin/chapters/:id', {
    preHandler: [authenticate(), requirePermission('chapters:write')]
  }, async (req) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM chapters WHERE id = ?').run(id);
    return { ok: true };
  });

  fastify.post('/api/admin/topic-entries', {
    preHandler: [authenticate(), requirePermission('topics:write')]
  }, async (req) => {
    const { topic_id, chapter_id, entry_id, note, sort_order } = req.body;
    if (!entry_id) {
      const err = new Error('请选择词条');
      err.statusCode = 400;
      throw err;
    }
    const info = db.prepare(`
      INSERT INTO topic_entries (topic_id, chapter_id, entry_id, note, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      topic_id || null,
      chapter_id || null,
      entry_id,
      note || '',
      sort_order || 0
    );
    return { id: info.lastInsertRowid };
  });

  fastify.put('/api/admin/topic-entries/:id', {
    preHandler: [authenticate(), requirePermission('topics:write')]
  }, async (req) => {
    const id = Number(req.params.id);
    const { note, sort_order } = req.body;
    db.prepare(`
      UPDATE topic_entries SET note=?, sort_order=?
      WHERE id = ?
    `).run(note || '', sort_order || 0, id);
    return { ok: true };
  });

  fastify.delete('/api/admin/topic-entries/:id', {
    preHandler: [authenticate(), requirePermission('topics:write')]
  }, async (req) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM topic_entries WHERE id = ?').run(id);
    return { ok: true };
  });
}

module.exports = routes;

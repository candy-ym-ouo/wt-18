const { db } = require('../db');
const { authenticate, requirePermission } = require('../auth');

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100) || `tag-${Date.now()}`;
}

function updateTagUsageCount(tagId) {
  const entryCount = db.prepare('SELECT COUNT(*) AS c FROM entry_tags WHERE tag_id = ?').get(tagId).c;
  const versionCount = db.prepare('SELECT COUNT(*) AS c FROM version_tags WHERE tag_id = ?').get(tagId).c;
  db.prepare('UPDATE tags SET usage_count = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(
    entryCount + versionCount,
    tagId
  );
}

async function routes(fastify) {

  fastify.get('/api/tags', async (req) => {
    const { status, keyword, sort = 'usage', limit = 50 } = req.query;
    let where = [];
    let params = [];
    if (status) {
      where.push('status = ?');
      params.push(status);
    }
    if (keyword) {
      where.push('(name LIKE ? OR description LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    let orderBy = 'usage_count DESC, id DESC';
    if (sort === 'name') orderBy = 'name COLLATE NOCASE ASC';
    if (sort === 'newest') orderBy = 'id DESC';
    if (sort === 'oldest') orderBy = 'id ASC';
    return db.prepare(`
      SELECT * FROM tags ${whereSql}
      ORDER BY ${orderBy}
      LIMIT ?
    `).all(...params, Number(limit));
  });

  fastify.get('/api/tags/cloud', async (req) => {
    const { limit = 100 } = req.query;
    const tags = db.prepare(`
      SELECT id, name, slug, color, usage_count
      FROM tags
      WHERE status = 'active' AND usage_count > 0
      ORDER BY usage_count DESC
      LIMIT ?
    `).all(Number(limit));
    if (tags.length === 0) return { tags: [], maxUsage: 0 };
    const maxUsage = Math.max(...tags.map(t => t.usage_count));
    return { tags, maxUsage };
  });

  fastify.get('/api/tags/:id', async (req) => {
    const id = Number(req.params.id);
    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
    if (!tag) {
      const err = new Error('标签不存在');
      err.statusCode = 404;
      throw err;
    }
    const entries = db.prepare(`
      SELECT e.id, e.title, e.author, e.dynasty, e.cover_url, e.created_at
      FROM entry_tags et
      JOIN entries e ON et.entry_id = e.id
      WHERE et.tag_id = ?
      ORDER BY e.id DESC
      LIMIT 50
    `).all(id);
    const versions = db.prepare(`
      SELECT v.id, v.version_name, v.publisher, v.pub_year, v.entry_id, e.title AS entry_title
      FROM version_tags vt
      JOIN versions v ON vt.version_id = v.id
      LEFT JOIN entries e ON v.entry_id = e.id
      WHERE vt.tag_id = ?
      ORDER BY v.id DESC
      LIMIT 50
    `).all(id);
    return { ...tag, entries, versions, entryCount: entries.length, versionCount: versions.length };
  });

  fastify.get('/api/tags/slug/:slug', async (req) => {
    const tag = db.prepare('SELECT * FROM tags WHERE slug = ?').get(req.params.slug);
    if (!tag) {
      const err = new Error('标签不存在');
      err.statusCode = 404;
      throw err;
    }
    const entries = db.prepare(`
      SELECT e.id, e.title, e.author, e.dynasty, e.cover_url, e.created_at
      FROM entry_tags et
      JOIN entries e ON et.entry_id = e.id
      WHERE et.tag_id = ?
      ORDER BY e.id DESC
      LIMIT 50
    `).all(tag.id);
    const versions = db.prepare(`
      SELECT v.id, v.version_name, v.publisher, v.pub_year, v.entry_id, e.title AS entry_title
      FROM version_tags vt
      JOIN versions v ON vt.version_id = v.id
      LEFT JOIN entries e ON v.entry_id = e.id
      WHERE vt.tag_id = ?
      ORDER BY v.id DESC
      LIMIT 50
    `).all(tag.id);
    return { ...tag, entries, versions, entryCount: entries.length, versionCount: versions.length };
  });

  fastify.get('/api/admin/tags', {
    preHandler: [authenticate(), requirePermission('tags:read')]
  }, async (req) => {
    const { keyword, status, sort = 'id' } = req.query;
    let where = [];
    let params = [];
    if (keyword) {
      where.push('(name LIKE ? OR slug LIKE ? OR description LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    if (status) {
      where.push('status = ?');
      params.push(status);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    let orderBy = 'id DESC';
    if (sort === 'name') orderBy = 'name COLLATE NOCASE ASC';
    if (sort === 'usage') orderBy = 'usage_count DESC';
    return db.prepare(`
      SELECT t.*,
        (SELECT COUNT(*) FROM entry_tags et WHERE et.tag_id = t.id) AS entry_count,
        (SELECT COUNT(*) FROM version_tags vt WHERE vt.tag_id = t.id) AS version_count
      FROM tags t ${whereSql}
      ORDER BY ${orderBy}
    `).all(...params);
  });

  fastify.get('/api/admin/tags/:id', {
    preHandler: [authenticate(), requirePermission('tags:read')]
  }, async (req) => {
    const id = Number(req.params.id);
    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
    if (!tag) {
      const err = new Error('标签不存在');
      err.statusCode = 404;
      throw err;
    }
    return tag;
  });

  fastify.post('/api/admin/tags', {
    preHandler: [authenticate(), requirePermission('tags:write')]
  }, async (req) => {
    const { name, slug, color, description, status } = req.body;
    if (!name || !name.trim()) {
      const err = new Error('标签名称必填');
      err.statusCode = 400;
      throw err;
    }
    const trimmedName = name.trim();
    const existing = db.prepare('SELECT id FROM tags WHERE name = ?').get(trimmedName);
    if (existing) {
      const err = new Error('标签名称已存在');
      err.statusCode = 409;
      throw err;
    }
    let finalSlug = slug ? slug.trim() : generateSlug(trimmedName);
    const slugExists = db.prepare('SELECT id FROM tags WHERE slug = ?').get(finalSlug);
    if (slugExists) {
      finalSlug = `${finalSlug}-${Date.now()}`;
    }
    const info = db.prepare(`
      INSERT INTO tags (name, slug, color, description, status, creator_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      trimmedName,
      finalSlug,
      color || '#6366f1',
      description || '',
      status || 'active',
      req.user?.id || null
    );
    return { id: info.lastInsertRowid, name: trimmedName, slug: finalSlug };
  });

  fastify.put('/api/admin/tags/:id', {
    preHandler: [authenticate(), requirePermission('tags:write')]
  }, async (req) => {
    const id = Number(req.params.id);
    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
    if (!tag) {
      const err = new Error('标签不存在');
      err.statusCode = 404;
      throw err;
    }
    const { name, slug, color, description, status } = req.body;
    let finalName = name ? name.trim() : tag.name;
    if (name && name.trim() !== tag.name) {
      const existing = db.prepare('SELECT id FROM tags WHERE name = ? AND id != ?').get(finalName, id);
      if (existing) {
        const err = new Error('标签名称已存在');
        err.statusCode = 409;
        throw err;
      }
    }
    let finalSlug = slug ? slug.trim() : tag.slug;
    if (slug && slug.trim() !== tag.slug) {
      const slugExists = db.prepare('SELECT id FROM tags WHERE slug = ? AND id != ?').get(finalSlug, id);
      if (slugExists) {
        const err = new Error('标签别名已存在');
        err.statusCode = 409;
        throw err;
      }
    }
    db.prepare(`
      UPDATE tags SET name=?, slug=?, color=?, description=?, status=?,
        updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(
      finalName,
      finalSlug,
      color || tag.color,
      description !== undefined ? description : tag.description,
      status || tag.status,
      id
    );
    return { ok: true };
  });

  fastify.delete('/api/admin/tags/:id', {
    preHandler: [authenticate(), requirePermission('tags:write')]
  }, async (req) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM tags WHERE id = ?').run(id);
    return { ok: true };
  });

  fastify.post('/api/admin/tags/batch', {
    preHandler: [authenticate(), requirePermission('tags:write')]
  }, async (req) => {
    const { names } = req.body;
    if (!Array.isArray(names) || names.length === 0) {
      const err = new Error('请提供标签名称数组');
      err.statusCode = 400;
      throw err;
    }
    const results = [];
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO tags (name, slug, creator_id)
      VALUES (?, ?, ?)
    `);
    const selectStmt = db.prepare('SELECT id, name, slug FROM tags WHERE name = ?');
    for (const rawName of names) {
      const name = (rawName || '').trim();
      if (!name) continue;
      const slug = generateSlug(name);
      insertStmt.run(name, slug, req.user?.id || null);
      const tag = selectStmt.get(name);
      if (tag) results.push(tag);
    }
    return { created: results.length, tags: results };
  });

  fastify.post('/api/admin/tags/:id/merge', {
    preHandler: [authenticate(), requirePermission('tags:write')]
  }, async (req) => {
    const sourceId = Number(req.params.id);
    const { target_id } = req.body;
    const targetId = Number(target_id);
    if (!targetId || sourceId === targetId) {
      const err = new Error('请提供有效的目标标签ID');
      err.statusCode = 400;
      throw err;
    }
    const source = db.prepare('SELECT * FROM tags WHERE id = ?').get(sourceId);
    const target = db.prepare('SELECT * FROM tags WHERE id = ?').get(targetId);
    if (!source || !target) {
      const err = new Error('标签不存在');
      err.statusCode = 404;
      throw err;
    }
    const tx = db.transaction(() => {
      db.prepare(`
        INSERT OR IGNORE INTO entry_tags (entry_id, tag_id, creator_id)
        SELECT entry_id, ?, creator_id FROM entry_tags WHERE tag_id = ?
      `).run(targetId, sourceId);
      db.prepare(`
        INSERT OR IGNORE INTO version_tags (version_id, tag_id, creator_id)
        SELECT version_id, ?, creator_id FROM version_tags WHERE tag_id = ?
      `).run(targetId, sourceId);
      db.prepare('DELETE FROM tags WHERE id = ?').run(sourceId);
      updateTagUsageCount(targetId);
    });
    tx();
    return { ok: true, mergedInto: targetId };
  });
}

module.exports = routes;
module.exports.updateTagUsageCount = updateTagUsageCount;

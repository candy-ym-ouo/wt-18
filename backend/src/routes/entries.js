const { db, createRevisionsFromDiff } = require('../db');
const { authenticate, requirePermission } = require('../auth');
const { updateTagUsageCount } = require('./tags');
const { updateCategoryCounts, getDescendantIds } = require('./categories');

function getEntryTags(entryId) {
  return db.prepare(`
    SELECT t.id, t.name, t.slug, t.color, t.description, et.created_at
    FROM entry_tags et
    JOIN tags t ON et.tag_id = t.id
    WHERE et.entry_id = ? AND t.status = 'active'
    ORDER BY t.usage_count DESC, t.name COLLATE NOCASE ASC
  `).all(entryId);
}

function getEntryCategories(entryId) {
  return db.prepare(`
    SELECT c.id, c.name, c.slug, c.color, c.icon, c.level, c.parent_id, c.path,
      ec.is_primary, ec.created_at
    FROM entry_categories ec
    JOIN categories c ON ec.category_id = c.id
    WHERE ec.entry_id = ? AND c.status = 'active'
    ORDER BY ec.is_primary DESC, c.sort_order ASC, c.name COLLATE NOCASE ASC
  `).all(entryId);
}

async function routes(fastify) {
  fastify.get('/api/entries', async (req) => {
    const { tag_ids, category_id, keyword, dynasty, limit, offset } = req.query;
    let where = [];
    let params = [];
    let joins = '';
    if (tag_ids) {
      const tagIdArr = String(tag_ids).split(',').map(Number).filter(Boolean);
      if (tagIdArr.length) {
        const placeholders = tagIdArr.map(() => '?').join(',');
        joins += ` JOIN entry_tags et ON et.entry_id = e.id `;
        where.push(`et.tag_id IN (${placeholders})`);
        params.push(...tagIdArr);
      }
    }
    if (category_id) {
      const catId = Number(category_id);
      const catIds = getDescendantIds(catId, true);
      const placeholders = catIds.map(() => '?').join(',');
      joins += ` JOIN entry_categories ec ON ec.entry_id = e.id `;
      where.push(`ec.category_id IN (${placeholders})`);
      params.push(...catIds);
    }
    if (keyword) {
      where.push('(e.title LIKE ? OR e.author LIKE ? OR e.summary LIKE ? OR e.dynasty LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    if (dynasty) {
      where.push('e.dynasty = ?');
      params.push(dynasty);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const groupBy = (tag_ids || category_id) ? 'GROUP BY e.id' : '';
    let limitSql = '';
    if (limit) {
      limitSql = `LIMIT ${Number(limit)}${offset ? ` OFFSET ${Number(offset)}` : ''}`;
    }
    const rows = db.prepare(`
      SELECT DISTINCT e.*,
        (SELECT COUNT(*) FROM versions v WHERE v.entry_id = e.id) AS version_count
      FROM entries e ${joins}
      ${whereSql}
      ${groupBy}
      ORDER BY e.id DESC
      ${limitSql}
    `).all(...params);
    const total = db.prepare(`
      SELECT COUNT(DISTINCT e.id) AS c
      FROM entries e ${joins}
      ${whereSql}
    `).get(...params).c;
    return { list: rows, total, hasMore: offset ? total > Number(offset) + Number(limit || 0) : rows.length < total };
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
    const tags = getEntryTags(id);
    const categories = getEntryCategories(id);
    return { ...entry, versions, tags, categories };
  });

  fastify.post('/api/entries', {
    preHandler: [authenticate(), requirePermission('entries:write')]
  }, async (req) => {
    const { title, author, dynasty, summary, cover_url, tag_ids, category_ids, primary_category_id } = req.body;
    const tx = db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO entries (title, author, dynasty, summary, cover_url)
        VALUES (?, ?, ?, ?, ?)
      `).run(title || '', author || '', dynasty || '', summary || '', cover_url || '');
      const entryId = info.lastInsertRowid;
      if (Array.isArray(tag_ids) && tag_ids.length) {
        const tagInsert = db.prepare(`
          INSERT OR IGNORE INTO entry_tags (entry_id, tag_id, creator_id)
          VALUES (?, ?, ?)
        `);
        for (const tid of tag_ids) {
          const t = Number(tid);
          if (t) {
            tagInsert.run(entryId, t, req.user?.id || null);
            updateTagUsageCount(t);
          }
        }
      }
      if (Array.isArray(category_ids) && category_ids.length) {
        const catInsert = db.prepare(`
          INSERT OR IGNORE INTO entry_categories (entry_id, category_id, is_primary, creator_id)
          VALUES (?, ?, ?, ?)
        `);
        for (const cid of category_ids) {
          const c = Number(cid);
          if (c) {
            const isPrimary = primary_category_id && Number(primary_category_id) === c ? 1 : 0;
            catInsert.run(entryId, c, isPrimary, req.user?.id || null);
            updateCategoryCounts(c);
          }
        }
      }
      return { id: entryId };
    });
    return tx();
  });

  fastify.put('/api/entries/:id', {
    preHandler: [authenticate(), requirePermission('entries:write')]
  }, async (req) => {
    const id = Number(req.params.id);
    const { title, author, dynasty, summary, cover_url, tag_ids, category_ids, primary_category_id } = req.body;
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
    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE entries SET title=?, author=?, dynasty=?, summary=?, cover_url=?,
          updated_at = datetime('now','localtime')
        WHERE id = ?
      `).run(newData.title, newData.author, newData.dynasty, newData.summary, newData.cover_url, id);
      createRevisionsFromDiff('entry', id, oldEntry, newData, ['title', 'author', 'dynasty', 'summary', 'cover_url'], req.user);
      if (tag_ids !== undefined) {
        const oldTagIds = db.prepare('SELECT tag_id FROM entry_tags WHERE entry_id = ?').all(id).map(r => r.tag_id);
        const newTagIds = Array.isArray(tag_ids) ? tag_ids.map(Number).filter(Boolean) : [];
        const toRemove = oldTagIds.filter(t => !newTagIds.includes(t));
        const toAdd = newTagIds.filter(t => !oldTagIds.includes(t));
        for (const tid of toRemove) {
          db.prepare('DELETE FROM entry_tags WHERE entry_id = ? AND tag_id = ?').run(id, tid);
          updateTagUsageCount(tid);
        }
        const tagInsert = db.prepare(`
          INSERT OR IGNORE INTO entry_tags (entry_id, tag_id, creator_id)
          VALUES (?, ?, ?)
        `);
        for (const tid of toAdd) {
          tagInsert.run(id, tid, req.user?.id || null);
          updateTagUsageCount(tid);
        }
      }
      if (category_ids !== undefined) {
        const oldCatIds = db.prepare('SELECT category_id FROM entry_categories WHERE entry_id = ?').all(id).map(r => r.category_id);
        const newCatIds = Array.isArray(category_ids) ? category_ids.map(Number).filter(Boolean) : [];
        const toRemove = oldCatIds.filter(c => !newCatIds.includes(c));
        const toAdd = newCatIds.filter(c => !oldCatIds.includes(c));
        for (const cid of toRemove) {
          db.prepare('DELETE FROM entry_categories WHERE entry_id = ? AND category_id = ?').run(id, cid);
          updateCategoryCounts(cid);
        }
        const primaryCatId = primary_category_id ? Number(primary_category_id) : null;
        db.prepare('UPDATE entry_categories SET is_primary = 0 WHERE entry_id = ?').run(id);
        const catInsert = db.prepare(`
          INSERT OR IGNORE INTO entry_categories (entry_id, category_id, is_primary, creator_id)
          VALUES (?, ?, ?, ?)
        `);
        const catUpdate = db.prepare(`
          UPDATE entry_categories SET is_primary = ? WHERE entry_id = ? AND category_id = ?
        `);
        for (const cid of newCatIds) {
          const isPrimary = primaryCatId && primaryCatId === cid ? 1 : 0;
          if (toAdd.includes(cid)) {
            catInsert.run(id, cid, isPrimary, req.user?.id || null);
          } else {
            catUpdate.run(isPrimary, id, cid);
          }
          updateCategoryCounts(cid);
        }
      }
    });
    tx();
    return { ok: true };
  });

  fastify.delete('/api/entries/:id', {
    preHandler: [authenticate(), requirePermission('entries:write')]
  }, async (req) => {
    const id = Number(req.params.id);
    const tagIds = db.prepare('SELECT tag_id FROM entry_tags WHERE entry_id = ?').all(id).map(r => r.tag_id);
    const catIds = db.prepare('SELECT category_id FROM entry_categories WHERE entry_id = ?').all(id).map(r => r.category_id);
    db.prepare('DELETE FROM entries WHERE id = ?').run(id);
    for (const tid of tagIds) updateTagUsageCount(tid);
    for (const cid of catIds) updateCategoryCounts(cid);
    return { ok: true };
  });

  fastify.get('/api/entries/:id/tags', async (req) => {
    const id = Number(req.params.id);
    const entry = db.prepare('SELECT id FROM entries WHERE id = ?').get(id);
    if (!entry) {
      const err = new Error('词条不存在');
      err.statusCode = 404;
      throw err;
    }
    return getEntryTags(id);
  });

  fastify.post('/api/entries/:id/tags', {
    preHandler: [authenticate(), requirePermission('entries:write')]
  }, async (req) => {
    const id = Number(req.params.id);
    const { tag_id, tag_ids } = req.body;
    const entry = db.prepare('SELECT id FROM entries WHERE id = ?').get(id);
    if (!entry) {
      const err = new Error('词条不存在');
      err.statusCode = 404;
      throw err;
    }
    let ids = [];
    if (tag_id) ids.push(Number(tag_id));
    if (Array.isArray(tag_ids)) ids.push(...tag_ids.map(Number));
    ids = ids.filter(Boolean);
    const tagInsert = db.prepare(`
      INSERT OR IGNORE INTO entry_tags (entry_id, tag_id, creator_id)
      VALUES (?, ?, ?)
    `);
    const tx = db.transaction(() => {
      for (const tid of ids) {
        tagInsert.run(id, tid, req.user?.id || null);
        updateTagUsageCount(tid);
      }
    });
    tx();
    return { ok: true, added: ids.length, tags: getEntryTags(id) };
  });

  fastify.delete('/api/entries/:id/tags/:tagId', {
    preHandler: [authenticate(), requirePermission('entries:write')]
  }, async (req) => {
    const id = Number(req.params.id);
    const tagId = Number(req.params.tagId);
    db.prepare('DELETE FROM entry_tags WHERE entry_id = ? AND tag_id = ?').run(id, tagId);
    updateTagUsageCount(tagId);
    return { ok: true, tags: getEntryTags(id) };
  });

  fastify.get('/api/entries/:id/categories', async (req) => {
    const id = Number(req.params.id);
    const entry = db.prepare('SELECT id FROM entries WHERE id = ?').get(id);
    if (!entry) {
      const err = new Error('词条不存在');
      err.statusCode = 404;
      throw err;
    }
    return getEntryCategories(id);
  });

  fastify.post('/api/entries/:id/categories', {
    preHandler: [authenticate(), requirePermission('entries:write')]
  }, async (req) => {
    const id = Number(req.params.id);
    const { category_id, category_ids, is_primary = 0 } = req.body;
    const entry = db.prepare('SELECT id FROM entries WHERE id = ?').get(id);
    if (!entry) {
      const err = new Error('词条不存在');
      err.statusCode = 404;
      throw err;
    }
    let ids = [];
    if (category_id) ids.push(Number(category_id));
    if (Array.isArray(category_ids)) ids.push(...category_ids.map(Number));
    ids = ids.filter(Boolean);
    const tx = db.transaction(() => {
      if (is_primary) {
        db.prepare('UPDATE entry_categories SET is_primary = 0 WHERE entry_id = ?').run(id);
      }
      const catInsert = db.prepare(`
        INSERT OR IGNORE INTO entry_categories (entry_id, category_id, is_primary, creator_id)
        VALUES (?, ?, ?, ?)
      `);
      const catUpdate = db.prepare(`
        UPDATE entry_categories SET is_primary = ? WHERE entry_id = ? AND category_id = ?
      `);
      for (const [i, cid] of ids.entries()) {
        const shouldPrimary = is_primary && i === 0 ? 1 : 0;
        const existing = db.prepare('SELECT id FROM entry_categories WHERE entry_id = ? AND category_id = ?').get(id, cid);
        if (existing) {
          catUpdate.run(shouldPrimary, id, cid);
        } else {
          catInsert.run(id, cid, shouldPrimary, req.user?.id || null);
        }
        updateCategoryCounts(cid);
      }
    });
    tx();
    return { ok: true, added: ids.length, categories: getEntryCategories(id) };
  });

  fastify.delete('/api/entries/:id/categories/:categoryId', {
    preHandler: [authenticate(), requirePermission('entries:write')]
  }, async (req) => {
    const id = Number(req.params.id);
    const catId = Number(req.params.categoryId);
    db.prepare('DELETE FROM entry_categories WHERE entry_id = ? AND category_id = ?').run(id, catId);
    updateCategoryCounts(catId);
    return { ok: true, categories: getEntryCategories(id) };
  });

  fastify.put('/api/entries/:id/categories/:categoryId/primary', {
    preHandler: [authenticate(), requirePermission('entries:write')]
  }, async (req) => {
    const id = Number(req.params.id);
    const catId = Number(req.params.categoryId);
    const rel = db.prepare('SELECT id FROM entry_categories WHERE entry_id = ? AND category_id = ?').get(id, catId);
    if (!rel) {
      const err = new Error('该分类未关联到此词条');
      err.statusCode = 404;
      throw err;
    }
    db.prepare('UPDATE entry_categories SET is_primary = 0 WHERE entry_id = ?').run(id);
    db.prepare('UPDATE entry_categories SET is_primary = 1 WHERE entry_id = ? AND category_id = ?').run(id, catId);
    return { ok: true, categories: getEntryCategories(id) };
  });
}

module.exports = routes;

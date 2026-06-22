const { db, createRevisionsFromDiff } = require('../db');
const { authenticate, requirePermission } = require('../auth');
const { updateTagUsageCount } = require('./tags');
const { updateCategoryCounts, getDescendantIds } = require('./categories');

function getVersionTags(versionId) {
  return db.prepare(`
    SELECT t.id, t.name, t.slug, t.color, t.description, vt.created_at
    FROM version_tags vt
    JOIN tags t ON vt.tag_id = t.id
    WHERE vt.version_id = ? AND t.status = 'active'
    ORDER BY t.usage_count DESC, t.name COLLATE NOCASE ASC
  `).all(versionId);
}

function getVersionCategories(versionId) {
  return db.prepare(`
    SELECT c.id, c.name, c.slug, c.color, c.icon, c.level, c.parent_id, c.path,
      vc.is_primary, vc.created_at
    FROM version_categories vc
    JOIN categories c ON vc.category_id = c.id
    WHERE vc.version_id = ? AND c.status = 'active'
    ORDER BY vc.is_primary DESC, c.sort_order ASC, c.name COLLATE NOCASE ASC
  `).all(versionId);
}

async function routes(fastify) {
  fastify.get('/api/versions', async (req) => {
    const { tag_ids, category_id, entry_id, keyword, pub_year, publisher, limit, offset } = req.query;
    let where = [];
    let params = [];
    let joins = '';
    if (tag_ids) {
      const tagIdArr = String(tag_ids).split(',').map(Number).filter(Boolean);
      if (tagIdArr.length) {
        const placeholders = tagIdArr.map(() => '?').join(',');
        joins += ` JOIN version_tags vt ON vt.version_id = v.id `;
        where.push(`vt.tag_id IN (${placeholders})`);
        params.push(...tagIdArr);
      }
    }
    if (category_id) {
      const catId = Number(category_id);
      const catIds = getDescendantIds(catId, true);
      const placeholders = catIds.map(() => '?').join(',');
      joins += ` JOIN version_categories vc ON vc.version_id = v.id `;
      where.push(`vc.category_id IN (${placeholders})`);
      params.push(...catIds);
    }
    if (entry_id) {
      where.push('v.entry_id = ?');
      params.push(Number(entry_id));
    }
    if (keyword) {
      where.push('(v.version_name LIKE ? OR v.publisher LIKE ? OR v.isbn LIKE ? OR v.description LIKE ? OR e.title LIKE ?)');
      joins += ` LEFT JOIN entries e ON v.entry_id = e.id `;
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    if (pub_year) {
      where.push('v.pub_year = ?');
      params.push(pub_year);
    }
    if (publisher) {
      where.push('v.publisher = ?');
      params.push(publisher);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const groupBy = (tag_ids || category_id) ? 'GROUP BY v.id' : '';
    let limitSql = '';
    if (limit) {
      limitSql = `LIMIT ${Number(limit)}${offset ? ` OFFSET ${Number(offset)}` : ''}`;
    }
    const rows = db.prepare(`
      SELECT DISTINCT v.*, e.title AS entry_title, e.author AS entry_author
      FROM versions v
      LEFT JOIN entries e ON v.entry_id = e.id
      ${joins}
      ${whereSql}
      ${groupBy}
      ORDER BY v.id DESC
      ${limitSql}
    `).all(...params);
    const total = db.prepare(`
      SELECT COUNT(DISTINCT v.id) AS c
      FROM versions v
      ${joins}
      ${whereSql}
    `).get(...params).c;
    return { list: rows, total, hasMore: offset ? total > Number(offset) + Number(limit || 0) : rows.length < total };
  });

  fastify.get('/api/versions/:id', async (req) => {
    const id = Number(req.params.id);
    const version = db.prepare('SELECT * FROM versions WHERE id = ?').get(id);
    if (!version) {
      const err = new Error('版本不存在');
      err.statusCode = 404;
      throw err;
    }
    const entry = db.prepare('SELECT id, title FROM entries WHERE id = ?').get(version.entry_id);
    const tags = getVersionTags(id);
    const categories = getVersionCategories(id);
    return { ...version, entry, tags, categories };
  });

  fastify.get('/api/entries/:entryId/versions', async (req) => {
    const entryId = Number(req.params.entryId);
    const versions = db.prepare('SELECT * FROM versions WHERE entry_id = ? ORDER BY id').all(entryId);
    return versions.map(v => ({
      ...v,
      tags: getVersionTags(v.id),
      categories: getVersionCategories(v.id)
    }));
  });

  fastify.get('/api/compare', async (req) => {
    const ids = (req.query.ids || '').split(',').map(Number).filter(Boolean);
    if (ids.length < 2) return [];
    const placeholders = ids.map(() => '?').join(',');
    return db.prepare(`
      SELECT v.*, e.title AS entry_title
      FROM versions v LEFT JOIN entries e ON v.entry_id = e.id
      WHERE v.id IN (${placeholders})
    `).all(...ids);
  });

  fastify.post('/api/versions', {
    preHandler: [authenticate(), requirePermission('versions:write')]
  }, async (req) => {
    const { entry_id, version_name, publisher, pub_year, pages, isbn, description, full_text, tag_ids, category_ids, primary_category_id } = req.body;
    const tx = db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO versions (entry_id, version_name, publisher, pub_year, pages, isbn, description, full_text)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(entry_id, version_name, publisher || '', pub_year || '', pages || null, isbn || '', description || '', full_text || '');
      const versionId = info.lastInsertRowid;
      if (Array.isArray(tag_ids) && tag_ids.length) {
        const tagInsert = db.prepare(`
          INSERT OR IGNORE INTO version_tags (version_id, tag_id, creator_id)
          VALUES (?, ?, ?)
        `);
        for (const tid of tag_ids) {
          const t = Number(tid);
          if (t) {
            tagInsert.run(versionId, t, req.user?.id || null);
            updateTagUsageCount(t);
          }
        }
      }
      if (Array.isArray(category_ids) && category_ids.length) {
        const catInsert = db.prepare(`
          INSERT OR IGNORE INTO version_categories (version_id, category_id, is_primary, creator_id)
          VALUES (?, ?, ?, ?)
        `);
        for (const cid of category_ids) {
          const c = Number(cid);
          if (c) {
            const isPrimary = primary_category_id && Number(primary_category_id) === c ? 1 : 0;
            catInsert.run(versionId, c, isPrimary, req.user?.id || null);
            updateCategoryCounts(c);
          }
        }
      }
      return { id: versionId };
    });
    return tx();
  });

  fastify.put('/api/versions/:id', {
    preHandler: [authenticate(), requirePermission('versions:write')]
  }, async (req) => {
    const id = Number(req.params.id);
    const { version_name, publisher, pub_year, pages, isbn, description, full_text, tag_ids, category_ids, primary_category_id } = req.body;
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
    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE versions SET version_name=?, publisher=?, pub_year=?, pages=?, isbn=?, description=?, full_text=?,
          updated_at = datetime('now','localtime')
        WHERE id = ?
      `).run(newData.version_name, newData.publisher, newData.pub_year, newData.pages, newData.isbn, newData.description, newData.full_text, id);
      createRevisionsFromDiff('version', id, oldVersion, newData, ['version_name', 'publisher', 'pub_year', 'pages', 'isbn', 'description', 'full_text'], req.user);
      if (tag_ids !== undefined) {
        const oldTagIds = db.prepare('SELECT tag_id FROM version_tags WHERE version_id = ?').all(id).map(r => r.tag_id);
        const newTagIds = Array.isArray(tag_ids) ? tag_ids.map(Number).filter(Boolean) : [];
        const toRemove = oldTagIds.filter(t => !newTagIds.includes(t));
        const toAdd = newTagIds.filter(t => !oldTagIds.includes(t));
        for (const tid of toRemove) {
          db.prepare('DELETE FROM version_tags WHERE version_id = ? AND tag_id = ?').run(id, tid);
          updateTagUsageCount(tid);
        }
        const tagInsert = db.prepare(`
          INSERT OR IGNORE INTO version_tags (version_id, tag_id, creator_id)
          VALUES (?, ?, ?)
        `);
        for (const tid of toAdd) {
          tagInsert.run(id, tid, req.user?.id || null);
          updateTagUsageCount(tid);
        }
      }
      if (category_ids !== undefined) {
        const oldCatIds = db.prepare('SELECT category_id FROM version_categories WHERE version_id = ?').all(id).map(r => r.category_id);
        const newCatIds = Array.isArray(category_ids) ? category_ids.map(Number).filter(Boolean) : [];
        const toRemove = oldCatIds.filter(c => !newCatIds.includes(c));
        const toAdd = newCatIds.filter(c => !oldCatIds.includes(c));
        for (const cid of toRemove) {
          db.prepare('DELETE FROM version_categories WHERE version_id = ? AND category_id = ?').run(id, cid);
          updateCategoryCounts(cid);
        }
        const primaryCatId = primary_category_id ? Number(primary_category_id) : null;
        db.prepare('UPDATE version_categories SET is_primary = 0 WHERE version_id = ?').run(id);
        const catInsert = db.prepare(`
          INSERT OR IGNORE INTO version_categories (version_id, category_id, is_primary, creator_id)
          VALUES (?, ?, ?, ?)
        `);
        const catUpdate = db.prepare(`
          UPDATE version_categories SET is_primary = ? WHERE version_id = ? AND category_id = ?
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

  fastify.delete('/api/versions/:id', {
    preHandler: [authenticate(), requirePermission('versions:write')]
  }, async (req) => {
    const id = Number(req.params.id);
    const tagIds = db.prepare('SELECT tag_id FROM version_tags WHERE version_id = ?').all(id).map(r => r.tag_id);
    const catIds = db.prepare('SELECT category_id FROM version_categories WHERE version_id = ?').all(id).map(r => r.category_id);
    db.prepare('DELETE FROM versions WHERE id = ?').run(id);
    for (const tid of tagIds) updateTagUsageCount(tid);
    for (const cid of catIds) updateCategoryCounts(cid);
    return { ok: true };
  });

  fastify.get('/api/versions/:id/tags', async (req) => {
    const id = Number(req.params.id);
    const version = db.prepare('SELECT id FROM versions WHERE id = ?').get(id);
    if (!version) {
      const err = new Error('版本不存在');
      err.statusCode = 404;
      throw err;
    }
    return getVersionTags(id);
  });

  fastify.post('/api/versions/:id/tags', {
    preHandler: [authenticate(), requirePermission('versions:write')]
  }, async (req) => {
    const id = Number(req.params.id);
    const { tag_id, tag_ids } = req.body;
    const version = db.prepare('SELECT id FROM versions WHERE id = ?').get(id);
    if (!version) {
      const err = new Error('版本不存在');
      err.statusCode = 404;
      throw err;
    }
    let ids = [];
    if (tag_id) ids.push(Number(tag_id));
    if (Array.isArray(tag_ids)) ids.push(...tag_ids.map(Number));
    ids = ids.filter(Boolean);
    const tagInsert = db.prepare(`
      INSERT OR IGNORE INTO version_tags (version_id, tag_id, creator_id)
      VALUES (?, ?, ?)
    `);
    const tx = db.transaction(() => {
      for (const tid of ids) {
        tagInsert.run(id, tid, req.user?.id || null);
        updateTagUsageCount(tid);
      }
    });
    tx();
    return { ok: true, added: ids.length, tags: getVersionTags(id) };
  });

  fastify.delete('/api/versions/:id/tags/:tagId', {
    preHandler: [authenticate(), requirePermission('versions:write')]
  }, async (req) => {
    const id = Number(req.params.id);
    const tagId = Number(req.params.tagId);
    db.prepare('DELETE FROM version_tags WHERE version_id = ? AND tag_id = ?').run(id, tagId);
    updateTagUsageCount(tagId);
    return { ok: true, tags: getVersionTags(id) };
  });

  fastify.get('/api/versions/:id/categories', async (req) => {
    const id = Number(req.params.id);
    const version = db.prepare('SELECT id FROM versions WHERE id = ?').get(id);
    if (!version) {
      const err = new Error('版本不存在');
      err.statusCode = 404;
      throw err;
    }
    return getVersionCategories(id);
  });

  fastify.post('/api/versions/:id/categories', {
    preHandler: [authenticate(), requirePermission('versions:write')]
  }, async (req) => {
    const id = Number(req.params.id);
    const { category_id, category_ids, is_primary = 0 } = req.body;
    const version = db.prepare('SELECT id FROM versions WHERE id = ?').get(id);
    if (!version) {
      const err = new Error('版本不存在');
      err.statusCode = 404;
      throw err;
    }
    let ids = [];
    if (category_id) ids.push(Number(category_id));
    if (Array.isArray(category_ids)) ids.push(...category_ids.map(Number));
    ids = ids.filter(Boolean);
    const tx = db.transaction(() => {
      if (is_primary) {
        db.prepare('UPDATE version_categories SET is_primary = 0 WHERE version_id = ?').run(id);
      }
      const catInsert = db.prepare(`
        INSERT OR IGNORE INTO version_categories (version_id, category_id, is_primary, creator_id)
        VALUES (?, ?, ?, ?)
      `);
      const catUpdate = db.prepare(`
        UPDATE version_categories SET is_primary = ? WHERE version_id = ? AND category_id = ?
      `);
      for (const [i, cid] of ids.entries()) {
        const shouldPrimary = is_primary && i === 0 ? 1 : 0;
        const existing = db.prepare('SELECT id FROM version_categories WHERE version_id = ? AND category_id = ?').get(id, cid);
        if (existing) {
          catUpdate.run(shouldPrimary, id, cid);
        } else {
          catInsert.run(id, cid, shouldPrimary, req.user?.id || null);
        }
        updateCategoryCounts(cid);
      }
    });
    tx();
    return { ok: true, added: ids.length, categories: getVersionCategories(id) };
  });

  fastify.delete('/api/versions/:id/categories/:categoryId', {
    preHandler: [authenticate(), requirePermission('versions:write')]
  }, async (req) => {
    const id = Number(req.params.id);
    const catId = Number(req.params.categoryId);
    db.prepare('DELETE FROM version_categories WHERE version_id = ? AND category_id = ?').run(id, catId);
    updateCategoryCounts(catId);
    return { ok: true, categories: getVersionCategories(id) };
  });

  fastify.put('/api/versions/:id/categories/:categoryId/primary', {
    preHandler: [authenticate(), requirePermission('versions:write')]
  }, async (req) => {
    const id = Number(req.params.id);
    const catId = Number(req.params.categoryId);
    const rel = db.prepare('SELECT id FROM version_categories WHERE version_id = ? AND category_id = ?').get(id, catId);
    if (!rel) {
      const err = new Error('该分类未关联到此版本');
      err.statusCode = 404;
      throw err;
    }
    db.prepare('UPDATE version_categories SET is_primary = 0 WHERE version_id = ?').run(id);
    db.prepare('UPDATE version_categories SET is_primary = 1 WHERE version_id = ? AND category_id = ?').run(id, catId);
    return { ok: true, categories: getVersionCategories(id) };
  });
}

module.exports = routes;

const { db } = require('../db');
const { authenticate, requirePermission } = require('../auth');

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100) || `cat-${Date.now()}`;
}

function buildCategoryTree(categories, parentId = null) {
  const tree = [];
  for (const cat of categories) {
    if (cat.parent_id === parentId) {
      const children = buildCategoryTree(categories, cat.id);
      if (children.length) cat.children = children;
      tree.push(cat);
    }
  }
  return tree;
}

function updateCategoryCounts(categoryId) {
  const entryCount = db.prepare('SELECT COUNT(*) AS c FROM entry_categories WHERE category_id = ?').get(categoryId).c;
  const versionCount = db.prepare('SELECT COUNT(*) AS c FROM version_categories WHERE category_id = ?').get(categoryId).c;
  db.prepare(`
    UPDATE categories SET entry_count = ?, version_count = ?,
      updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(entryCount, versionCount, categoryId);
  const cat = db.prepare('SELECT parent_id FROM categories WHERE id = ?').get(categoryId);
  if (cat && cat.parent_id) {
    updateCategoryCounts(cat.parent_id);
  }
}

function getDescendantIds(categoryId, includeSelf = true) {
  const ids = includeSelf ? [categoryId] : [];
  const children = db.prepare('SELECT id FROM categories WHERE parent_id = ?').all(categoryId);
  for (const child of children) {
    ids.push(...getDescendantIds(child.id, true));
  }
  return ids;
}

async function routes(fastify) {

  fastify.get('/api/categories', async (req) => {
    const { tree = 'true', status = 'active' } = req.query;
    let where = [];
    let params = [];
    if (status) {
      where.push('status = ?');
      params.push(status);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = db.prepare(`
      SELECT * FROM categories ${whereSql}
      ORDER BY sort_order ASC, id ASC
    `).all(...params);
    if (tree === 'false' || tree === '0') {
      return rows;
    }
    return buildCategoryTree(rows.map(r => ({ ...r })), null);
  });

  fastify.get('/api/categories/:id', async (req) => {
    const id = Number(req.params.id);
    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!cat) {
      const err = new Error('分类不存在');
      err.statusCode = 404;
      throw err;
    }
    const catIds = getDescendantIds(id, true);
    const placeholders = catIds.map(() => '?').join(',');
    const entries = db.prepare(`
      SELECT DISTINCT e.id, e.title, e.author, e.dynasty, e.cover_url, e.created_at,
        ec.is_primary
      FROM entry_categories ec
      JOIN entries e ON ec.entry_id = e.id
      WHERE ec.category_id IN (${placeholders})
      ORDER BY ec.is_primary DESC, e.id DESC
      LIMIT 100
    `).all(...catIds);
    const versions = db.prepare(`
      SELECT DISTINCT v.id, v.version_name, v.publisher, v.pub_year, v.entry_id,
        e.title AS entry_title, vc.is_primary
      FROM version_categories vc
      JOIN versions v ON vc.version_id = v.id
      LEFT JOIN entries e ON v.entry_id = e.id
      WHERE vc.category_id IN (${placeholders})
      ORDER BY vc.is_primary DESC, v.id DESC
      LIMIT 100
    `).all(...catIds);
    const breadcrumb = [];
    let current = cat;
    while (current) {
      breadcrumb.unshift({ id: current.id, name: current.name, slug: current.slug });
      current = current.parent_id ? db.prepare('SELECT id, name, slug, parent_id FROM categories WHERE id = ?').get(current.parent_id) : null;
    }
    const children = db.prepare(`
      SELECT * FROM categories WHERE parent_id = ? AND status = 'active'
      ORDER BY sort_order ASC, id ASC
    `).all(id);
    return { ...cat, entries, versions, breadcrumb, children, entryCount: entries.length, versionCount: versions.length };
  });

  fastify.get('/api/categories/slug/:slug', async (req) => {
    const cat = db.prepare('SELECT * FROM categories WHERE slug = ?').get(req.params.slug);
    if (!cat) {
      const err = new Error('分类不存在');
      err.statusCode = 404;
      throw err;
    }
    const catIds = getDescendantIds(cat.id, true);
    const placeholders = catIds.map(() => '?').join(',');
    const entries = db.prepare(`
      SELECT DISTINCT e.id, e.title, e.author, e.dynasty, e.cover_url, e.created_at,
        ec.is_primary
      FROM entry_categories ec
      JOIN entries e ON ec.entry_id = e.id
      WHERE ec.category_id IN (${placeholders})
      ORDER BY ec.is_primary DESC, e.id DESC
      LIMIT 100
    `).all(...catIds);
    const versions = db.prepare(`
      SELECT DISTINCT v.id, v.version_name, v.publisher, v.pub_year, v.entry_id,
        e.title AS entry_title, vc.is_primary
      FROM version_categories vc
      JOIN versions v ON vc.version_id = v.id
      LEFT JOIN entries e ON v.entry_id = e.id
      WHERE vc.category_id IN (${placeholders})
      ORDER BY vc.is_primary DESC, v.id DESC
      LIMIT 100
    `).all(...catIds);
    const breadcrumb = [];
    let current = cat;
    while (current) {
      breadcrumb.unshift({ id: current.id, name: current.name, slug: current.slug });
      current = current.parent_id ? db.prepare('SELECT id, name, slug, parent_id FROM categories WHERE id = ?').get(current.parent_id) : null;
    }
    return { ...cat, entries, versions, breadcrumb, entryCount: entries.length, versionCount: versions.length };
  });

  fastify.get('/api/admin/categories', {
    preHandler: [authenticate(), requirePermission('categories:read')]
  }, async (req) => {
    const { tree = 'true', keyword, status } = req.query;
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
    const rows = db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM entry_categories ec WHERE ec.category_id = c.id) AS entry_count,
        (SELECT COUNT(*) FROM version_categories vc WHERE vc.category_id = c.id) AS version_count
      FROM categories c ${whereSql}
      ORDER BY c.sort_order ASC, c.id ASC
    `).all(...params);
    if (tree === 'false' || tree === '0') {
      return rows;
    }
    return buildCategoryTree(rows.map(r => ({ ...r })), null);
  });

  fastify.get('/api/admin/categories/:id', {
    preHandler: [authenticate(), requirePermission('categories:read')]
  }, async (req) => {
    const id = Number(req.params.id);
    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!cat) {
      const err = new Error('分类不存在');
      err.statusCode = 404;
      throw err;
    }
    return cat;
  });

  fastify.post('/api/admin/categories', {
    preHandler: [authenticate(), requirePermission('categories:write')]
  }, async (req) => {
    const { name, slug, parent_id, color, icon, description, sort_order, status } = req.body;
    if (!name || !name.trim()) {
      const err = new Error('分类名称必填');
      err.statusCode = 400;
      throw err;
    }
    const trimmedName = name.trim();
    let parentId = parent_id ? Number(parent_id) : null;
    let level = 1;
    let path = '';
    if (parentId) {
      const parent = db.prepare('SELECT * FROM categories WHERE id = ?').get(parentId);
      if (!parent) {
        const err = new Error('父级分类不存在');
        err.statusCode = 400;
        throw err;
      }
      level = parent.level + 1;
      path = parent.path ? `${parent.path},${parentId}` : String(parentId);
    }
    let finalSlug = slug ? slug.trim() : generateSlug(trimmedName);
    const slugExists = db.prepare('SELECT id FROM categories WHERE slug = ?').get(finalSlug);
    if (slugExists) {
      finalSlug = `${finalSlug}-${Date.now()}`;
    }
    const info = db.prepare(`
      INSERT INTO categories (name, slug, parent_id, level, path, color, icon, description, sort_order, status, creator_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      trimmedName,
      finalSlug,
      parentId,
      level,
      path,
      color || '#10b981',
      icon || '',
      description || '',
      sort_order || 0,
      status || 'active',
      req.user?.id || null
    );
    return { id: info.lastInsertRowid, name: trimmedName, slug: finalSlug, level };
  });

  fastify.put('/api/admin/categories/:id', {
    preHandler: [authenticate(), requirePermission('categories:write')]
  }, async (req) => {
    const id = Number(req.params.id);
    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!cat) {
      const err = new Error('分类不存在');
      err.statusCode = 404;
      throw err;
    }
    const { name, slug, parent_id, color, icon, description, sort_order, status } = req.body;
    let finalName = name ? name.trim() : cat.name;
    if (name && name.trim() !== cat.name) {
      const dup = db.prepare('SELECT id FROM categories WHERE name = ? AND parent_id IS ? AND id != ?').get(
        finalName,
        parent_id !== undefined ? (parent_id ? Number(parent_id) : null) : (cat.parent_id ? cat.parent_id : null),
        id
      );
      if (dup) {
        const err = new Error('同级分类下名称已存在');
        err.statusCode = 409;
        throw err;
      }
    }
    let finalSlug = slug ? slug.trim() : cat.slug;
    if (slug && slug.trim() !== cat.slug) {
      const slugExists = db.prepare('SELECT id FROM categories WHERE slug = ? AND id != ?').get(finalSlug, id);
      if (slugExists) {
        const err = new Error('分类别名已存在');
        err.statusCode = 409;
        throw err;
      }
    }
    let parentId = parent_id !== undefined ? (parent_id ? Number(parent_id) : null) : cat.parent_id;
    let level = cat.level;
    let path = cat.path;
    if (parentId !== cat.parent_id) {
      if (parentId === id) {
        const err = new Error('不能将自己设为父级分类');
        err.statusCode = 400;
        throw err;
      }
      const descendantIds = getDescendantIds(id, true);
      if (parentId && descendantIds.includes(parentId)) {
        const err = new Error('不能将子分类设为父级分类');
        err.statusCode = 400;
        throw err;
      }
      if (parentId) {
        const parent = db.prepare('SELECT * FROM categories WHERE id = ?').get(parentId);
        if (!parent) {
          const err = new Error('父级分类不存在');
          err.statusCode = 400;
          throw err;
        }
        level = parent.level + 1;
        path = parent.path ? `${parent.path},${parentId}` : String(parentId);
      } else {
        level = 1;
        path = '';
      }
      const tx = db.transaction(() => {
        const updateStmt = db.prepare(`
          UPDATE categories SET level = level + ?, path = CASE WHEN ? = '' THEN path ELSE ? || ',' || SUBSTR(path, LENGTH(?) + 2) END
          WHERE id = ?
        `);
        const levelDiff = level - cat.level;
        const descendants = getDescendantIds(id, false);
        for (const did of descendants) {
          updateStmt.run(levelDiff, cat.path, path, cat.path || '', did);
        }
      });
      tx();
    }
    db.prepare(`
      UPDATE categories SET name=?, slug=?, parent_id=?, level=?, path=?, color=?, icon=?, description=?, sort_order=?, status=?,
        updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(
      finalName,
      finalSlug,
      parentId,
      level,
      path,
      color || cat.color,
      icon !== undefined ? (icon || '') : cat.icon,
      description !== undefined ? description : cat.description,
      sort_order !== undefined ? sort_order : cat.sort_order,
      status || cat.status,
      id
    );
    return { ok: true };
  });

  fastify.delete('/api/admin/categories/:id', {
    preHandler: [authenticate(), requirePermission('categories:write')]
  }, async (req) => {
    const id = Number(req.params.id);
    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!cat) {
      const err = new Error('分类不存在');
      err.statusCode = 404;
      throw err;
    }
    const children = db.prepare('SELECT COUNT(*) AS c FROM categories WHERE parent_id = ?').get(id).c;
    if (children > 0) {
      const err = new Error('该分类下存在子分类，请先删除或移动子分类');
      err.statusCode = 400;
      throw err;
    }
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    return { ok: true };
  });

  fastify.post('/api/admin/categories/:id/move', {
    preHandler: [authenticate(), requirePermission('categories:write')]
  }, async (req) => {
    const id = Number(req.params.id);
    const { target_id, position = 'inside' } = req.body;
    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!cat) {
      const err = new Error('分类不存在');
      err.statusCode = 404;
      throw err;
    }
    const targetId = target_id ? Number(target_id) : null;
    if (targetId === id) {
      const err = new Error('不能移动到自身');
      err.statusCode = 400;
      throw err;
    }
    const descendantIds = getDescendantIds(id, true);
    if (targetId && descendantIds.includes(targetId)) {
      const err = new Error('不能移动到自身的子分类下');
      err.statusCode = 400;
      throw err;
    }
    let newParentId = null;
    let newSortOrder = cat.sort_order;
    if (position === 'inside') {
      newParentId = targetId;
      const maxSort = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS s FROM categories WHERE parent_id IS ?').get(
        targetId ? targetId : null
      ).s;
      newSortOrder = maxSort;
    } else if (position === 'before' || position === 'after') {
      if (!targetId) {
        const err = new Error('此操作需要目标分类');
        err.statusCode = 400;
        throw err;
      }
      const target = db.prepare('SELECT * FROM categories WHERE id = ?').get(targetId);
      if (!target) {
        const err = new Error('目标分类不存在');
        err.statusCode = 404;
        throw err;
      }
      newParentId = target.parent_id;
      if (position === 'before') {
        newSortOrder = target.sort_order - 1;
      } else {
        newSortOrder = target.sort_order + 1;
      }
    }
    let newLevel = 1;
    let newPath = '';
    if (newParentId) {
      const newParent = db.prepare('SELECT * FROM categories WHERE id = ?').get(newParentId);
      if (newParent) {
        newLevel = newParent.level + 1;
        newPath = newParent.path ? `${newParent.path},${newParentId}` : String(newParentId);
      }
    }
    const tx = db.transaction(() => {
      const levelDiff = newLevel - cat.level;
      const descendants = getDescendantIds(id, false);
      for (const did of descendants) {
        const dcat = db.prepare('SELECT * FROM categories WHERE id = ?').get(did);
        const dLevelDiff = levelDiff;
        const oldPath = cat.path ? `${cat.path},${id}` : String(id);
        const newDPrefix = newPath ? `${newPath},${id}` : String(id);
        let dNewPath = dcat.path;
        if (dcat.path.startsWith(oldPath)) {
          dNewPath = newDPrefix + dcat.path.slice(oldPath.length);
        }
        db.prepare('UPDATE categories SET level = level + ?, path = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(
          dLevelDiff, dNewPath, did
        );
      }
      db.prepare(`
        UPDATE categories SET parent_id=?, level=?, path=?, sort_order=?,
          updated_at = datetime('now','localtime')
        WHERE id = ?
      `).run(newParentId, newLevel, newPath, newSortOrder, id);
    });
    tx();
    return { ok: true, newParentId, newLevel, newSortOrder };
  });
}

module.exports = routes;
module.exports.updateCategoryCounts = updateCategoryCounts;
module.exports.getDescendantIds = getDescendantIds;

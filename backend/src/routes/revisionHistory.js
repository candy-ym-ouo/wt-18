const { db, createRevision } = require('../db');
const { authenticate, requirePermission } = require('../auth');

const ENTITY_CONFIG = {
  entry: {
    table: 'entries',
    fields: ['title', 'author', 'dynasty', 'summary', 'cover_url'],
    label: '词条',
    hasUpdatedAt: true,
    fieldTypes: {
      title: 'text', author: 'text', dynasty: 'text', summary: 'text', cover_url: 'text'
    }
  },
  version: {
    table: 'versions',
    fields: ['version_name', 'publisher', 'pub_year', 'pages', 'isbn', 'description', 'full_text'],
    label: '版本',
    hasUpdatedAt: true,
    fieldTypes: {
      version_name: 'text', publisher: 'text', pub_year: 'text',
      pages: 'integer', isbn: 'text', description: 'text', full_text: 'text'
    }
  }
};

async function routes(fastify) {
  fastify.get('/api/revisions/:entityType/:entityId', {
    preHandler: [authenticate(), requirePermission('revisions:read')]
  }, async (req) => {
    const { entityType, entityId } = req.params;
    if (!ENTITY_CONFIG[entityType]) {
      const err = new Error('不支持的实体类型');
      err.statusCode = 400;
      throw err;
    }
    const rows = db.prepare(`
      SELECT rh.*, u.username
      FROM revision_history rh
      LEFT JOIN users u ON rh.user_id = u.id
      WHERE rh.entity_type = ? AND rh.entity_id = ?
      ORDER BY rh.id DESC
    `).all(entityType, Number(entityId));
    return rows;
  });

  fastify.get('/api/revisions/:id', {
    preHandler: [authenticate(), requirePermission('revisions:read')]
  }, async (req) => {
    const id = Number(req.params.id);
    const row = db.prepare(`
      SELECT rh.*, u.username
      FROM revision_history rh
      LEFT JOIN users u ON rh.user_id = u.id
      WHERE rh.id = ?
    `).get(id);
    if (!row) {
      const err = new Error('修订记录不存在');
      err.statusCode = 404;
      throw err;
    }
    return row;
  });

  fastify.post('/api/revisions/:id/rollback', {
    preHandler: [authenticate(), requirePermission('revisions:rollback')]
  }, async (req) => {
    const id = Number(req.params.id);
    const revision = db.prepare('SELECT * FROM revision_history WHERE id = ?').get(id);
    if (!revision) {
      const err = new Error('修订记录不存在');
      err.statusCode = 404;
      throw err;
    }
    const config = ENTITY_CONFIG[revision.entity_type];
    if (!config) {
      const err = new Error('不支持的实体类型');
      err.statusCode = 400;
      throw err;
    }
    if (!config.fields.includes(revision.field_name)) {
      const err = new Error('不支持回滚该字段');
      err.statusCode = 400;
      throw err;
    }
    const currentEntity = db.prepare(`SELECT * FROM ${config.table} WHERE id = ?`).get(revision.entity_id);
    if (!currentEntity) {
      const err = new Error(`${config.label}不存在或已被删除`);
      err.statusCode = 404;
      throw err;
    }

    const fieldType = config.fieldTypes[revision.field_name] || 'text';
    let restoredValue = revision.old_value;
    if (fieldType === 'integer') {
      if (restoredValue === null || restoredValue === '' || restoredValue === undefined) {
        restoredValue = null;
      } else {
        restoredValue = Number(restoredValue);
      }
    }

    let updateSql;
    const params = [restoredValue];
    if (config.hasUpdatedAt) {
      updateSql = `UPDATE ${config.table} SET ${revision.field_name} = ?, updated_at = datetime('now','localtime') WHERE id = ?`;
    } else {
      updateSql = `UPDATE ${config.table} SET ${revision.field_name} = ? WHERE id = ?`;
    }
    params.push(revision.entity_id);
    db.prepare(updateSql).run(...params);

    createRevision(
      revision.entity_type,
      revision.entity_id,
      revision.field_name,
      currentEntity[revision.field_name],
      restoredValue,
      req.user
    );

    return { ok: true, restored_value: restoredValue };
  });

  fastify.get('/api/revisions/snapshot/:entityType/:entityId', {
    preHandler: [authenticate(), requirePermission('revisions:read')]
  }, async (req) => {
    const { entityType, entityId } = req.params;
    const config = ENTITY_CONFIG[entityType];
    if (!config) {
      const err = new Error('不支持的实体类型');
      err.statusCode = 400;
      throw err;
    }
    const current = db.prepare(`SELECT * FROM ${config.table} WHERE id = ?`).get(Number(entityId));
    if (!current) {
      const err = new Error(`${config.label}不存在`);
      err.statusCode = 404;
      throw err;
    }
    const snapshot = {};
    for (const f of config.fields) snapshot[f] = current[f];
    return { current: snapshot };
  });
}

module.exports = routes;

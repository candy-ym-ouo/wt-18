const { db } = require('../db');
const { authenticate, requirePermission } = require('../auth');

const COLLATION_STATUSES = ['draft', 'in_progress', 'review', 'done', 'archived'];
const DIFF_TYPES = ['character', 'punctuation', 'wording', 'paragraph', 'missing', 'extra', 'other'];
const CONCLUSION_TYPES = ['accept_base', 'accept_target', 'custom', 'needs_research', 'no_difference'];
const CONCLUSION_STATUSES = ['pending', 'reviewed', 'approved', 'rejected'];

function parseVersionIds(idsStr) {
  try {
    return JSON.parse(idsStr);
  } catch (e) {
    return [];
  }
}

function splitIntoParagraphs(text) {
  if (!text) return [];
  return text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
}

function getCollationTaskWithDetails(id) {
  const task = db.prepare('SELECT * FROM collation_tasks WHERE id = ?').get(id);
  if (!task) return null;

  const creator = db.prepare('SELECT id, username, display_name FROM users WHERE id = ?').get(task.creator_id);
  const reviewer = task.reviewer_id ? db.prepare('SELECT id, username, display_name FROM users WHERE id = ?').get(task.reviewer_id) : null;
  const entry = db.prepare('SELECT id, title FROM entries WHERE id = ?').get(task.entry_id);
  const baseVersion = db.prepare('SELECT id, version_name FROM versions WHERE id = ?').get(task.base_version_id);
  const targetVersionIds = parseVersionIds(task.target_version_ids);
  const targetVersions = db.prepare(`SELECT id, version_name FROM versions WHERE id IN (${targetVersionIds.join(',')})`).all();

  const diffCount = db.prepare('SELECT COUNT(*) as count FROM collation_diffs WHERE collation_task_id = ?').get(id).count;
  const conclusionCount = db.prepare('SELECT COUNT(*) as count FROM collation_conclusions WHERE collation_task_id = ?').get(id).count;
  const paragraphCount = db.prepare('SELECT COUNT(DISTINCT paragraph_index) as count FROM collation_paragraphs WHERE collation_task_id = ?').get(id).count;

  return {
    ...task,
    target_version_ids: targetVersionIds,
    creator: creator || { id: null, username: '未知用户', display_name: '未知用户' },
    reviewer,
    entry,
    base_version: baseVersion,
    target_versions: targetVersions,
    diff_count: diffCount,
    conclusion_count: conclusionCount,
    paragraph_count: paragraphCount
  };
}

async function routes(fastify) {
  fastify.get('/api/collation', {
    preHandler: [authenticate(), requirePermission('collation:read')]
  }, async (req) => {
    const { entryId, status, creatorId } = req.query;
    let sql = 'SELECT * FROM collation_tasks WHERE 1=1';
    const params = [];

    if (entryId) {
      sql += ' AND entry_id = ?';
      params.push(Number(entryId));
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (creatorId) {
      sql += ' AND creator_id = ?';
      params.push(Number(creatorId));
    }

    sql += ' ORDER BY updated_at DESC';
    const tasks = db.prepare(sql).all(...params);
    return tasks.map(t => getCollationTaskWithDetails(t.id));
  });

  fastify.get('/api/collation/:id', {
    preHandler: [authenticate(), requirePermission('collation:read')]
  }, async (req, reply) => {
    const id = Number(req.params.id);
    const task = getCollationTaskWithDetails(id);
    if (!task) {
      reply.code(404);
      return { error: '校勘任务不存在', code: 'COLLATION_NOT_FOUND' };
    }
    return task;
  });

  fastify.get('/api/collation/:id/paragraphs', {
    preHandler: [authenticate(), requirePermission('collation:read')]
  }, async (req, reply) => {
    const id = Number(req.params.id);
    const task = db.prepare('SELECT * FROM collation_tasks WHERE id = ?').get(id);
    if (!task) {
      reply.code(404);
      return { error: '校勘任务不存在', code: 'COLLATION_NOT_FOUND' };
    }

    const allVersionIds = [task.base_version_id, ...parseVersionIds(task.target_version_ids)];
    const paragraphs = db.prepare(`
      SELECT cp.*, v.version_name
      FROM collation_paragraphs cp
      JOIN versions v ON cp.version_id = v.id
      WHERE cp.collation_task_id = ?
      ORDER BY cp.paragraph_index, cp.version_id
    `).all(id);

    const maxIndex = paragraphs.length > 0 ? Math.max(...paragraphs.map(p => p.paragraph_index)) : -1;
    const result = [];
    for (let i = 0; i <= maxIndex; i++) {
      const paraGroup = { index: i, versions: {} };
      for (const vid of allVersionIds) {
        const p = paragraphs.find(x => x.paragraph_index === i && x.version_id === vid);
        if (p) {
          paraGroup.versions[vid] = {
            id: p.id,
            content: p.content,
            version_id: p.version_id,
            version_name: p.version_name
          };
        }
      }
      result.push(paraGroup);
    }
    return result;
  });

  fastify.get('/api/collation/:id/diffs', {
    preHandler: [authenticate(), requirePermission('collation:read')]
  }, async (req, reply) => {
    const id = Number(req.params.id);
    const task = db.prepare('SELECT id FROM collation_tasks WHERE id = ?').get(id);
    if (!task) {
      reply.code(404);
      return { error: '校勘任务不存在', code: 'COLLATION_NOT_FOUND' };
    }

    const diffs = db.prepare(`
      SELECT cd.*, v.version_name as target_version_name,
             u.username as creator_username, u.display_name as creator_display_name
      FROM collation_diffs cd
      LEFT JOIN versions v ON cd.target_version_id = v.id
      LEFT JOIN users u ON cd.creator_id = u.id
      WHERE cd.collation_task_id = ?
      ORDER BY cd.paragraph_index, cd.created_at
    `).all(id);

    return diffs;
  });

  fastify.get('/api/collation/:id/conclusions', {
    preHandler: [authenticate(), requirePermission('collation:read')]
  }, async (req, reply) => {
    const id = Number(req.params.id);
    const task = db.prepare('SELECT id FROM collation_tasks WHERE id = ?').get(id);
    if (!task) {
      reply.code(404);
      return { error: '校勘任务不存在', code: 'COLLATION_NOT_FOUND' };
    }

    const conclusions = db.prepare(`
      SELECT cc.*,
             cu.username as creator_username, cu.display_name as creator_display_name,
             ru.username as reviewer_username, ru.display_name as reviewer_display_name
      FROM collation_conclusions cc
      LEFT JOIN users cu ON cc.creator_id = cu.id
      LEFT JOIN users ru ON cc.reviewer_id = ru.id
      WHERE cc.collation_task_id = ?
      ORDER BY cc.paragraph_index, cc.created_at
    `).all(id);

    return conclusions;
  });

  fastify.post('/api/collation', {
    preHandler: [authenticate(), requirePermission('collation:write')]
  }, async (req, reply) => {
    const { entryId, title, description, baseVersionId, targetVersionIds, taskId } = req.body;

    if (!entryId || !title || !baseVersionId || !Array.isArray(targetVersionIds) || targetVersionIds.length === 0) {
      reply.code(400);
      return { error: '参数不完整：需要 entryId, title, baseVersionId, targetVersionIds', code: 'MISSING_PARAMS' };
    }

    const entry = db.prepare('SELECT id FROM entries WHERE id = ?').get(Number(entryId));
    if (!entry) {
      reply.code(404);
      return { error: '词条不存在', code: 'ENTRY_NOT_FOUND' };
    }

    const allVersionIds = [Number(baseVersionId), ...targetVersionIds.map(Number)];
    for (const vid of allVersionIds) {
      const v = db.prepare('SELECT id, full_text FROM versions WHERE id = ?').get(vid);
      if (!v) {
        reply.code(404);
        return { error: `版本 ${vid} 不存在`, code: 'VERSION_NOT_FOUND' };
      }
    }

    const tx = db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO collation_tasks (entry_id, title, description, base_version_id, target_version_ids, task_id, creator_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'draft')
      `).run(
        Number(entryId),
        title.trim(),
        description || '',
        Number(baseVersionId),
        JSON.stringify(targetVersionIds.map(Number)),
        taskId || null,
        req.user.id
      );

      const collationTaskId = info.lastInsertRowid;

      for (const vid of allVersionIds) {
        const v = db.prepare('SELECT full_text FROM versions WHERE id = ?').get(vid);
        const paragraphs = splitIntoParagraphs(v.full_text);
        const insertStmt = db.prepare(`
          INSERT INTO collation_paragraphs (collation_task_id, version_id, paragraph_index, content)
          VALUES (?, ?, ?, ?)
        `);
        paragraphs.forEach((content, idx) => {
          insertStmt.run(collationTaskId, vid, idx, content);
        });
      }

      return collationTaskId;
    });

    const collationTaskId = tx();
    return { id: collationTaskId, ...getCollationTaskWithDetails(collationTaskId) };
  });

  fastify.post('/api/collation/:id/diff', {
    preHandler: [authenticate(), requirePermission('collation:write')]
  }, async (req, reply) => {
    const id = Number(req.params.id);
    const { paragraphIndex, diffType, baseText, targetVersionId, targetText, startPos, endPos, note } = req.body;

    const task = db.prepare('SELECT id FROM collation_tasks WHERE id = ?').get(id);
    if (!task) {
      reply.code(404);
      return { error: '校勘任务不存在', code: 'COLLATION_NOT_FOUND' };
    }

    if (!paragraphIndex === undefined || !diffType || !targetVersionId) {
      reply.code(400);
      return { error: '参数不完整', code: 'MISSING_PARAMS' };
    }

    if (!DIFF_TYPES.includes(diffType)) {
      reply.code(400);
      return { error: '差异类型无效', code: 'INVALID_DIFF_TYPE' };
    }

    const info = db.prepare(`
      INSERT INTO collation_diffs (collation_task_id, paragraph_index, diff_type, base_text, target_version_id, target_text, start_pos, end_pos, note, creator_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      Number(paragraphIndex),
      diffType,
      baseText || '',
      Number(targetVersionId),
      targetText || '',
      startPos !== undefined ? Number(startPos) : null,
      endPos !== undefined ? Number(endPos) : null,
      note || '',
      req.user.id
    );

    db.prepare('UPDATE collation_tasks SET updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(id);

    const diff = db.prepare(`
      SELECT cd.*, v.version_name as target_version_name,
             u.username as creator_username, u.display_name as creator_display_name
      FROM collation_diffs cd
      LEFT JOIN versions v ON cd.target_version_id = v.id
      LEFT JOIN users u ON cd.creator_id = u.id
      WHERE cd.id = ?
    `).get(info.lastInsertRowid);

    return diff;
  });

  fastify.put('/api/collation/:id/diff/:diffId', {
    preHandler: [authenticate(), requirePermission('collation:write')]
  }, async (req, reply) => {
    const id = Number(req.params.id);
    const diffId = Number(req.params.diffId);
    const { diffType, baseText, targetText, note, startPos, endPos } = req.body;

    const diff = db.prepare('SELECT * FROM collation_diffs WHERE id = ? AND collation_task_id = ?').get(diffId, id);
    if (!diff) {
      reply.code(404);
      return { error: '差异标注不存在', code: 'DIFF_NOT_FOUND' };
    }

    if (diffType && !DIFF_TYPES.includes(diffType)) {
      reply.code(400);
      return { error: '差异类型无效', code: 'INVALID_DIFF_TYPE' };
    }

    const fields = [];
    const values = [];

    if (diffType !== undefined) { fields.push('diff_type = ?'); values.push(diffType); }
    if (baseText !== undefined) { fields.push('base_text = ?'); values.push(baseText); }
    if (targetText !== undefined) { fields.push('target_text = ?'); values.push(targetText); }
    if (note !== undefined) { fields.push('note = ?'); values.push(note); }
    if (startPos !== undefined) { fields.push('start_pos = ?'); values.push(Number(startPos)); }
    if (endPos !== undefined) { fields.push('end_pos = ?'); values.push(Number(endPos)); }

    if (fields.length > 0) {
      fields.push('updated_at = datetime(\'now\',\'localtime\')');
      values.push(diffId);
      db.prepare(`UPDATE collation_diffs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    db.prepare('UPDATE collation_tasks SET updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(id);

    const updated = db.prepare(`
      SELECT cd.*, v.version_name as target_version_name,
             u.username as creator_username, u.display_name as creator_display_name
      FROM collation_diffs cd
      LEFT JOIN versions v ON cd.target_version_id = v.id
      LEFT JOIN users u ON cd.creator_id = u.id
      WHERE cd.id = ?
    `).get(diffId);

    return updated;
  });

  fastify.delete('/api/collation/:id/diff/:diffId', {
    preHandler: [authenticate(), requirePermission('collation:write')]
  }, async (req, reply) => {
    const id = Number(req.params.id);
    const diffId = Number(req.params.diffId);

    const diff = db.prepare('SELECT id FROM collation_diffs WHERE id = ? AND collation_task_id = ?').get(diffId, id);
    if (!diff) {
      reply.code(404);
      return { error: '差异标注不存在', code: 'DIFF_NOT_FOUND' };
    }

    db.prepare('DELETE FROM collation_diffs WHERE id = ?').run(diffId);
    db.prepare('UPDATE collation_tasks SET updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(id);
    return { ok: true };
  });

  fastify.post('/api/collation/:id/conclusion', {
    preHandler: [authenticate(), requirePermission('collation:conclude')]
  }, async (req, reply) => {
    const id = Number(req.params.id);
    const { diffId, paragraphIndex, conclusionType, content, evidence, finalText } = req.body;

    const task = db.prepare('SELECT id FROM collation_tasks WHERE id = ?').get(id);
    if (!task) {
      reply.code(404);
      return { error: '校勘任务不存在', code: 'COLLATION_NOT_FOUND' };
    }

    if (!conclusionType || !content) {
      reply.code(400);
      return { error: '参数不完整：需要 conclusionType, content', code: 'MISSING_PARAMS' };
    }

    if (!CONCLUSION_TYPES.includes(conclusionType)) {
      reply.code(400);
      return { error: '结论类型无效', code: 'INVALID_CONCLUSION_TYPE' };
    }

    const info = db.prepare(`
      INSERT INTO collation_conclusions (collation_task_id, diff_id, paragraph_index, conclusion_type, content, evidence, final_text, creator_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      diffId || null,
      paragraphIndex !== undefined ? Number(paragraphIndex) : null,
      conclusionType,
      content,
      evidence || '',
      finalText || '',
      req.user.id
    );

    db.prepare('UPDATE collation_tasks SET updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(id);

    const conclusion = db.prepare(`
      SELECT cc.*,
             cu.username as creator_username, cu.display_name as creator_display_name,
             ru.username as reviewer_username, ru.display_name as reviewer_display_name
      FROM collation_conclusions cc
      LEFT JOIN users cu ON cc.creator_id = cu.id
      LEFT JOIN users ru ON cc.reviewer_id = ru.id
      WHERE cc.id = ?
    `).get(info.lastInsertRowid);

    return conclusion;
  });

  fastify.put('/api/collation/:id/conclusion/:conclusionId', {
    preHandler: [authenticate(), requirePermission('collation:conclude')]
  }, async (req, reply) => {
    const id = Number(req.params.id);
    const conclusionId = Number(req.params.conclusionId);
    const { conclusionType, content, evidence, finalText } = req.body;

    const conclusion = db.prepare('SELECT * FROM collation_conclusions WHERE id = ? AND collation_task_id = ?').get(conclusionId, id);
    if (!conclusion) {
      reply.code(404);
      return { error: '校勘结论不存在', code: 'CONCLUSION_NOT_FOUND' };
    }

    if (conclusionType && !CONCLUSION_TYPES.includes(conclusionType)) {
      reply.code(400);
      return { error: '结论类型无效', code: 'INVALID_CONCLUSION_TYPE' };
    }

    const fields = [];
    const values = [];

    if (conclusionType !== undefined) { fields.push('conclusion_type = ?'); values.push(conclusionType); }
    if (content !== undefined) { fields.push('content = ?'); values.push(content); }
    if (evidence !== undefined) { fields.push('evidence = ?'); values.push(evidence); }
    if (finalText !== undefined) { fields.push('final_text = ?'); values.push(finalText); }

    if (fields.length > 0) {
      fields.push('updated_at = datetime(\'now\',\'localtime\')');
      values.push(conclusionId);
      db.prepare(`UPDATE collation_conclusions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    db.prepare('UPDATE collation_tasks SET updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(id);

    const updated = db.prepare(`
      SELECT cc.*,
             cu.username as creator_username, cu.display_name as creator_display_name,
             ru.username as reviewer_username, ru.display_name as reviewer_display_name
      FROM collation_conclusions cc
      LEFT JOIN users cu ON cc.creator_id = cu.id
      LEFT JOIN users ru ON cc.reviewer_id = ru.id
      WHERE cc.id = ?
    `).get(conclusionId);

    return updated;
  });

  fastify.post('/api/collation/:id/conclusion/:conclusionId/review', {
    preHandler: [authenticate(), requirePermission('collation:review')]
  }, async (req, reply) => {
    const id = Number(req.params.id);
    const conclusionId = Number(req.params.conclusionId);
    const { status, reviewerNote } = req.body;

    const conclusion = db.prepare('SELECT * FROM collation_conclusions WHERE id = ? AND collation_task_id = ?').get(conclusionId, id);
    if (!conclusion) {
      reply.code(404);
      return { error: '校勘结论不存在', code: 'CONCLUSION_NOT_FOUND' };
    }

    if (!CONCLUSION_STATUSES.includes(status)) {
      reply.code(400);
      return { error: '审核状态无效', code: 'INVALID_STATUS' };
    }

    db.prepare(`
      UPDATE collation_conclusions
      SET status = ?, reviewer_note = ?, reviewer_id = ?, reviewed_at = datetime('now','localtime'), updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(status, reviewerNote || '', req.user.id, conclusionId);

    db.prepare('UPDATE collation_tasks SET updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(id);

    const updated = db.prepare(`
      SELECT cc.*,
             cu.username as creator_username, cu.display_name as creator_display_name,
             ru.username as reviewer_username, ru.display_name as reviewer_display_name
      FROM collation_conclusions cc
      LEFT JOIN users cu ON cc.creator_id = cu.id
      LEFT JOIN users ru ON cc.reviewer_id = ru.id
      WHERE cc.id = ?
    `).get(conclusionId);

    return updated;
  });

  fastify.delete('/api/collation/:id/conclusion/:conclusionId', {
    preHandler: [authenticate(), requirePermission('collation:conclude')]
  }, async (req, reply) => {
    const id = Number(req.params.id);
    const conclusionId = Number(req.params.conclusionId);

    const conclusion = db.prepare('SELECT id FROM collation_conclusions WHERE id = ? AND collation_task_id = ?').get(conclusionId, id);
    if (!conclusion) {
      reply.code(404);
      return { error: '校勘结论不存在', code: 'CONCLUSION_NOT_FOUND' };
    }

    db.prepare('DELETE FROM collation_conclusions WHERE id = ?').run(conclusionId);
    db.prepare('UPDATE collation_tasks SET updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(id);
    return { ok: true };
  });

  fastify.patch('/api/collation/:id/status', {
    preHandler: [authenticate(), requirePermission('collation:write')]
  }, async (req, reply) => {
    const id = Number(req.params.id);
    const { status } = req.body;

    const task = db.prepare('SELECT id FROM collation_tasks WHERE id = ?').get(id);
    if (!task) {
      reply.code(404);
      return { error: '校勘任务不存在', code: 'COLLATION_NOT_FOUND' };
    }

    if (!COLLATION_STATUSES.includes(status)) {
      reply.code(400);
      return { error: '状态无效', code: 'INVALID_STATUS' };
    }

    db.prepare(`
      UPDATE collation_tasks
      SET status = ?, updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(status, id);

    return { ok: true, ...getCollationTaskWithDetails(id) };
  });

  fastify.patch('/api/collation/:id/reviewer', {
    preHandler: [authenticate(), requirePermission('collation:review')]
  }, async (req, reply) => {
    const id = Number(req.params.id);
    const { reviewerId } = req.body;

    const task = db.prepare('SELECT id FROM collation_tasks WHERE id = ?').get(id);
    if (!task) {
      reply.code(404);
      return { error: '校勘任务不存在', code: 'COLLATION_NOT_FOUND' };
    }

    if (reviewerId) {
      const user = db.prepare('SELECT id FROM users WHERE id = ?').get(Number(reviewerId));
      if (!user) {
        reply.code(404);
        return { error: '用户不存在', code: 'USER_NOT_FOUND' };
      }
      db.prepare('UPDATE collation_tasks SET reviewer_id = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(Number(reviewerId), id);
    } else {
      db.prepare('UPDATE collation_tasks SET reviewer_id = NULL, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(id);
    }

    return { ok: true, ...getCollationTaskWithDetails(id) };
  });

  fastify.put('/api/collation/:id', {
    preHandler: [authenticate(), requirePermission('collation:write')]
  }, async (req, reply) => {
    const id = Number(req.params.id);
    const { title, description } = req.body;

    const task = db.prepare('SELECT id FROM collation_tasks WHERE id = ?').get(id);
    if (!task) {
      reply.code(404);
      return { error: '校勘任务不存在', code: 'COLLATION_NOT_FOUND' };
    }

    const fields = [];
    const values = [];

    if (title !== undefined) { fields.push('title = ?'); values.push(title.trim()); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description || ''); }

    if (fields.length > 0) {
      fields.push('updated_at = datetime(\'now\',\'localtime\')');
      values.push(id);
      db.prepare(`UPDATE collation_tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    return { ok: true, ...getCollationTaskWithDetails(id) };
  });

  fastify.delete('/api/collation/:id', {
    preHandler: [authenticate(), requirePermission('collation:write')]
  }, async (req, reply) => {
    const id = Number(req.params.id);
    const task = db.prepare('SELECT id FROM collation_tasks WHERE id = ?').get(id);
    if (!task) {
      reply.code(404);
      return { error: '校勘任务不存在', code: 'COLLATION_NOT_FOUND' };
    }
    db.prepare('DELETE FROM collation_tasks WHERE id = ?').run(id);
    return { ok: true };
  });

  fastify.get('/api/collation/statuses', {
    preHandler: [authenticate(), requirePermission('collation:read')]
  }, async () => {
    return COLLATION_STATUSES.map(s => ({
      value: s,
      label: {
        draft: '草稿',
        in_progress: '进行中',
        review: '审核中',
        done: '已完成',
        archived: '已归档'
      }[s]
    }));
  });

  fastify.get('/api/collation/diff-types', {
    preHandler: [authenticate(), requirePermission('collation:read')]
  }, async () => {
    return DIFF_TYPES.map(t => ({
      value: t,
      label: {
        character: '用字差异',
        punctuation: '标点差异',
        wording: '措辞差异',
        paragraph: '段落差异',
        missing: '脱文',
        extra: '衍文',
        other: '其他'
      }[t]
    }));
  });

  fastify.get('/api/collation/conclusion-types', {
    preHandler: [authenticate(), requirePermission('collation:read')]
  }, async () => {
    return CONCLUSION_TYPES.map(t => ({
      value: t,
      label: {
        accept_base: '采用底本',
        accept_target: '采用校本',
        custom: '自定义',
        needs_research: '待考',
        no_difference: '无实质差异'
      }[t]
    }));
  });

  fastify.get('/api/collation/conclusion-statuses', {
    preHandler: [authenticate(), requirePermission('collation:read')]
  }, async () => {
    return CONCLUSION_STATUSES.map(s => ({
      value: s,
      label: {
        pending: '待审核',
        reviewed: '已审阅',
        approved: '已通过',
        rejected: '已驳回'
      }[s]
    }));
  });

  fastify.get('/api/versions/:id/collation-results', {
    preHandler: [authenticate(), requirePermission('collation:read')]
  }, async (req) => {
    const versionId = Number(req.params.id);

    const baseTasks = db.prepare(`
      SELECT ct.*, e.title as entry_title
      FROM collation_tasks ct
      JOIN entries e ON ct.entry_id = e.id
      WHERE ct.base_version_id = ? OR ct.target_version_ids LIKE ?
      ORDER BY ct.updated_at DESC
    `).all(versionId, `%${versionId}%`);

    const results = [];
    for (const t of baseTasks) {
      const taskDetail = getCollationTaskWithDetails(t.id);
      const diffs = db.prepare(`
        SELECT cd.*, v.version_name as target_version_name
        FROM collation_diffs cd
        LEFT JOIN versions v ON cd.target_version_id = v.id
        WHERE cd.collation_task_id = ? AND (cd.target_version_id = ? OR ? = ct.base_version_id)
      `).all(t.id, versionId, versionId);

      const conclusions = db.prepare(`
        SELECT cc.*
        FROM collation_conclusions cc
        WHERE cc.collation_task_id = ?
      `).all(t.id);

      results.push({
        task: taskDetail,
        diffs,
        conclusions
      });
    }

    return results;
  });
}

module.exports = routes;

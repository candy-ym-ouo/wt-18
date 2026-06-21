const { db } = require('../db');
const { authenticate, requirePermission } = require('../auth');
const { notifyTaskAssigned, notifyTaskComment } = require('../notificationService');

const TASK_STATUSES = ['todo', 'in_progress', 'review', 'done'];
const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

function getTaskWithDetails(id) {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return null;

  const creator = db.prepare('SELECT id, username, display_name FROM users WHERE id = ?').get(task.creator_id);
  const assignees = db.prepare(`
    SELECT u.id, u.username, u.display_name
    FROM task_assignments ta
    JOIN users u ON ta.user_id = u.id
    WHERE ta.task_id = ?
  `).all(id);
  const entry = task.entry_id ? db.prepare('SELECT id, title FROM entries WHERE id = ?').get(task.entry_id) : null;
  const version = task.version_id ? db.prepare('SELECT id, version_name FROM versions WHERE id = ?').get(task.version_id) : null;
  const commentCount = db.prepare('SELECT COUNT(*) as count FROM task_comments WHERE task_id = ?').get(id).count;

  return {
    ...task,
    creator: creator || { id: null, username: '未知用户', display_name: '未知用户' },
    assignees,
    entry,
    version,
    commentCount
  };
}

function getAllTasks(filters = {}) {
  let sql = 'SELECT DISTINCT t.* FROM tasks t';
  const params = [];
  const conditions = [];

  if (filters.assigneeId) {
    sql += ' LEFT JOIN task_assignments ta ON t.id = ta.task_id';
    conditions.push('ta.user_id = ?');
    params.push(filters.assigneeId);
  }

  if (filters.creatorId) {
    conditions.push('t.creator_id = ?');
    params.push(filters.creatorId);
  }

  if (filters.status) {
    conditions.push('t.status = ?');
    params.push(filters.status);
  }

  if (filters.entryId) {
    conditions.push('t.entry_id = ?');
    params.push(filters.entryId);
  }

  if (filters.versionId) {
    conditions.push('t.version_id = ?');
    params.push(filters.versionId);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY t.created_at DESC';

  const tasks = db.prepare(sql).all(...params);
  return tasks.map(task => getTaskWithDetails(task.id));
}

async function routes(fastify) {
  fastify.get('/api/tasks', {
    preHandler: [authenticate(), requirePermission('tasks:read')]
  }, async (req) => {
    const { assigneeId, creatorId, status, entryId, versionId } = req.query;
    return getAllTasks({
      assigneeId: assigneeId ? Number(assigneeId) : null,
      creatorId: creatorId ? Number(creatorId) : null,
      status,
      entryId: entryId ? Number(entryId) : null,
      versionId: versionId ? Number(versionId) : null
    });
  });

  fastify.get('/api/tasks/board', {
    preHandler: [authenticate(), requirePermission('tasks:read')]
  }, async (req) => {
    const { assigneeId, entryId, versionId } = req.query;
    const allTasks = getAllTasks({
      assigneeId: assigneeId ? Number(assigneeId) : null,
      entryId: entryId ? Number(entryId) : null,
      versionId: versionId ? Number(versionId) : null
    });

    const board = {};
    for (const status of TASK_STATUSES) {
      board[status] = allTasks.filter(t => t.status === status);
    }
    return board;
  });

  fastify.get('/api/tasks/:id', {
    preHandler: [authenticate(), requirePermission('tasks:read')]
  }, async (req, reply) => {
    const id = Number(req.params.id);
    const task = getTaskWithDetails(id);
    if (!task) {
      reply.code(404);
      return { error: '任务不存在', code: 'TASK_NOT_FOUND' };
    }
    return task;
  });

  fastify.get('/api/tasks/:id/comments', {
    preHandler: [authenticate(), requirePermission('tasks:read')]
  }, async (req, reply) => {
    const taskId = Number(req.params.id);
    const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId);
    if (!task) {
      reply.code(404);
      return { error: '任务不存在', code: 'TASK_NOT_FOUND' };
    }

    return db.prepare(`
      SELECT tc.*, u.username, u.display_name
      FROM task_comments tc
      JOIN users u ON tc.user_id = u.id
      WHERE tc.task_id = ?
      ORDER BY tc.created_at ASC
    `).all(taskId);
  });

  fastify.post('/api/tasks', {
    preHandler: [authenticate(), requirePermission('tasks:write')]
  }, async (req, reply) => {
    const { title, description, priority, status, entryId, versionId, dueDate, assigneeIds } = req.body;

    if (!title || !title.trim()) {
      reply.code(400);
      return { error: '任务标题不能为空', code: 'MISSING_TITLE' };
    }

    if (priority && !TASK_PRIORITIES.includes(priority)) {
      reply.code(400);
      return { error: '优先级无效', code: 'INVALID_PRIORITY' };
    }

    if (status && !TASK_STATUSES.includes(status)) {
      reply.code(400);
      return { error: '状态无效', code: 'INVALID_STATUS' };
    }

    const tx = db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO tasks (title, description, status, priority, entry_id, version_id, creator_id, due_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        title.trim(),
        description || '',
        status || 'todo',
        priority || 'medium',
        entryId || null,
        versionId || null,
        req.user.id,
        dueDate || null
      );

      const taskId = info.lastInsertRowid;

      if (assigneeIds && Array.isArray(assigneeIds) && assigneeIds.length > 0) {
        const assignStmt = db.prepare('INSERT OR IGNORE INTO task_assignments (task_id, user_id) VALUES (?, ?)');
        for (const userId of assigneeIds) {
          assignStmt.run(taskId, Number(userId));
        }
      }

      return taskId;
    });

    const taskId = tx();

    if (assigneeIds && Array.isArray(assigneeIds) && assigneeIds.length > 0) {
      notifyTaskAssigned({
        taskId,
        taskTitle: title.trim(),
        assigneeIds: assigneeIds.map(id => Number(id)).filter(id => id !== req.user.id),
        assignerId: req.user.id,
        assignerName: req.user.displayName || req.user.username
      });
    }

    return { id: taskId, ...getTaskWithDetails(taskId) };
  });

  fastify.post('/api/tasks/:id/comments', {
    preHandler: [authenticate(), requirePermission('tasks:comment')]
  }, async (req, reply) => {
    const taskId = Number(req.params.id);
    const { content } = req.body;

    const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId);
    if (!task) {
      reply.code(404);
      return { error: '任务不存在', code: 'TASK_NOT_FOUND' };
    }

    if (!content || !content.trim()) {
      reply.code(400);
      return { error: '评论内容不能为空', code: 'MISSING_CONTENT' };
    }

    const info = db.prepare(`
      INSERT INTO task_comments (task_id, user_id, content)
      VALUES (?, ?, ?)
    `).run(taskId, req.user.id, content.trim());

    const comment = db.prepare(`
      SELECT tc.*, u.username, u.display_name
      FROM task_comments tc
      JOIN users u ON tc.user_id = u.id
      WHERE tc.id = ?
    `).get(info.lastInsertRowid);

    const taskDetail = db.prepare('SELECT title FROM tasks WHERE id = ?').get(taskId);
    notifyTaskComment({
      taskId,
      taskTitle: taskDetail?.title || '',
      commentUserId: req.user.id,
      commentUserName: req.user.displayName || req.user.username
    });

    return comment;
  });

  fastify.put('/api/tasks/:id', {
    preHandler: [authenticate(), requirePermission('tasks:write')]
  }, async (req, reply) => {
    const id = Number(req.params.id);
    const { title, description, priority, status, entryId, versionId, dueDate, assigneeIds } = req.body;

    const task = db.prepare('SELECT id, title FROM tasks WHERE id = ?').get(id);
    if (!task) {
      reply.code(404);
      return { error: '任务不存在', code: 'TASK_NOT_FOUND' };
    }

    if (priority && !TASK_PRIORITIES.includes(priority)) {
      reply.code(400);
      return { error: '优先级无效', code: 'INVALID_PRIORITY' };
    }

    if (status && !TASK_STATUSES.includes(status)) {
      reply.code(400);
      return { error: '状态无效', code: 'INVALID_STATUS' };
    }

    let newAssignees = [];

    const tx = db.transaction(() => {
      const fields = [];
      const values = [];

      if (title !== undefined) {
        fields.push('title = ?');
        values.push(title.trim());
      }
      if (description !== undefined) {
        fields.push('description = ?');
        values.push(description || '');
      }
      if (status !== undefined) {
        fields.push('status = ?');
        values.push(status);
      }
      if (priority !== undefined) {
        fields.push('priority = ?');
        values.push(priority);
      }
      if (entryId !== undefined) {
        fields.push('entry_id = ?');
        values.push(entryId || null);
      }
      if (versionId !== undefined) {
        fields.push('version_id = ?');
        values.push(versionId || null);
      }
      if (dueDate !== undefined) {
        fields.push('due_date = ?');
        values.push(dueDate || null);
      }

      if (fields.length > 0) {
        fields.push('updated_at = datetime(\'now\',\'localtime\')');
        values.push(id);
        db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      }

      if (assigneeIds !== undefined && Array.isArray(assigneeIds)) {
        const oldAssignees = db.prepare('SELECT user_id FROM task_assignments WHERE task_id = ?').all(id).map(a => a.user_id);
        db.prepare('DELETE FROM task_assignments WHERE task_id = ?').run(id);
        const assignStmt = db.prepare('INSERT OR IGNORE INTO task_assignments (task_id, user_id) VALUES (?, ?)');
        for (const userId of assigneeIds) {
          assignStmt.run(id, Number(userId));
        }
        newAssignees = assigneeIds.map(id => Number(id)).filter(id => !oldAssignees.includes(id));
      }
    });

    tx();

    const updatedTask = getTaskWithDetails(id);
    if (newAssignees.length > 0) {
      notifyTaskAssigned({
        taskId: id,
        taskTitle: updatedTask.title,
        assigneeIds: newAssignees.filter(id => id !== req.user.id),
        assignerId: req.user.id,
        assignerName: req.user.displayName || req.user.username
      });
    }

    return { ok: true, ...updatedTask };
  });

  fastify.patch('/api/tasks/:id/status', {
    preHandler: [authenticate(), requirePermission('tasks:write')]
  }, async (req, reply) => {
    const id = Number(req.params.id);
    const { status } = req.body;

    const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
    if (!task) {
      reply.code(404);
      return { error: '任务不存在', code: 'TASK_NOT_FOUND' };
    }

    if (!TASK_STATUSES.includes(status)) {
      reply.code(400);
      return { error: '状态无效', code: 'INVALID_STATUS' };
    }

    db.prepare('UPDATE tasks SET status = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(status, id);
    return { ok: true, ...getTaskWithDetails(id) };
  });

  fastify.post('/api/tasks/:id/assign', {
    preHandler: [authenticate(), requirePermission('tasks:assign')]
  }, async (req, reply) => {
    const taskId = Number(req.params.id);
    const { userId } = req.body;

    const task = db.prepare('SELECT id, title FROM tasks WHERE id = ?').get(taskId);
    if (!task) {
      reply.code(404);
      return { error: '任务不存在', code: 'TASK_NOT_FOUND' };
    }

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(Number(userId));
    if (!user) {
      reply.code(404);
      return { error: '用户不存在', code: 'USER_NOT_FOUND' };
    }

    const result = db.prepare('INSERT OR IGNORE INTO task_assignments (task_id, user_id) VALUES (?, ?)').run(taskId, Number(userId));

    if (result.changes > 0 && Number(userId) !== req.user.id) {
      notifyTaskAssigned({
        taskId,
        taskTitle: task.title,
        assigneeIds: [Number(userId)],
        assignerId: req.user.id,
        assignerName: req.user.displayName || req.user.username
      });
    }

    return { ok: true, ...getTaskWithDetails(taskId) };
  });

  fastify.delete('/api/tasks/:id/assign/:userId', {
    preHandler: [authenticate(), requirePermission('tasks:assign')]
  }, async (req, reply) => {
    const taskId = Number(req.params.id);
    const userId = Number(req.params.userId);

    const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId);
    if (!task) {
      reply.code(404);
      return { error: '任务不存在', code: 'TASK_NOT_FOUND' };
    }

    db.prepare('DELETE FROM task_assignments WHERE task_id = ? AND user_id = ?').run(taskId, userId);
    return { ok: true, ...getTaskWithDetails(taskId) };
  });

  fastify.delete('/api/tasks/:id', {
    preHandler: [authenticate(), requirePermission('tasks:write')]
  }, async (req, reply) => {
    const id = Number(req.params.id);
    const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
    if (!task) {
      reply.code(404);
      return { error: '任务不存在', code: 'TASK_NOT_FOUND' };
    }

    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    return { ok: true };
  });

  fastify.get('/api/tasks/statuses', {
    preHandler: [authenticate(), requirePermission('tasks:read')]
  }, async () => {
    return TASK_STATUSES.map(s => ({
      value: s,
      label: {
        todo: '待办',
        in_progress: '进行中',
        review: '审核中',
        done: '已完成'
      }[s]
    }));
  });

  fastify.get('/api/tasks/priorities', {
    preHandler: [authenticate(), requirePermission('tasks:read')]
  }, async () => {
    return TASK_PRIORITIES.map(p => ({
      value: p,
      label: {
        low: '低',
        medium: '中',
        high: '高',
        urgent: '紧急'
      }[p]
    }));
  });
}

module.exports = routes;

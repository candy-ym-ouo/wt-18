const { db } = require('../db');
const { authenticate, requireRole } = require('../auth');
const notifService = require('../notificationService');

const {
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_LABELS,
  ANNOUNCEMENT_PRIORITIES
} = notifService;

async function routes(fastify) {
  fastify.get('/api/notifications/types', {
    preHandler: [authenticate()]
  }, async () => {
    return Object.entries(NOTIFICATION_TYPE_LABELS).map(([value, label]) => ({ value, label }));
  });

  fastify.get('/api/notifications', {
    preHandler: [authenticate()]
  }, async (req) => {
    const { type, isRead, page = 1, page_size = 20 } = req.query;

    const list = notifService.getUserNotifications(req.user.id, {
      type,
      isRead,
      page: Number(page),
      pageSize: Number(page_size)
    });

    let countSql = 'SELECT COUNT(*) as total FROM notifications WHERE user_id = ?';
    const countParams = [req.user.id];
    const countConditions = [];

    if (type && type !== 'all') {
      countConditions.push('type = ?');
      countParams.push(type);
    }
    if (isRead !== undefined && isRead !== 'all') {
      countConditions.push('is_read = ?');
      countParams.push(isRead === true || isRead === 'true' ? 1 : 0);
    }
    if (countConditions.length > 0) {
      countSql += ' AND ' + countConditions.join(' AND ');
    }
    const total = db.prepare(countSql).get(...countParams).total;

    const unreadCount = notifService.getUnreadCount(req.user.id);

    return {
      list,
      total,
      page: Number(page),
      page_size: Number(page_size),
      unread_count: unreadCount
    };
  });

  fastify.get('/api/notifications/unread-count', {
    preHandler: [authenticate()]
  }, async (req) => {
    const { type } = req.query;
    const total = notifService.getUnreadCount(req.user.id);

    const byType = {};
    for (const t of Object.values(NOTIFICATION_TYPES)) {
      byType[t] = notifService.getUnreadCount(req.user.id, t);
    }

    return {
      total,
      by_type: byType
    };
  });

  fastify.patch('/api/notifications/:id/read', {
    preHandler: [authenticate()]
  }, async (req, reply) => {
    const id = Number(req.params.id);
    const result = notifService.markAsRead(id, req.user.id);
    if (result.changes === 0) {
      reply.code(404);
      return { error: '通知不存在或无权限', code: 'NOT_FOUND' };
    }
    const unreadCount = notifService.getUnreadCount(req.user.id);
    return { ok: true, unread_count: unreadCount };
  });

  fastify.patch('/api/notifications/read-all', {
    preHandler: [authenticate()]
  }, async (req) => {
    const { type } = req.body || {};
    const result = notifService.markAllAsRead(req.user.id, type);
    const unreadCount = notifService.getUnreadCount(req.user.id);
    return { ok: true, changed: result.changes, unread_count: unreadCount };
  });

  fastify.delete('/api/notifications/:id', {
    preHandler: [authenticate()]
  }, async (req, reply) => {
    const id = Number(req.params.id);
    const result = notifService.deleteNotification(id, req.user.id);
    if (result.changes === 0) {
      reply.code(404);
      return { error: '通知不存在或无权限', code: 'NOT_FOUND' };
    }
    return { ok: true };
  });

  fastify.delete('/api/notifications/clear-read', {
    preHandler: [authenticate()]
  }, async () => {
    const result = notifService.deleteAllReadNotifications(req.user.id);
    return { ok: true, deleted: result.changes };
  });

  const ADMIN_ROLES = ['admin', 'editor'];

  fastify.get('/api/announcements/priorities', {
    preHandler: [authenticate(), requireRole(...ADMIN_ROLES)]
  }, async () => {
    const labels = { low: '低', normal: '普通', high: '高', urgent: '紧急' };
    return ANNOUNCEMENT_PRIORITIES.map(value => ({ value, label: labels[value] }));
  });

  fastify.get('/api/announcements', async (req) => {
    const { status, priority, page, page_size } = req.query;
    return notifService.getAnnouncements({
      status: req.user ? status : 'active',
      priority,
      page: page ? Number(page) : undefined,
      pageSize: page_size ? Number(page_size) : undefined
    });
  });

  fastify.get('/api/announcements/:id', async (req, reply) => {
    const id = Number(req.params.id);
    const announcement = notifService.getAnnouncement(id);
    if (!announcement) {
      reply.code(404);
      return { error: '公告不存在', code: 'NOT_FOUND' };
    }
    return announcement;
  });

  fastify.post('/api/announcements', {
    preHandler: [authenticate(), requireRole(...ADMIN_ROLES)]
  }, async (req, reply) => {
    const { title, content, priority, target_role } = req.body;

    if (!title || !title.trim()) {
      reply.code(400);
      return { error: '公告标题不能为空', code: 'MISSING_TITLE' };
    }
    if (!content || !content.trim()) {
      reply.code(400);
      return { error: '公告内容不能为空', code: 'MISSING_CONTENT' };
    }
    if (priority && !ANNOUNCEMENT_PRIORITIES.includes(priority)) {
      reply.code(400);
      return { error: '优先级无效', code: 'INVALID_PRIORITY' };
    }

    const id = notifService.createAnnouncement({
      title: title.trim(),
      content: content.trim(),
      priority: priority || 'normal',
      targetRole: target_role || null,
      creatorId: req.user.id
    });

    notifService.notifySystemAnnouncement({ announcementId: id, targetRole: target_role });

    return { id, ...notifService.getAnnouncement(id) };
  });

  fastify.put('/api/announcements/:id', {
    preHandler: [authenticate(), requireRole(...ADMIN_ROLES)]
  }, async (req, reply) => {
    const id = Number(req.params.id);
    const { title, content, priority, target_role, status } = req.body;

    const existing = notifService.getAnnouncement(id);
    if (!existing) {
      reply.code(404);
      return { error: '公告不存在', code: 'NOT_FOUND' };
    }

    if (priority && !ANNOUNCEMENT_PRIORITIES.includes(priority)) {
      reply.code(400);
      return { error: '优先级无效', code: 'INVALID_PRIORITY' };
    }

    notifService.updateAnnouncement(id, {
      title: title ? title.trim() : undefined,
      content: content ? content.trim() : undefined,
      priority,
      targetRole: target_role !== undefined ? target_role : undefined,
      status
    });

    return { ok: true, ...notifService.getAnnouncement(id) };
  });

  fastify.delete('/api/announcements/:id', {
    preHandler: [authenticate(), requireRole(...ADMIN_ROLES)]
  }, async (req, reply) => {
    const id = Number(req.params.id);
    const existing = notifService.getAnnouncement(id);
    if (!existing) {
      reply.code(404);
      return { error: '公告不存在', code: 'NOT_FOUND' };
    }
    notifService.deleteAnnouncement(id);
    return { ok: true };
  });

  fastify.post('/api/announcements/:id/publish', {
    preHandler: [authenticate(), requireRole(...ADMIN_ROLES)]
  }, async (req, reply) => {
    const id = Number(req.params.id);
    const { target_role } = req.body || {};
    const existing = notifService.getAnnouncement(id);
    if (!existing) {
      reply.code(404);
      return { error: '公告不存在', code: 'NOT_FOUND' };
    }
    notifService.updateAnnouncement(id, { status: 'active' });
    notifService.notifySystemAnnouncement({ announcementId: id, targetRole: target_role || existing.target_role });
    return { ok: true, ...notifService.getAnnouncement(id) };
  });
}

module.exports = routes;

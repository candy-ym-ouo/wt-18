const { db, ROLES, ROLE_HIERARCHY } = require('./db');

const NOTIFICATION_TYPES = {
  ANNOTATION_REPLY: 'annotation_reply',
  TASK_ASSIGNED: 'task_assigned',
  TASK_COMMENT: 'task_comment',
  REVIEW_RESULT: 'review_result',
  SYSTEM_ANNOUNCEMENT: 'system_announcement'
};

const NOTIFICATION_TYPE_LABELS = {
  [NOTIFICATION_TYPES.ANNOTATION_REPLY]: '批注回复',
  [NOTIFICATION_TYPES.TASK_ASSIGNED]: '任务指派',
  [NOTIFICATION_TYPES.TASK_COMMENT]: '任务评论',
  [NOTIFICATION_TYPES.REVIEW_RESULT]: '审核结果',
  [NOTIFICATION_TYPES.SYSTEM_ANNOUNCEMENT]: '系统公告'
};

const ANNOUNCEMENT_PRIORITIES = ['low', 'normal', 'high', 'urgent'];

function createNotification({ userId, senderId, type, title, content, refType, refId, extraData }) {
  const info = db.prepare(`
    INSERT INTO notifications (user_id, sender_id, type, title, content, ref_type, ref_id, extra_data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    senderId || null,
    type,
    title,
    content || null,
    refType || null,
    refId || null,
    extraData ? JSON.stringify(extraData) : null
  );
  return info.lastInsertRowid;
}

function createBatchNotifications({ userIds, senderId, type, title, content, refType, refId, extraData }) {
  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) return [];
  const stmt = db.prepare(`
    INSERT INTO notifications (user_id, sender_id, type, title, content, ref_type, ref_id, extra_data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const extraDataStr = extraData ? JSON.stringify(extraData) : null;
  const tx = db.transaction((ids) => {
    const result = [];
    for (const userId of ids) {
      const info = stmt.run(
        userId,
        senderId || null,
        type,
        title,
        content || null,
        refType || null,
        refId || null,
        extraDataStr
      );
      result.push(info.lastInsertRowid);
    }
    return result;
  });
  return tx(userIds);
}

function notifyAnnotationReply({ parentAnnotation, replyAnnotation, versionId }) {
  if (!parentAnnotation || parentAnnotation.user_name === replyAnnotation.user_name) return null;

  const parentUser = db.prepare('SELECT id FROM users WHERE username = ? OR display_name = ?').get(
    parentAnnotation.user_name,
    parentAnnotation.user_name
  );
  if (!parentUser) return null;

  const title = '您的批注收到了新回复';
  const content = `${replyAnnotation.user_name} 回复了您的批注：「${replyAnnotation.comment}」`;

  return createNotification({
    userId: parentUser.id,
    senderId: null,
    type: NOTIFICATION_TYPES.ANNOTATION_REPLY,
    title,
    content,
    refType: 'annotation',
    refId: parentAnnotation.id,
    extraData: {
      annotationId: replyAnnotation.id,
      versionId,
      anchorText: replyAnnotation.anchor_text,
      replyUser: replyAnnotation.user_name
    }
  });
}

function notifyTaskAssigned({ taskId, taskTitle, assigneeIds, assignerId, assignerName }) {
  const title = '您被指派了新任务';
  const content = `${assignerName || '系统'} 将任务「${taskTitle}」指派给您`;
  return createBatchNotifications({
    userIds: assigneeIds,
    senderId: assignerId,
    type: NOTIFICATION_TYPES.TASK_ASSIGNED,
    title,
    content,
    refType: 'task',
    refId: taskId,
    extraData: { taskId, taskTitle }
  });
}

function notifyTaskComment({ taskId, taskTitle, commentUserId, commentUserName }) {
  const assignees = db.prepare(`
    SELECT user_id FROM task_assignments WHERE task_id = ? AND user_id != ?
  `).all(taskId, commentUserId);

  const task = db.prepare('SELECT creator_id FROM tasks WHERE id = ?').get(taskId);
  const userIds = new Set(assignees.map(a => a.user_id));
  if (task && task.creator_id !== commentUserId) {
    userIds.add(task.creator_id);
  }
  if (userIds.size === 0) return [];

  const title = '任务有新评论';
  const content = `${commentUserName} 在任务「${taskTitle}」中发表了评论`;

  return createBatchNotifications({
    userIds: Array.from(userIds),
    senderId: commentUserId,
    type: NOTIFICATION_TYPES.TASK_COMMENT,
    title,
    content,
    refType: 'task',
    refId: taskId,
    extraData: { taskId, taskTitle }
  });
}

function notifyReviewResult({ submissionId, submissionVersion, status, reviewNote, reviewerId, submitterName, submitterContact }) {
  const submitter = db.prepare(`
    SELECT u.id FROM users u
    WHERE u.username = ? OR u.display_name = ? OR u.email = ?
  `).get(submitterName, submitterName, submitterContact || '');

  if (!submitter) return null;

  const isApproved = status === 'approved';
  const title = isApproved ? '您的版本提交已通过审核' : '您的版本提交未通过审核';
  const content = isApproved
    ? `版本「${submissionVersion}」已通过审核，感谢您的贡献！`
    : `版本「${submissionVersion}」未通过审核${reviewNote ? '，审核意见：' + reviewNote : ''}`;

  return createNotification({
    userId: submitter.id,
    senderId: reviewerId,
    type: NOTIFICATION_TYPES.REVIEW_RESULT,
    title,
    content,
    refType: 'submission',
    refId: submissionId,
    extraData: { submissionId, status, reviewNote }
  });
}

function notifySystemAnnouncement({ announcementId, targetRole }) {
  const announcement = db.prepare('SELECT * FROM system_announcements WHERE id = ?').get(announcementId);
  if (!announcement) return [];

  let users;
  if (targetRole) {
    const minLevel = ROLE_HIERARCHY[targetRole] || 0;
    const allUsers = db.prepare('SELECT id, role FROM users WHERE status = ?').all('active');
    users = allUsers.filter(u => (ROLE_HIERARCHY[u.role] || 0) >= minLevel).map(u => u.id);
  } else {
    users = db.prepare('SELECT id FROM users WHERE status = ?').all('active').map(u => u.id);
  }

  if (users.length === 0) return [];

  const content = announcement.content.length > 100
    ? announcement.content.substring(0, 100) + '...'
    : announcement.content;

  return createBatchNotifications({
    userIds: users,
    senderId: announcement.creator_id,
    type: NOTIFICATION_TYPES.SYSTEM_ANNOUNCEMENT,
    title: announcement.title,
    content,
    refType: 'announcement',
    refId: announcementId,
    extraData: { announcementId, priority: announcement.priority }
  });
}

function getUserNotifications(userId, filters = {}) {
  let sql = `
    SELECT n.*, u.username as sender_username, u.display_name as sender_display_name
    FROM notifications n
    LEFT JOIN users u ON n.sender_id = u.id
    WHERE n.user_id = ?
  `;
  const params = [userId];
  const conditions = [];

  if (filters.type && filters.type !== 'all') {
    conditions.push('n.type = ?');
    params.push(filters.type);
  }

  if (filters.isRead !== undefined && filters.isRead !== 'all') {
    conditions.push('n.is_read = ?');
    params.push(filters.isRead === true || filters.isRead === 'true' ? 1 : 0);
  }

  if (conditions.length > 0) {
    sql += ' AND ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY n.created_at DESC';

  if (filters.page && filters.pageSize) {
    const page = Number(filters.page);
    const pageSize = Number(filters.pageSize);
    const offset = (page - 1) * pageSize;
    sql += ' LIMIT ? OFFSET ?';
    params.push(pageSize, offset);
  }

  const rows = db.prepare(sql).all(...params);
  return rows.map(row => ({
    ...row,
    type_label: NOTIFICATION_TYPE_LABELS[row.type] || row.type,
    sender_name: row.sender_display_name || row.sender_username || '系统',
    extra_data: row.extra_data ? JSON.parse(row.extra_data) : null
  }));
}

function getUnreadCount(userId, type = null) {
  let sql = 'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0';
  const params = [userId];
  if (type && type !== 'all') {
    sql += ' AND type = ?';
    params.push(type);
  }
  return db.prepare(sql).get(...params).count;
}

function markAsRead(notificationId, userId) {
  return db.prepare(`
    UPDATE notifications SET is_read = 1, read_at = datetime('now','localtime')
    WHERE id = ? AND user_id = ?
  `).run(notificationId, userId);
}

function markAllAsRead(userId, type = null) {
  let sql = `
    UPDATE notifications SET is_read = 1, read_at = datetime('now','localtime')
    WHERE user_id = ? AND is_read = 0
  `;
  const params = [userId];
  if (type && type !== 'all') {
    sql += ' AND type = ?';
    params.push(type);
  }
  return db.prepare(sql).run(...params);
}

function deleteNotification(notificationId, userId) {
  return db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?').run(notificationId, userId);
}

function deleteAllReadNotifications(userId) {
  return db.prepare('DELETE FROM notifications WHERE user_id = ? AND is_read = 1').run(userId);
}

function createAnnouncement({ title, content, priority, targetRole, creatorId }) {
  const info = db.prepare(`
    INSERT INTO system_announcements (title, content, priority, target_role, creator_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    title,
    content,
    priority || 'normal',
    targetRole || null,
    creatorId || null
  );
  return info.lastInsertRowid;
}

function getAnnouncements(filters = {}) {
  let sql = `
    SELECT sa.*, u.username as creator_username, u.display_name as creator_display_name
    FROM system_announcements sa
    LEFT JOIN users u ON sa.creator_id = u.id
  `;
  const params = [];
  const conditions = [];

  if (filters.status && filters.status !== 'all') {
    conditions.push('sa.status = ?');
    params.push(filters.status);
  }

  if (filters.priority && filters.priority !== 'all') {
    conditions.push('sa.priority = ?');
    params.push(filters.priority);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY sa.created_at DESC';

  if (filters.page && filters.pageSize) {
    const page = Number(filters.page);
    const pageSize = Number(filters.pageSize);
    const offset = (page - 1) * pageSize;
    sql += ' LIMIT ? OFFSET ?';
    params.push(pageSize, offset);
  }

  return db.prepare(sql).all(...params).map(row => ({
    ...row,
    creator_name: row.creator_display_name || row.creator_username || '系统'
  }));
}

function getAnnouncement(id) {
  const row = db.prepare(`
    SELECT sa.*, u.username as creator_username, u.display_name as creator_display_name
    FROM system_announcements sa
    LEFT JOIN users u ON sa.creator_id = u.id
    WHERE sa.id = ?
  `).get(id);
  if (!row) return null;
  return {
    ...row,
    creator_name: row.creator_display_name || row.creator_username || '系统'
  };
}

function updateAnnouncement(id, { title, content, priority, targetRole, status }) {
  const fields = [];
  const values = [];

  if (title !== undefined) { fields.push('title = ?'); values.push(title); }
  if (content !== undefined) { fields.push('content = ?'); values.push(content); }
  if (priority !== undefined) { fields.push('priority = ?'); values.push(priority); }
  if (targetRole !== undefined) { fields.push('target_role = ?'); values.push(targetRole || null); }
  if (status !== undefined) { fields.push('status = ?'); values.push(status); }

  if (fields.length === 0) return null;

  fields.push('updated_at = datetime(\'now\',\'localtime\')');
  values.push(id);

  return db.prepare(`UPDATE system_announcements SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

function deleteAnnouncement(id) {
  return db.prepare('DELETE FROM system_announcements WHERE id = ?').run(id);
}

module.exports = {
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_LABELS,
  ANNOUNCEMENT_PRIORITIES,
  createNotification,
  createBatchNotifications,
  notifyAnnotationReply,
  notifyTaskAssigned,
  notifyTaskComment,
  notifyReviewResult,
  notifySystemAnnouncement,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllReadNotifications,
  createAnnouncement,
  getAnnouncements,
  getAnnouncement,
  updateAnnouncement,
  deleteAnnouncement
};

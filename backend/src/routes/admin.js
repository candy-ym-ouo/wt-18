const { db, ROLES, ROLE_HIERARCHY } = require('../db');
const authModule = require('../auth');
const {
  authenticate,
  requireRole,
  requireRoleLevel,
  canManageRole,
  hashPassword
} = authModule;
const AUTH_ROLES = authModule.ROLES;

async function routes(fastify) {
  const ADMIN_ROLES = [AUTH_ROLES.ADMIN, AUTH_ROLES.EDITOR];

  fastify.get('/api/admin/stats', {
    preHandler: [authenticate(), requireRole(...ADMIN_ROLES)]
  }, async () => {
    return {
      entries: db.prepare('SELECT COUNT(*) AS c FROM entries').get().c,
      versions: db.prepare('SELECT COUNT(*) AS c FROM versions').get().c,
      images: db.prepare('SELECT COUNT(*) AS c FROM images').get().c,
      annotations: db.prepare('SELECT COUNT(*) AS c FROM annotations').get().c,
      references: db.prepare('SELECT COUNT(*) AS c FROM refs').get().c,
      users: db.prepare('SELECT COUNT(*) AS c FROM users').get().c,
      activeUsers: db.prepare('SELECT COUNT(*) AS c FROM users WHERE status = ?').get('active').c,
      topics: db.prepare('SELECT COUNT(*) AS c FROM topics').get().c,
      chapters: db.prepare('SELECT COUNT(*) AS c FROM chapters').get().c
    };
  });

  fastify.get('/api/admin/entries', {
    preHandler: [authenticate(), requireRole(...ADMIN_ROLES)]
  }, async () => {
    return db.prepare(`
      SELECT e.*,
        (SELECT COUNT(*) FROM versions v WHERE v.entry_id = e.id) AS version_count,
        (SELECT COUNT(*) FROM refs r WHERE r.from_entry_id = e.id OR r.to_entry_id = e.id) AS ref_count
      FROM entries e ORDER BY e.id DESC
    `).all();
  });

  fastify.get('/api/admin/versions', {
    preHandler: [authenticate(), requireRole(...ADMIN_ROLES)]
  }, async () => {
    return db.prepare(`
      SELECT v.*, e.title AS entry_title
      FROM versions v JOIN entries e ON v.entry_id = e.id
      ORDER BY v.id DESC
    `).all();
  });

  fastify.get('/api/admin/all-entries', {
    preHandler: [authenticate(), requireRole(...ADMIN_ROLES)]
  }, async () => {
    return db.prepare('SELECT id, title FROM entries ORDER BY title').all();
  });

  fastify.get('/api/admin/users', {
    preHandler: [authenticate(), requireRole(...ADMIN_ROLES)]
  }, async (request, reply) => {
    const users = db.prepare(`
      SELECT id, username, email, display_name, role, status,
             last_login_at, created_at, updated_at
      FROM users ORDER BY id
    `).all();
    const managerLevel = ROLE_HIERARCHY[request.user.role] || 0;
    return users.map(u => ({
      ...u,
      displayName: u.display_name || u.username,
      roleLevel: ROLE_HIERARCHY[u.role] || 0,
      canEdit: managerLevel > (ROLE_HIERARCHY[u.role] || 0)
    }));
  });

  fastify.get('/api/admin/users/:id', {
    preHandler: [authenticate(), requireRole(...ADMIN_ROLES)]
  }, async (request, reply) => {
    const id = Number(request.params.id);
    const user = db.prepare(`
      SELECT id, username, email, display_name, role, status,
             last_login_at, created_at, updated_at
      FROM users WHERE id = ?
    `).get(id);
    if (!user) {
      reply.code(404);
      return { error: '用户不存在', code: 'USER_NOT_FOUND' };
    }
    const targetLevel = ROLE_HIERARCHY[user.role] || 0;
    const managerLevel = ROLE_HIERARCHY[request.user.role] || 0;
    if (managerLevel <= targetLevel) {
      reply.code(403);
      return { error: '无权限查看该用户详情', code: 'PERMISSION_DENIED' };
    }
    return {
      ...user,
      displayName: user.display_name || user.username,
      roleLevel: targetLevel
    };
  });

  fastify.post('/api/admin/users', {
    preHandler: [authenticate(), requireRoleLevel(AUTH_ROLES.EDITOR)]
  }, async (request, reply) => {
    const { username, password, email, displayName, role } = request.body || {};
    if (!username || !password) {
      reply.code(400);
      return { error: '用户名和密码必填', code: 'MISSING_FIELDS' };
    }
    if (password.length < 6) {
      reply.code(400);
      return { error: '密码至少需要6位', code: 'PASSWORD_TOO_SHORT' };
    }
    if (username.length < 3) {
      reply.code(400);
      return { error: '用户名至少需要3位', code: 'USERNAME_TOO_SHORT' };
    }
    const targetRole = role || AUTH_ROLES.VIEWER;
    if (!canManageRole(request.user.role, targetRole)) {
      reply.code(403);
      return { error: `无权限创建角色为「${targetRole}」的用户`, code: 'ROLE_PERMISSION_DENIED' };
    }
    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
    if (exists) {
      reply.code(409);
      return { error: '用户名已存在', code: 'USERNAME_EXISTS' };
    }
    const info = db.prepare(`
      INSERT INTO users (username, password_hash, email, display_name, role, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `).run(
      username.trim(),
      hashPassword(password),
      email || null,
      displayName || username.trim(),
      targetRole
    );
    const user = db.prepare(`
      SELECT id, username, email, display_name, role, status, created_at
      FROM users WHERE id = ?
    `).get(info.lastInsertRowid);
    return {
      ...user,
      displayName: user.display_name || user.username,
      roleLevel: ROLE_HIERARCHY[user.role] || 0
    };
  });

  fastify.put('/api/admin/users/:id', {
    preHandler: [authenticate(), requireRoleLevel(AUTH_ROLES.EDITOR)]
  }, async (request, reply) => {
    const id = Number(request.params.id);
    const { email, displayName, role, status } = request.body || {};
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!target) {
      reply.code(404);
      return { error: '用户不存在', code: 'USER_NOT_FOUND' };
    }
    const managerLevel = ROLE_HIERARCHY[request.user.role] || 0;
    const targetLevel = ROLE_HIERARCHY[target.role] || 0;
    if (managerLevel <= targetLevel) {
      reply.code(403);
      return { error: '无权限修改该用户', code: 'PERMISSION_DENIED' };
    }
    let newRole = target.role;
    if (role && role !== target.role) {
      if (!canManageRole(request.user.role, role)) {
        reply.code(403);
        return { error: `无权限将用户角色改为「${role}」`, code: 'ROLE_PERMISSION_DENIED' };
      }
      newRole = role;
    }
    db.prepare(`
      UPDATE users SET email=?, display_name=?, role=?, status=?,
        updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(
      email !== undefined ? (email || null) : target.email,
      displayName !== undefined ? (displayName || null) : target.display_name,
      newRole,
      status || target.status,
      id
    );
    const user = db.prepare(`
      SELECT id, username, email, display_name, role, status,
             last_login_at, created_at, updated_at
      FROM users WHERE id = ?
    `).get(id);
    return {
      ...user,
      displayName: user.display_name || user.username,
      roleLevel: ROLE_HIERARCHY[user.role] || 0
    };
  });

  fastify.put('/api/admin/users/:id/reset-password', {
    preHandler: [authenticate(), requireRoleLevel(AUTH_ROLES.EDITOR)]
  }, async (request, reply) => {
    const id = Number(request.params.id);
    const { newPassword } = request.body || {};
    if (!newPassword || newPassword.length < 6) {
      reply.code(400);
      return { error: '新密码至少需要6位', code: 'PASSWORD_TOO_SHORT' };
    }
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!target) {
      reply.code(404);
      return { error: '用户不存在', code: 'USER_NOT_FOUND' };
    }
    const managerLevel = ROLE_HIERARCHY[request.user.role] || 0;
    const targetLevel = ROLE_HIERARCHY[target.role] || 0;
    if (managerLevel <= targetLevel) {
      reply.code(403);
      return { error: '无权限重置该用户密码', code: 'PERMISSION_DENIED' };
    }
    db.prepare(`
      UPDATE users SET password_hash = ?, updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(hashPassword(newPassword), id);
    return { success: true, message: '密码重置成功' };
  });

  fastify.delete('/api/admin/users/:id', {
    preHandler: [authenticate(), requireRoleLevel(AUTH_ROLES.EDITOR)]
  }, async (request, reply) => {
    const id = Number(request.params.id);
    if (id === request.user.id) {
      reply.code(400);
      return { error: '不能删除自己的账号', code: 'CANNOT_DELETE_SELF' };
    }
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!target) {
      reply.code(404);
      return { error: '用户不存在', code: 'USER_NOT_FOUND' };
    }
    const managerLevel = ROLE_HIERARCHY[request.user.role] || 0;
    const targetLevel = ROLE_HIERARCHY[target.role] || 0;
    if (managerLevel <= targetLevel) {
      reply.code(403);
      return { error: '无权限删除该用户', code: 'PERMISSION_DENIED' };
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return { success: true, message: '用户已删除' };
  });

  fastify.put('/api/admin/users/:id/toggle-status', {
    preHandler: [authenticate(), requireRoleLevel(AUTH_ROLES.EDITOR)]
  }, async (request, reply) => {
    const id = Number(request.params.id);
    if (id === request.user.id) {
      reply.code(400);
      return { error: '不能禁用自己的账号', code: 'CANNOT_DISABLE_SELF' };
    }
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!target) {
      reply.code(404);
      return { error: '用户不存在', code: 'USER_NOT_FOUND' };
    }
    const managerLevel = ROLE_HIERARCHY[request.user.role] || 0;
    const targetLevel = ROLE_HIERARCHY[target.role] || 0;
    if (managerLevel <= targetLevel) {
      reply.code(403);
      return { error: '无权限修改该用户状态', code: 'PERMISSION_DENIED' };
    }
    const newStatus = target.status === 'active' ? 'disabled' : 'active';
    db.prepare(`
      UPDATE users SET status = ?, updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(newStatus, id);
    return { success: true, status: newStatus };
  });
}

module.exports = routes;

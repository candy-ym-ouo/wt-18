const { db, ROLES } = require('../db');
const {
  hashPassword,
  verifyPassword,
  generateToken,
  authenticate,
  requireRoleLevel,
  requireRole,
  canManageRole,
  ROLE_HIERARCHY
} = require('../auth');

async function routes(fastify) {
  fastify.post('/api/auth/login', async (request, reply) => {
    const { username, password } = request.body || {};
    if (!username || !password) {
      reply.code(400);
      return { error: '请输入用户名和密码', code: 'MISSING_FIELDS' };
    }
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
    if (!user) {
      reply.code(401);
      return { error: '用户名或密码错误', code: 'INVALID_CREDENTIALS' };
    }
    if (!user.password_hash) {
      reply.code(401);
      return { error: '账号未设置密码，请联系管理员', code: 'NO_PASSWORD' };
    }
    if (!verifyPassword(password, user.password_hash)) {
      reply.code(401);
      return { error: '用户名或密码错误', code: 'INVALID_CREDENTIALS' };
    }
    if (user.status !== 'active') {
      reply.code(403);
      return { error: '账号已被禁用，请联系管理员', code: 'USER_DISABLED' };
    }
    db.prepare('UPDATE users SET last_login_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(user.id);
    const token = generateToken(user);
    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name || user.username,
        role: user.role,
        roleLevel: ROLE_HIERARCHY[user.role] || 0,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at
      }
    };
  });

  fastify.post('/api/auth/register', async (request, reply) => {
    const { username, password, email, displayName } = request.body || {};
    if (!username || !password) {
      reply.code(400);
      return { error: '请填写用户名和密码', code: 'MISSING_FIELDS' };
    }
    if (password.length < 6) {
      reply.code(400);
      return { error: '密码至少需要6位', code: 'PASSWORD_TOO_SHORT' };
    }
    if (username.length < 3) {
      reply.code(400);
      return { error: '用户名至少需要3位', code: 'USERNAME_TOO_SHORT' };
    }
    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
    if (exists) {
      reply.code(409);
      return { error: '用户名已存在', code: 'USERNAME_EXISTS' };
    }
    const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
    const role = userCount === 0 ? ROLES.ADMIN : ROLES.VIEWER;
    const info = db.prepare(`
      INSERT INTO users (username, password_hash, email, display_name, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      username.trim(),
      hashPassword(password),
      email || null,
      displayName || username.trim(),
      role
    );
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    const token = generateToken(user);
    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name || user.username,
        role: user.role,
        roleLevel: ROLE_HIERARCHY[user.role] || 0,
        createdAt: user.created_at
      }
    };
  });

  fastify.get('/api/auth/me', { preHandler: [authenticate()] }, async (request) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(request.user.id);
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.display_name || user.username,
      role: user.role,
      roleLevel: ROLE_HIERARCHY[user.role] || 0,
      status: user.status,
      createdAt: user.created_at,
      lastLoginAt: user.last_login_at
    };
  });

  fastify.put('/api/auth/change-password', { preHandler: [authenticate()] }, async (request, reply) => {
    const { oldPassword, newPassword } = request.body || {};
    if (!oldPassword || !newPassword) {
      reply.code(400);
      return { error: '请输入原密码和新密码', code: 'MISSING_FIELDS' };
    }
    if (newPassword.length < 6) {
      reply.code(400);
      return { error: '新密码至少需要6位', code: 'PASSWORD_TOO_SHORT' };
    }
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(request.user.id);
    if (user.password_hash && !verifyPassword(oldPassword, user.password_hash)) {
      reply.code(401);
      return { error: '原密码错误', code: 'WRONG_PASSWORD' };
    }
    db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(
      hashPassword(newPassword),
      request.user.id
    );
    return { success: true, message: '密码修改成功' };
  });

  fastify.get('/api/auth/roles', { preHandler: [authenticate(), requireRole(ROLES.ADMIN, ROLES.EDITOR)] }, async () => {
    return Object.entries(ROLE_HIERARCHY)
      .map(([role, level]) => ({ role, level }))
      .sort((a, b) => b.level - a.level);
  });
}

module.exports = routes;

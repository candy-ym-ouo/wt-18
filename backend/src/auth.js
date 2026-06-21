const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db, ROLES, ROLE_PERMISSIONS, ROLE_HIERARCHY } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'oldbook-scholar-secret-key-2024';
const JWT_EXPIRES_IN = '7d';
const SALT_ROUNDS = 10;

function hashPassword(password) {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.display_name || user.username
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

function extractToken(request) {
  const authHeader = request.headers.authorization;
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}

function authenticate() {
  return async (request, reply) => {
    const token = extractToken(request);
    if (!token) {
      reply.code(401).send({ error: '未提供认证令牌', code: 'NO_TOKEN' });
      return;
    }
    const payload = verifyToken(token);
    if (!payload) {
      reply.code(401).send({ error: '认证令牌无效或已过期', code: 'INVALID_TOKEN' });
      return;
    }
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
    if (!user) {
      reply.code(401).send({ error: '用户不存在', code: 'USER_NOT_FOUND' });
      return;
    }
    if (user.status !== 'active') {
      reply.code(403).send({ error: '账号已被禁用', code: 'USER_DISABLED' });
      return;
    }
    request.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.display_name || user.username,
      role: user.role
    };
  };
}

function hasPermission(userRole, permission) {
  const perms = ROLE_PERMISSIONS[userRole] || [];
  if (perms.includes('*')) return true;
  if (perms.includes(permission)) return true;
  const resource = permission.split(':')[0];
  if (perms.includes(`${resource}:*`)) return true;
  return false;
}

function requirePermission(permission) {
  return async (request, reply) => {
    if (!request.user) {
      reply.code(401).send({ error: '未认证', code: 'UNAUTHENTICATED' });
      return;
    }
    if (!hasPermission(request.user.role, permission)) {
      reply.code(403).send({ error: `无权限执行此操作（需要: ${permission}）`, code: 'PERMISSION_DENIED' });
      return;
    }
  };
}

function requireRole(...roles) {
  return async (request, reply) => {
    if (!request.user) {
      reply.code(401).send({ error: '未认证', code: 'UNAUTHENTICATED' });
      return;
    }
    if (!roles.includes(request.user.role)) {
      reply.code(403).send({ error: `需要角色: ${roles.join('/')}`, code: 'ROLE_REQUIRED' });
      return;
    }
  };
}

function requireRoleLevel(minRole) {
  return async (request, reply) => {
    if (!request.user) {
      reply.code(401).send({ error: '未认证', code: 'UNAUTHENTICATED' });
      return;
    }
    const userLevel = ROLE_HIERARCHY[request.user.role] || 0;
    const minLevel = ROLE_HIERARCHY[minRole] || 999;
    if (userLevel < minLevel) {
      reply.code(403).send({ error: `权限不足（需要等级 ≥ ${minRole}）`, code: 'INSUFFICIENT_LEVEL' });
      return;
    }
  };
}

function canManageRole(managerRole, targetRole) {
  return (ROLE_HIERARCHY[managerRole] || 0) > (ROLE_HIERARCHY[targetRole] || 999);
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  extractToken,
  authenticate,
  hasPermission,
  requirePermission,
  requireRole,
  requireRoleLevel,
  canManageRole,
  ROLES,
  ROLE_PERMISSIONS,
  ROLE_HIERARCHY,
  JWT_SECRET
};

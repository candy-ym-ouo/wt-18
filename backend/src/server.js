const fastify = require('fastify')({ logger: false });
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const dbPath = path.join(dataDir, 'oldbook.db');
const dbExisted = fs.existsSync(dbPath);
try {
  require('./db');
  if (!dbExisted) {
    console.log('🗄️  首次启动，初始化数据库...');
    require('./seed');
  }
} catch (e) {
  console.error('❌ 数据库初始化失败:', e.message);
  process.exit(1);
}

const { authenticate, requirePermission, requireRole, requireRoleLevel, ROLES } = require('./auth');

try {
  fastify.register(require('@fastify/cors'), {
    origin: true,
    credentials: true,
    exposedHeaders: ['Authorization']
  });
  fastify.register(require('@fastify/multipart'), {
    limits: { fileSize: 10 * 1024 * 1024 }
  });
  fastify.register(require('@fastify/static'), {
    root: uploadsDir,
    prefix: '/uploads/',
  });

  const routeModules = [
    ['auth', require('./routes/auth')],
    ['entries', require('./routes/entries')],
    ['versions', require('./routes/versions')],
    ['images', require('./routes/images')],
    ['annotations', require('./routes/annotations')],
    ['references', require('./routes/references')],
    ['tasks', require('./routes/tasks')],
    ['topics', require('./routes/topics')],
    ['admin', require('./routes/admin')],
    ['versionSubmissions', require('./routes/versionSubmissions')],
    ['collation', require('./routes/collation')],
    ['bibliography', require('./routes/bibliography')],
    ['notifications', require('./routes/notifications')],
    ['dataCenter', require('./routes/dataCenter')],
    ['revisionHistory', require('./routes/revisionHistory')]
  ];

  for (const [name, mod] of routeModules) {
    try {
      fastify.register(mod);
      console.log(`✅ 路由模块 [${name}] 注册成功`);
    } catch (e) {
      console.error(`❌ 路由模块 [${name}] 注册失败:`, e.message);
      process.exit(1);
    }
  }

  fastify.get('/', () => ({ name: '旧书版本考据社区 - 后端 API', version: '1.0.0', docs: '/api/entries', auth: '/api/auth/login' }));
  fastify.get('/api/health', () => ({ status: 'ok', time: new Date().toISOString() }));
} catch (e) {
  console.error('❌ 插件注册失败:', e.message);
  process.exit(1);
}

const start = async () => {
  try {
    const port = process.env.PORT || 3001;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log(`🚀 后端服务已启动:  http://localhost:${port}`);
    console.log(`📚 接口基础地址:   http://localhost:${port}/api`);
    console.log(`� 登录接口:       http://localhost:${port}/api/auth/login`);
    console.log(`��️  静态文件目录:  http://localhost:${port}/uploads/`);
    try {
      const printed = typeof fastify.printRoutes === 'function'
        ? fastify.printRoutes({ commonPrefix: false })
        : '';
      const apis = printed.split('\n').filter(l => l && l.includes('/api/'));
      const byMethod = {};
      for (const line of apis) {
        const m = line.match(/(GET|POST|PUT|DELETE|PATCH)/);
        if (m) {
          const method = m[1];
          byMethod[method] = (byMethod[method] || 0) + 1;
        }
      }
      const total = Object.values(byMethod).reduce((a, b) => a + b, 0);
      if (total > 0) {
        console.log('');
        console.log(`📋 已注册 ${total} 个 API 路由:`);
        for (const m of Object.keys(byMethod).sort()) {
          console.log(`   ${m.padEnd(6)} ${byMethod[m]} 条`);
        }
      }
    } catch (_) { /* 忽略路由打印错误 */ }
    console.log('══════════════════════════════════════════════════');
  } catch (err) {
    console.error('❌ 服务启动失败:', err.message);
    process.exit(1);
  }
};

start();

module.exports = { authenticate, requirePermission, requireRole, requireRoleLevel, ROLES };

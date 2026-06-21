const fastify = require('fastify')({ logger: true });
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data', 'oldbook.db');
if (!fs.existsSync(dbPath)) {
  require('./db');
  require('./seed');
} else {
  require('./db');
}

fastify.register(require('@fastify/cors'), { origin: true });
fastify.register(require('@fastify/multipart'));
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, '..', 'uploads'),
  prefix: '/uploads/',
});

fastify.register(require('./routes/entries'));
fastify.register(require('./routes/versions'));
fastify.register(require('./routes/images'));
fastify.register(require('./routes/annotations'));
fastify.register(require('./routes/references'));
fastify.register(require('./routes/admin'));

fastify.get('/api/health', () => ({ status: 'ok', time: new Date().toISOString() }));

const start = async () => {
  try {
    const port = process.env.PORT || 3001;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 后端服务已启动: http://localhost:${port}`);
    console.log(`📚 接口基础地址: http://localhost:${port}/api`);
    console.log(`🖼️  静态文件目录: http://localhost:${port}/uploads/`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

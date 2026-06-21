const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 启动旧书版本考据社区...');
console.log('');

const backend = spawn('npm', ['start'], {
  cwd: path.join(__dirname, '..', 'backend'),
  stdio: 'inherit',
  shell: true
});

setTimeout(() => {
  const frontend = spawn('npm', ['run', 'dev'], {
    cwd: path.join(__dirname, '..', 'frontend'),
    stdio: 'inherit',
    shell: true
  });

  frontend.on('error', (err) => console.error('前端启动失败:', err));
}, 3000);

backend.on('error', (err) => console.error('后端启动失败:', err));

process.on('SIGINT', () => {
  console.log('\n🛑 正在关闭服务...');
  process.exit(0);
});

const { spawn, execSync } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

const BACKEND_URL = 'http://127.0.0.1:3001/api/health';
const BACKEND_PORT = 3001;
const FRONTEND_PORT = 5173;

const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  bold: '\x1b[1m'
};

function log(prefix, msg, color = 'reset') {
  const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  console.log(`${colors[color]}[${ts}] ${prefix} ${msg}${colors.reset}`);
}

function waitForBackend(timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const check = () => {
      const req = http.get(BACKEND_URL, (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          retryOrFail();
        }
        res.resume();
      });
      req.on('error', () => retryOrFail());
      req.setTimeout(1000, () => req.destroy());
    };
    const retryOrFail = () => {
      if (Date.now() - startTime > timeoutMs) {
        reject(new Error('后端启动超时'));
      } else {
        setTimeout(check, 800);
      }
    };
    check();
  });
}

console.log('');
console.log(`${colors.bold}${colors.cyan}╔══════════════════════════════════════════════╗${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}║       📜 旧书版本考据社区 - 一键启动        ║${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}╚══════════════════════════════════════════════╝${colors.reset}`);
console.log('');

function killPort(port) {
  if (process.platform === 'win32') return;
  try {
    const result = require('child_process').execSync(`lsof -ti :${port} 2>/dev/null || true`).toString().trim();
    if (result) {
      const pids = result.split(/\s+/);
      for (const pid of pids) {
        if (pid) {
          try { process.kill(pid, 9); } catch (_) {}
        }
      }
      log('INFO', `清理端口 ${port}（已终止进程）`, 'yellow');
      return true;
    }
  } catch (_) {}
  return false;
}

killPort(BACKEND_PORT);
killPort(FRONTEND_PORT);
for (let p = FRONTEND_PORT + 1; p < FRONTEND_PORT + 6; p++) killPort(p);
require('child_process').execSync('sleep 1 2>/dev/null || true', { stdio: 'ignore' });

log('INFO', '启动后端服务 (端口 ' + BACKEND_PORT + ')...', 'cyan');

const backend = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['start'], {
  cwd: path.join(__dirname, '..', 'backend'),
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: process.platform === 'win32'
});

let backendReady = false;
backend.stdout.on('data', (buf) => {
  const text = buf.toString();
  process.stdout.write(text.split('\n').map(l => l ? `${colors.cyan}[BACKEND]${colors.reset} ${l}` : '').join('\n'));
  if (text.includes('🚀 后端服务已启动') || text.includes('Server listening')) {
    backendReady = true;
  }
});
backend.stderr.on('data', (buf) => {
  const text = buf.toString();
  process.stderr.write(`${colors.yellow}[BACKEND-ERR]${colors.reset} ${text}`);
  if (text.includes('🚀 后端服务已启动') || text.includes('Server listening')) {
    backendReady = true;
  }
});
backend.on('error', (err) => {
  log('ERROR', '后端进程启动失败: ' + err.message, 'red');
  process.exit(1);
});
backend.on('close', (code) => {
  if (code !== 0) {
    log('ERROR', `后端进程异常退出 (代码: ${code})`, 'red');
    process.exit(1);
  }
});

function waitForBoth(timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const check = () => {
      if (backendReady) {
        const req = http.get(BACKEND_URL, (res) => {
          if (res.statusCode === 200) {
            resolve(true);
          } else {
            retryOrFail();
          }
          res.resume();
        });
        req.on('error', () => retryOrFail());
        req.setTimeout(1000, () => req.destroy());
      } else {
        retryOrFail();
      }
    };
    const retryOrFail = () => {
      if (Date.now() - startTime > timeoutMs) {
        reject(new Error('后端启动超时'));
      } else {
        setTimeout(check, 500);
      }
    };
    check();
  });
}

waitForBoth().then(() => {
  log('OK', '后端服务已就绪', 'green');
  log('INFO', '启动前端服务...', 'cyan');

  const frontend = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev', '--', '--port', FRONTEND_PORT], {
    cwd: path.join(__dirname, '..', 'frontend'),
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32'
  });

  let actualFrontendPort = FRONTEND_PORT;
  let frontendReady = false;
  frontend.stdout.on('data', (buf) => {
    const text = buf.toString();
    process.stdout.write(text.split('\n').map(l => l ? `${colors.green}[FRONTEND]${colors.reset} ${l}` : '').join('\n'));
    const portMatch = text.match(/Local:\s*http:\/\/127\.0\.0\.1:(\d+)/);
    if (portMatch) {
      actualFrontendPort = parseInt(portMatch[1], 10);
    }
    if (text.includes('ready in') && !frontendReady) {
      frontendReady = true;
      setTimeout(() => showSummary(actualFrontendPort), 800);
    }
  });
  frontend.stderr.on('data', (buf) => {
    const text = buf.toString();
    process.stderr.write(`${colors.yellow}[FRONTEND-ERR]${colors.reset} ${text}`);
    const portMatch = text.match(/Local:\s*http:\/\/127\.0\.0\.1:(\d+)/);
    if (portMatch) actualFrontendPort = parseInt(portMatch[1], 10);
  });
  frontend.on('error', (err) => {
    log('ERROR', '前端进程启动失败: ' + err.message, 'red');
  });
  frontend.on('close', (code) => {
    if (code !== 0) {
      log('WARN', `前端进程退出 (代码: ${code})`, 'yellow');
    }
  });

  function showSummary(port) {
    console.log('');
    console.log(`${colors.bold}${colors.green}═══════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bold}${colors.green}  ✅  服务启动完成！                              ${colors.reset}`);
    console.log(`${colors.bold}${colors.green}  🌐  前端页面:  http://127.0.0.1:${String(port).padEnd(5)}              ${colors.reset}`);
    console.log(`${colors.bold}${colors.green}  🔧  后端 API:  http://127.0.0.1:${BACKEND_PORT}/api               ${colors.reset}`);
    console.log(`${colors.bold}${colors.green}  📖  浏览: 首页 → 词条 → 版本详情 → 批注/图片  ${colors.reset}`);
    console.log(`${colors.bold}${colors.green}  ⚙️   后台: 点击导航栏「后台编辑」                ${colors.reset}`);
    console.log(`${colors.bold}${colors.green}  按 Ctrl+C 停止所有服务                         ${colors.reset}`);
    console.log(`${colors.bold}${colors.green}═══════════════════════════════════════════════════${colors.reset}`);
    console.log('');
  }

  // 兜底 5 秒后显示（防止 Vite ready 日志解析未触发）
  setTimeout(() => { if (!frontendReady) showSummary(actualFrontendPort); }, 12000);

}).catch((err) => {
  log('ERROR', err.message + '，请检查后端日志', 'red');
  process.exit(1);
});

let stopped = false;
function shutdown() {
  if (stopped) return;
  stopped = true;
  console.log('');
  log('INFO', '正在关闭所有服务...', 'yellow');
  setTimeout(() => {
    process.exit(0);
  }, 500);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

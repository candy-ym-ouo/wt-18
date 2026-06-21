const http = require('http');

function request(method, path, data = null, headers = {}) {
  return new Promise((resolve) => {
    const opts = {
      hostname: 'localhost',
      port: 3001,
      path,
      method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
    const req = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}
const post = (p, d, h) => request('POST', p, d, h);
const get = (p, h) => request('GET', p, null, h);
const put = (p, d, h) => request('PUT', p, d, h);
const del = (p, h) => request('DELETE', p, null, h);

async function run() {
  let token, vtoken, etoken;
  let ok = 0, fail = 0;
  function check(name, cond, detail = '') {
    if (cond) { ok++; console.log(`✅ ${name}` + (detail ? ` ${detail}` : '')); }
    else { fail++; console.log(`❌ ${name}` + (detail ? ` ${detail}` : '')); }
  }

  console.log('\n========== 1. 登录测试 ==========');
  const r1 = await post('/api/auth/login', { username: 'admin', password: 'admin123' });
  check('admin登录成功', r1.status === 200 && r1.body.token);
  token = r1.body.token;

  const r1b = await post('/api/auth/login', { username: 'admin', password: 'wrong' });
  check('错误密码登录失败', r1b.status === 401);

  const r1c = await post('/api/auth/login', { username: 'viewer01', password: 'viewer123' });
  check('viewer登录成功', r1c.status === 200);
  vtoken = r1c.body.token;

  const r1d = await post('/api/auth/login', { username: 'editor01', password: 'editor123' });
  check('editor登录成功', r1d.status === 200);
  etoken = r1d.body.token;

  console.log('\n========== 2. 当前用户 ==========');
  const r2 = await get('/api/auth/me', { Authorization: 'Bearer ' + token });
  check('获取当前用户', r2.status === 200 && r2.body.username === 'admin');

  console.log('\n========== 3. 接口鉴权 ==========');
  const r3 = await post('/api/entries', { title: '测试词条' }, { Authorization: 'Bearer ' + vtoken });
  check('viewer不能创建词条', r3.status === 403);

  const r3b = await post('/api/entries', { title: '测试词条_byEditor' }, { Authorization: 'Bearer ' + etoken });
  check('editor可以创建词条', r3b.status === 200);

  const r3c = await get('/api/entries', { Authorization: 'Bearer ' + vtoken });
  check('viewer可以浏览词条(公开)', r3c.status === 200 && Array.isArray(r3c.body));

  console.log('\n========== 4. 成员管理 ==========');
  const r4 = await get('/api/admin/users', { Authorization: 'Bearer ' + token });
  check('admin获取成员列表', r4.status === 200 && r4.body.length >= 3);
  if (r4.body) r4.body.forEach(u => console.log(`    ${u.id}. ${u.username} (${u.role}) - ${u.status}`));

  const r4b = await get('/api/admin/users', { Authorization: 'Bearer ' + vtoken });
  check('viewer不能访问成员列表', r4b.status === 403);

  const r4c = await post('/api/admin/users', {
    username: 'scholar_test', password: 'scholar123',
    displayName: '测试学者', role: 'viewer'
  }, { Authorization: 'Bearer ' + token });
  check('admin创建新学者账号', r4c.status === 200, r4c.body?.username);
  const newUserId = r4c.body?.id;

  if (newUserId) {
    const r4d = await put(`/api/admin/users/${newUserId}`, { role: 'editor' }, { Authorization: 'Bearer ' + token });
    check('修改学者角色为editor', r4d.status === 200 && r4d.body.role === 'editor');

    const r4e = await put(`/api/admin/users/${newUserId}/reset-password`, { newPassword: 'newpass123' }, { Authorization: 'Bearer ' + token });
    check('重置学者密码', r4e.status === 200);

    const r4f = await put(`/api/admin/users/${newUserId}/toggle-status`, {}, { Authorization: 'Bearer ' + token });
    check('禁用学者账号', r4f.status === 200 && r4f.body.status === 'disabled');

    const r4g = await put(`/api/admin/users/${newUserId}/toggle-status`, {}, { Authorization: 'Bearer ' + token });
    check('恢复学者账号', r4g.status === 200 && r4g.body.status === 'active');

    const r4h = await del(`/api/admin/users/${newUserId}`, { Authorization: 'Bearer ' + token });
    check('删除学者账号', r4h.status === 200);
  }

  const r4i = await post('/api/admin/users', {
    username: 'test_admin_creation', password: 'test123',
    displayName: '测试admin创建', role: 'admin'
  }, { Authorization: 'Bearer ' + etoken });
  check('editor不能创建admin角色用户', r4i.status === 403);

  console.log('\n========== 5. 注册功能 ==========');
  const r5 = await post('/api/auth/register', {
    username: 'registered_scholar', password: 'reg123456',
    displayName: '注册学者', email: 'reg@test.com'
  });
  check('注册新学者(首个以外自动为viewer)', r5.status === 200 && r5.body.user?.role === 'viewer');

  console.log('\n========== 6. admin统计 ==========');
  const r6 = await get('/api/admin/stats', { Authorization: 'Bearer ' + token });
  check('admin获取统计数据', r6.status === 200 && typeof r6.body.users === 'number');

  console.log('');
  console.log('══════════════════════════════════');
  console.log(`✅ 通过: ${ok}  ❌ 失败: ${fail}`);
  console.log('══════════════════════════════════');
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(e => { console.error('测试异常:', e.message); process.exit(1); });

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
  let adminToken, editorToken, viewerToken;
  let ok = 0, fail = 0;

  function check(name, cond, detail = '') {
    if (cond) { ok++; console.log(`✅ ${name}` + (detail ? ` (${detail})` : '')); }
    else { fail++; console.log(`❌ ${name}` + (detail ? ` (${detail})` : '')); }
  }

  console.log('🔐 ========= 第一步：获取三角色Token =========');
  const a = await post('/api/auth/login', { username: 'admin', password: 'admin123' });
  adminToken = a.body.token;
  check('admin获取Token', !!adminToken);

  const e = await post('/api/auth/login', { username: 'editor01', password: 'editor123' });
  editorToken = e.body.token;
  check('editor获取Token', !!editorToken);

  const v = await post('/api/auth/login', { username: 'viewer01', password: 'viewer123' });
  viewerToken = v.body.token;
  check('viewer获取Token', !!viewerToken);

  console.log('\n🚫 ========= 第二步：未登录（无Token）拦截测试 =========');

  const noAuthWriteTests = [
    ['POST /api/entries', post('/api/entries', { title: '测试' })],
    ['PUT /api/entries/1', put('/api/entries/1', { title: '改' })],
    ['DELETE /api/entries/1', del('/api/entries/1')],
    ['POST /api/versions', post('/api/versions', { entry_id: 1, version_name: '测试版' })],
    ['PUT /api/versions/1', put('/api/versions/1', { version_name: '改' })],
    ['DELETE /api/versions/1', del('/api/versions/1')],
    ['DELETE /api/images/1', del('/api/images/1')],
    ['POST /api/versions/1/annotations', post('/api/versions/1/annotations', { comment: 'x' })],
    ['DELETE /api/annotations/1', del('/api/annotations/1')],
    ['POST /api/references', post('/api/references', { from_entry_id: 1, to_entry_id: 2, relation_type: '相关' })],
    ['DELETE /api/references/1', del('/api/references/1')],
    ['GET /api/admin/stats', get('/api/admin/stats')],
    ['GET /api/admin/users', get('/api/admin/users')],
    ['POST /api/admin/users', post('/api/admin/users', { username: 'x', password: '123456' })],
    ['GET /api/auth/me', get('/api/auth/me')],
  ];
  for (const [name, p] of noAuthWriteTests) {
    const r = await p;
    check(`${name} 被401拦截`, r.status === 401, `实际${r.status}`);
  }

  console.log('\n🚫 ========= 第三步：viewer角色拦截写接口测试 =========');
  const bearerV = { Authorization: 'Bearer ' + viewerToken };

  const viewerWriteTests = [
    ['POST /api/entries', post('/api/entries', { title: 'viewer越权' }, bearerV)],
    ['PUT /api/entries/1', put('/api/entries/1', { title: 'viewer越权' }, bearerV)],
    ['DELETE /api/entries/1', del('/api/entries/1', bearerV)],
    ['POST /api/versions', post('/api/versions', { entry_id: 1, version_name: 'viewer越权' }, bearerV)],
    ['PUT /api/versions/1', put('/api/versions/1', { version_name: 'viewer越权' }, bearerV)],
    ['DELETE /api/versions/1', del('/api/versions/1', bearerV)],
    ['DELETE /api/images/1', del('/api/images/1', bearerV)],
    ['POST /api/versions/1/annotations', post('/api/versions/1/annotations', { comment: 'x' }, bearerV)],
    ['DELETE /api/annotations/1', del('/api/annotations/1', bearerV)],
    ['POST /api/references', post('/api/references', { from_entry_id: 1, to_entry_id: 2, relation_type: '相关' }, bearerV)],
    ['DELETE /api/references/1', del('/api/references/1', bearerV)],
  ];
  for (const [name, p] of viewerWriteTests) {
    const r = await p;
    check(`viewer ${name} 被403拦截`, r.status === 403, `实际${r.status} ${r.body.error || ''}`);
  }

  console.log('\n🚫 ========= 第四步：viewer拦截后台管理接口 =========');
  const viewerAdminTests = [
    ['GET /api/admin/stats', get('/api/admin/stats', bearerV)],
    ['GET /api/admin/entries', get('/api/admin/entries', bearerV)],
    ['GET /api/admin/versions', get('/api/admin/versions', bearerV)],
    ['GET /api/admin/users', get('/api/admin/users', bearerV)],
    ['GET /api/admin/users/3', get('/api/admin/users/3', bearerV)],
    ['POST /api/admin/users', post('/api/admin/users', { username: 'xx', password: '123456' }, bearerV)],
    ['PUT /api/admin/users/3', put('/api/admin/users/3', { displayName: 'x' }, bearerV)],
    ['PUT /api/admin/users/3/reset-password', put('/api/admin/users/3/reset-password', { newPassword: '123456' }, bearerV)],
    ['PUT /api/admin/users/3/toggle-status', put('/api/admin/users/3/toggle-status', {}, bearerV)],
    ['DELETE /api/admin/users/3', del('/api/admin/users/3', bearerV)],
  ];
  for (const [name, p] of viewerAdminTests) {
    const r = await p;
    check(`viewer ${name} 被403拦截`, r.status === 403, `实际${r.status} ${r.body.error || ''}`);
  }

  console.log('\n🚫 ========= 第五步：editor拦截越权（创建admin/管理admin） =========');
  const bearerE = { Authorization: 'Bearer ' + editorToken };

  const editorOverreachTests = [
    ['POST /api/admin/users (role=admin)', post('/api/admin/users', { username: 'edt_new_admin', password: '123456', role: 'admin' }, bearerE)],
    ['PUT /api/admin/users/1 (admin改role)', put('/api/admin/users/1', { role: 'viewer' }, bearerE)],
    ['PUT /api/admin/users/1/toggle-status (禁用admin)', put('/api/admin/users/1/toggle-status', {}, bearerE)],
    ['DELETE /api/admin/users/1 (删admin)', del('/api/admin/users/1', bearerE)],
  ];
  for (const [name, p] of editorOverreachTests) {
    const r = await p;
    check(`editor ${name} 被403拦截`, r.status === 403, `实际${r.status} ${r.body.error || ''}`);
  }

  console.log('\n✅ ========= 第六步：editor合法写操作应该成功 =========');
  const bearerA = { Authorization: 'Bearer ' + adminToken };

  const r1 = await post('/api/entries', { title: 'editor权限测试词条', author: '测试' }, bearerE);
  check('editor 创建词条(200)', r1.status === 200, `实际${r1.status}`);
  const entryId = r1.body.id;

  if (entryId) {
    const r2 = await put(`/api/entries/${entryId}`, { title: 'editor改后' }, bearerE);
    check(`editor 修改词条(200)`, r2.status === 200, `实际${r2.status}`);

    const r3 = await post('/api/versions', { entry_id: entryId, version_name: 'editor测试版本' }, bearerE);
    check('editor 创建版本(200)', r3.status === 200, `实际${r3.status}`);

    await del(`/api/entries/${entryId}`, bearerA);
  }

  console.log('\n✅ ========= 第七步：admin成员管理完整链路 =========');
  const cu = await post('/api/admin/users', {
    username: 'verify_user_' + Date.now().toString().slice(-5),
    password: 'verify123',
    displayName: '验证账号',
    role: 'viewer'
  }, bearerA);
  check('admin 创建学者(200)', cu.status === 200 && cu.body.username, `实际${cu.status}`);
  const newUid = cu.body?.id;

  if (newUid) {
    const uu = await put(`/api/admin/users/${newUid}`, { displayName: '改后名称', role: 'editor', status: 'active' }, bearerA);
    check(`admin 修改学者角色为editor(200)`, uu.status === 200 && uu.body.role === 'editor', `实际${uu.status} role=${uu.body?.role}`);

    const tp = await put(`/api/admin/users/${newUid}/reset-password`, { newPassword: 'newpass789' }, bearerA);
    check(`admin 重置学者密码(200)`, tp.status === 200 && tp.body.success, `实际${tp.status}`);

    const ts = await put(`/api/admin/users/${newUid}/toggle-status`, {}, bearerA);
    check(`admin 禁用学者(200)`, ts.status === 200 && ts.body.status === 'disabled', `实际${ts.status}`);

    const ts2 = await put(`/api/admin/users/${newUid}/toggle-status`, {}, bearerA);
    check(`admin 恢复学者(200)`, ts2.status === 200 && ts2.body.status === 'active', `实际${ts2.status}`);

    // 用新密码登录
    const nl = await post('/api/auth/login', { username: cu.body.username, password: 'newpass789' });
    check(`重置后新密码登录成功`, nl.status === 200 && nl.body.user.role === 'editor', `实际${nl.status}`);

    const du = await del(`/api/admin/users/${newUid}`, bearerA);
    check(`admin 删除学者(200)`, du.status === 200 && du.body.success, `实际${du.status}`);

    const nl2 = await post('/api/auth/login', { username: cu.body.username, password: 'newpass789' });
    check(`删除后无法登录(401)`, nl2.status === 401, `实际${nl2.status}`);
  }

  console.log('\n✅ ========= 第八步：viewer公开读接口仍可用 =========');
  const pubTests = [
    ['GET /api/entries', get('/api/entries')],
    ['GET /api/entries/1', get('/api/entries/1')],
    ['GET /api/versions/1', get('/api/versions/1')],
    ['GET /api/entries/1/versions', get('/api/entries/1/versions')],
    ['GET /api/versions/1/images', get('/api/versions/1/images')],
    ['GET /api/versions/1/annotations', get('/api/versions/1/annotations')],
    ['GET /api/references/graph', get('/api/references/graph')],
    ['GET /api/entries/1/references', get('/api/entries/1/references')],
  ];
  for (const [name, p] of pubTests) {
    const r = await p;
    check(`${name} 公开可用(200)`, r.status === 200, `实际${r.status}`);
  }

  console.log('');
  console.log('════════════════════════════════════════════════');
  console.log(`✅ 通过: ${ok}    ❌ 失败: ${fail}    总计: ${ok + fail}`);
  console.log('════════════════════════════════════════════════');
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(e => { console.error('测试异常:', e.message); process.exit(1); });

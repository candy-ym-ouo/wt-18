const http = require('http');

function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const body = data ? JSON.stringify(data) : null;
    if (body) headers['Content-Length'] = Buffer.byteLength(body);
    const req = http.request({
      hostname: 'localhost', port: 3001, path, method, headers
    }, (res) => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const str = Buffer.concat(chunks).toString();
        try { resolve({ status: res.statusCode, data: JSON.parse(str) }); }
        catch { resolve({ status: res.statusCode, data: str }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function test() {
  console.log('=== 1. 登录获取 Token ===');
  const login = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
  const token = login.data.token;
  console.log('登录成功:', login.status, token ? 'Token 长度 ' + token.length : '失败');

  console.log('\n=== 2. 创建标签：古典名著 ===');
  const tag1 = await request('POST', '/api/admin/tags',
    { name: '古典名著', color: '#ef4444', description: '中国古典文学名著' }, token);
  console.log(JSON.stringify(tag1.data, null, 2));

  console.log('\n=== 3. 创建标签：世情小说 ===');
  const tag2 = await request('POST', '/api/admin/tags',
    { name: '世情小说', color: '#f59e0b' }, token);
  console.log(JSON.stringify(tag2.data, null, 2));

  console.log('\n=== 4. 批量创建标签 ===');
  const batchTags = await request('POST', '/api/admin/tags/batch',
    { names: ['脂评本', '刻本', '钞本', '清代', '明代'] }, token);
  console.log(JSON.stringify(batchTags.data, null, 2));

  console.log('\n=== 5. 创建一级分类：古典小说 ===');
  const cat1 = await request('POST', '/api/admin/categories',
    { name: '古典小说', slug: 'classic-novels', color: '#10b981', description: '中国古典小说分类' }, token);
  console.log(JSON.stringify(cat1.data, null, 2));

  console.log('\n=== 6. 创建二级分类：四大名著 ===');
  const cat2 = await request('POST', '/api/admin/categories',
    { name: '四大名著', parent_id: cat1.data.id, slug: 'four-great', color: '#059669' }, token);
  console.log(JSON.stringify(cat2.data, null, 2));

  console.log('\n=== 7. 为词条 1 (红楼梦) 添加标签和分类 ===');
  const tagIds = [tag1.data.id, batchTags.data.tags[3].id]; // 古典名著 + 清代
  const catIds = [cat1.data.id, cat2.data.id];
  const updateEntry = await request('PUT', '/api/entries/1',
    { tag_ids: tagIds, category_ids: catIds, primary_category_id: cat2.data.id }, token);
  console.log('更新词条 1:', updateEntry.status, JSON.stringify(updateEntry.data));

  console.log('\n=== 8. 为版本 1 (程甲本) 添加标签 ===');
  const versionTags = [batchTags.data.tags[1].id, batchTags.data.tags[0].id]; // 刻本 + 脂评本
  const updateVersion = await request('PUT', '/api/versions/1',
    { tag_ids: versionTags, category_ids: [cat2.data.id] }, token);
  console.log('更新版本 1:', updateVersion.status, JSON.stringify(updateVersion.data));

  console.log('\n=== 9. 查询词条 1 详情 (检查 tags 和 categories) ===');
  const entryDetail = await request('GET', '/api/entries/1');
  console.log('词条 1 标签数量:', entryDetail.data.tags?.length || 0);
  console.log('词条 1 分类数量:', entryDetail.data.categories?.length || 0);
  if (entryDetail.data.tags?.length) {
    console.log('  标签:', entryDetail.data.tags.map(t => t.name).join(', '));
  }
  if (entryDetail.data.categories?.length) {
    console.log('  分类:', entryDetail.data.categories.map(c => c.name + (c.is_primary ? ' (主)' : '')).join(', '));
  }

  console.log('\n=== 10. 查询版本 1 详情 ===');
  const versionDetail = await request('GET', '/api/versions/1');
  console.log('版本 1 标签数量:', versionDetail.data.tags?.length || 0);
  console.log('版本 1 分类数量:', versionDetail.data.categories?.length || 0);
  if (versionDetail.data.tags?.length) {
    console.log('  标签:', versionDetail.data.tags.map(t => t.name).join(', '));
  }

  console.log('\n=== 11. 按标签筛选词条 (tag_ids = 1) ===');
  const filterByTag = await request('GET', `/api/entries?tag_ids=${tag1.data.id}`);
  console.log('匹配词条数量:', filterByTag.data.total, '列表:', filterByTag.data.list?.length);
  if (filterByTag.data.list?.length) {
    console.log('  结果:', filterByTag.data.list.map(e => e.title).join(', '));
  }

  console.log('\n=== 12. 按分类筛选词条 (category_id = 四大名著 id) ===');
  const filterByCat = await request('GET', `/api/entries?category_id=${cat2.data.id}`);
  console.log('匹配词条数量:', filterByCat.data.total, '列表:', filterByCat.data.list?.length);
  if (filterByCat.data.list?.length) {
    console.log('  结果:', filterByCat.data.list.map(e => e.title).join(', '));
  }

  console.log('\n=== 13. 标签云 ===');
  const cloud = await request('GET', '/api/tags/cloud');
  console.log('标签总数:', cloud.data.tags?.length || 0, '最大使用量:', cloud.data.maxUsage);
  if (cloud.data.tags?.length) {
    console.log('  Top 5:', cloud.data.tags.slice(0, 5).map(t => `${t.name}(${t.usage_count})`).join(', '));
  }

  console.log('\n=== 14. 分类树 (前台) ===');
  const cats = await request('GET', '/api/categories');
  console.log('根分类数量:', cats.data.length);
  if (cats.data.length) {
    for (const c of cats.data) {
      console.log(`  - ${c.name} (entry_count:${c.entry_count}, version_count:${c.version_count})`);
      if (c.children?.length) {
        for (const cc of c.children) console.log(`    - ${cc.name}`);
      }
    }
  }

  console.log('\n=== 15. 后台统计 ===');
  const stats = await request('GET', '/api/admin/stats', null, token);
  console.log('标签总数:', stats.data.tags, '激活:', stats.data.activeTags);
  console.log('分类总数:', stats.data.categories, '激活:', stats.data.activeCategories);
  console.log('词条标签关联:', stats.data.entryTagRelations);
  console.log('版本标签关联:', stats.data.versionTagRelations);
  console.log('词条分类关联:', stats.data.entryCategoryRelations);
  console.log('版本分类关联:', stats.data.versionCategoryRelations);

  console.log('\n=== 16. 标签详情 (古典名著) + 关联词条/版本 ===');
  const tagDetail = await request('GET', `/api/tags/${tag1.data.id}`);
  console.log('标签:', tagDetail.data.name);
  console.log('  关联词条:', tagDetail.data.entryCount);
  if (tagDetail.data.entries?.length) {
    console.log('    ', tagDetail.data.entries.map(e => e.title).join(', '));
  }
  console.log('  关联版本:', tagDetail.data.versionCount);

  console.log('\n=== 17. 分类详情 + 面包屑 ===');
  const catDetail = await request('GET', `/api/categories/${cat2.data.id}`);
  console.log('分类:', catDetail.data.name);
  console.log('  面包屑:', catDetail.data.breadcrumb?.map(b => b.name).join(' > '));
  console.log('  关联词条:', catDetail.data.entryCount);
  if (catDetail.data.entries?.length) {
    console.log('    ', catDetail.data.entries.map(e => e.title).join(', '));
  }

  console.log('\n✅ 所有测试完成！');
}

test().catch(console.error);

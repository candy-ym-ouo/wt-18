const http = require('http');

const BASE = 'http://localhost:3001';
let TOKEN = '';

function request(method, path, body = null, auth = true) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (auth && TOKEN) {
      options.headers['Authorization'] = `Bearer ${TOKEN}`;
    }
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, body: { raw: data } });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const PASS = '✅';
const FAIL = '❌';
let passed = 0;
let failed = 0;

function assert(name, condition, info = '') {
  if (condition) {
    passed++;
    console.log(`  ${PASS} ${name}${info ? ' - ' + info : ''}`);
  } else {
    failed++;
    console.log(`  ${FAIL} ${name}${info ? ' - ' + info : ''}`);
  }
}

async function main() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('    🧪 校勘工作台全链路测试套件');
  console.log('══════════════════════════════════════════════════════\n');

  // ===== Step 0: Health Check =====
  console.log('📋 Step 0: 健康检查');
  try {
    const { status, body } = await request('GET', '/api/health', null, false);
    assert('健康检查返回 200', status === 200);
    assert('状态为 ok', body.status === 'ok');
  } catch (e) {
    console.log('  ❌ 服务未启动，请先启动后端: npm run backend');
    process.exit(1);
  }

  // ===== Step 1: 登录 =====
  console.log('\n📋 Step 1: 登录 (editor01 / editor123)');
  try {
    const { status, body } = await request('POST', '/api/auth/login', {
      username: 'editor01',
      password: 'editor123'
    }, false);
    assert('登录返回 200', status === 200);
    assert('获取到 token', !!body.token, body.token ? body.token.substring(0, 30) + '...' : '无 token');
    TOKEN = body.token || '';
  } catch (e) {
    assert('登录成功', false, e.message);
  }

  if (!TOKEN) {
    console.log('\n❌ 无法继续测试，登录失败');
    process.exit(1);
  }

  // ===== Step 2: 枚举接口 =====
  console.log('\n📋 Step 2: 枚举接口检查');
  try {
    const s1 = await request('GET', '/api/collation/statuses');
    assert('状态枚举 200', s1.status === 200, `返回 ${s1.body.length} 个状态`);
    const s2 = await request('GET', '/api/collation/diff-types');
    assert('差异类型枚举 200', s2.status === 200, `返回 ${s2.body.length} 个类型`);
    const s3 = await request('GET', '/api/collation/conclusion-types');
    assert('结论类型枚举 200', s3.status === 200, `返回 ${s3.body.length} 个类型`);
    const s4 = await request('GET', '/api/collation/conclusion-statuses');
    assert('结论状态枚举 200', s4.status === 200, `返回 ${s4.body.length} 个状态`);
  } catch (e) {
    assert('枚举接口检查', false, e.message);
  }

  // ===== Step 3: 创建校勘任务 =====
  console.log('\n📋 Step 3: 创建校勘任务 - 红楼梦程甲本 vs 程乙本');
  let taskId = null;
  try {
    const { status, body } = await request('POST', '/api/collation', {
      entryId: 1,
      title: '红楼梦·程甲本与程乙本第一回对校',
      description: '校勘范围：第一回全文，重点关注程高本系统的文字差异',
      baseVersionId: 1,
      targetVersionIds: [2]
    });
    assert('创建返回 200', status === 200);
    assert('返回 task id', !!body.id, `ID = ${body.id}`);
    assert('标题正确', body.title === '红楼梦·程甲本与程乙本第一回对校');
    assert('底本正确', body.base_version?.id === 1, body.base_version?.version_name);
    assert('校本数量', body.target_versions?.length === 1, body.target_versions?.map(v => v.version_name).join(','));
    assert('段落被自动拆分', body.paragraph_count > 0, `段落数 = ${body.paragraph_count}`);
    taskId = body.id;
  } catch (e) {
    assert('创建校勘任务', false, e.message);
  }

  if (!taskId) {
    console.log('\n❌ 无法继续，校勘任务创建失败');
    process.exit(1);
  }

  // ===== Step 4: 段落级对读 =====
  console.log('\n📋 Step 4: 段落级对读 (段落接口)');
  let paragraphs = [];
  try {
    const { status, body } = await request('GET', `/api/collation/${taskId}/paragraphs`);
    assert('段落接口 200', status === 200);
    paragraphs = body;
    assert('至少有 1 段', paragraphs.length >= 1, `共 ${paragraphs.length} 段`);
    assert('每段都包含底本', paragraphs.every(p => p.versions && p.versions[1]),
      `第 0 段底本存在: ${!!paragraphs[0]?.versions?.[1]}`);
    assert('每段都包含校本', paragraphs.every(p => p.versions && p.versions[2]),
      `第 0 段校本存在: ${!!paragraphs[0]?.versions?.[2]}`);
    if (paragraphs[0]?.versions?.[1]) {
      const baseLen = paragraphs[0].versions[1].content.length;
      assert('底本内容非空', baseLen > 0, `底本 ${baseLen} 字`);
    }
  } catch (e) {
    assert('段落接口检查', false, e.message);
  }

  // ===== Step 5: 差异标注 - 参数校验测试 =====
  console.log('\n📋 Step 5: 差异标注 - 参数校验 (验证修复)');
  try {
    // 测试: 缺少 paragraphIndex (应该失败)
    const r1 = await request('POST', `/api/collation/${taskId}/diff`, {
      // 故意不提供 paragraphIndex
      diffType: 'character',
      targetVersionId: 2,
      baseText: 'test',
      targetText: 'test'
    });
    assert('缺少 paragraphIndex → 400', r1.status === 400,
      `实际: ${r1.status} - ${r1.body.error || r1.body.code || ''}`);
    assert('错误码为 MISSING_PARAMS', r1.body.code === 'MISSING_PARAMS');

    // 测试: 缺少 diffType
    const r2 = await request('POST', `/api/collation/${taskId}/diff`, {
      paragraphIndex: 0,
      targetVersionId: 2
    });
    assert('缺少 diffType → 400', r2.status === 400);

    // 测试: 缺少 targetVersionId
    const r3 = await request('POST', `/api/collation/${taskId}/diff`, {
      paragraphIndex: 0,
      diffType: 'character'
    });
    assert('缺少 targetVersionId → 400', r3.status === 400);

    // 测试: 无效 diffType
    const r4 = await request('POST', `/api/collation/${taskId}/diff`, {
      paragraphIndex: 0,
      diffType: 'invalid_type_xyz',
      targetVersionId: 2
    });
    assert('无效 diffType → 400', r4.status === 400);
    assert('错误码为 INVALID_DIFF_TYPE', r4.body.code === 'INVALID_DIFF_TYPE');

    console.log('  ✨ 参数校验修复验证通过 ✨');
  } catch (e) {
    assert('参数校验测试', false, e.message);
  }

  // ===== Step 6: 创建差异标注 =====
  console.log('\n📋 Step 6: 创建差异标注 - 程甲本"通灵"引号 vs 程乙本无引号');
  let diffId1 = null;
  let diffId2 = null;
  try {
    const d1 = await request('POST', `/api/collation/${taskId}/diff`, {
      paragraphIndex: 0,
      diffType: 'punctuation',
      targetVersionId: 2,
      baseText: '"通灵"',
      targetText: '通灵',
      note: '程甲本保留双引号，程乙本删去引号。此为程高整理时统一标点之例。'
    });
    assert('差异1创建 200', d1.status === 200, `ID=${d1.body.id}`);
    assert('差异1类型正确', d1.body.diff_type === 'punctuation');
    assert('差异1底本原文', d1.body.base_text === '"通灵"');
    diffId1 = d1.body.id;

    const d2 = await request('POST', `/api/collation/${taskId}/diff`, {
      paragraphIndex: 0,
      diffType: 'wording',
      targetVersionId: 2,
      baseText: '《石头记》',
      targetText: '石头记',
      note: '程甲本书名加书名号，程乙本改从简。'
    });
    assert('差异2创建 200', d2.status === 200, `ID=${d2.body.id}`);
    assert('差异2类型正确', d2.body.diff_type === 'wording');
    diffId2 = d2.body.id;

    const list = await request('GET', `/api/collation/${taskId}/diffs`);
    assert('差异列表 200', list.status === 200);
    assert('差异列表数量', list.body.length >= 2, `共 ${list.body.length} 条差异`);
  } catch (e) {
    assert('创建差异标注', false, e.message);
  }

  // ===== Step 7: 校勘结论沉淀 =====
  console.log('\n📋 Step 7: 校勘结论沉淀');
  let concId1 = null;
  let concId2 = null;
  try {
    const c1 = await request('POST', `/api/collation/${taskId}/conclusion`, {
      paragraphIndex: 0,
      diffId: diffId1,
      conclusionType: 'accept_base',
      content: '此处保留底本引号。程甲本为最早活字排印本，其标点更接近整理时原貌，有版本学价值。',
      evidence: '参见一粟《红楼梦书录》，程甲本系统各本均保留此引号，删引号为程乙本统一改笔。',
      finalText: '"通灵"'
    });
    assert('结论1创建 200', c1.status === 200, `ID=${c1.body.id}`);
    assert('结论1类型正确', c1.body.conclusion_type === 'accept_base');
    assert('结论1初始状态 pending', c1.body.status === 'pending');
    concId1 = c1.body.id;

    const c2 = await request('POST', `/api/collation/${taskId}/conclusion`, {
      paragraphIndex: 0,
      diffId: diffId2,
      conclusionType: 'needs_research',
      content: '书名号使用问题待进一步考证。不同版本对标点符号的处理需结合更多钞本系统研究。',
      evidence: '庚辰本、甲戌本均无书名号（因钞本不加标点），此为程高整理时所加。'
    });
    assert('结论2创建 200', c2.status === 200, `ID=${c2.body.id}`);
    assert('结论2类型正确', c2.body.conclusion_type === 'needs_research');
    concId2 = c2.body.id;

    const list = await request('GET', `/api/collation/${taskId}/conclusions`);
    assert('结论列表 200', list.status === 200);
    assert('结论列表数量', list.body.length >= 2, `共 ${list.body.length} 条结论`);
  } catch (e) {
    assert('校勘结论沉淀', false, e.message);
  }

  // ===== Step 8: 结论审核流程 =====
  console.log('\n📋 Step 8: 结论审核流程 (任务流转)');
  try {
    const r1 = await request('POST', `/api/collation/${taskId}/conclusion/${concId1}/review`, {
      status: 'approved',
      reviewerNote: '同意此意见，程甲本引号保留确有版本学意义。'
    });
    assert('结论1审核通过 200', r1.status === 200);
    assert('结论1状态变为 approved', r1.body.status === 'approved');
    assert('审核备注保存', r1.body.reviewer_note && r1.body.reviewer_note.length > 0);
    assert('审核人保存', !!r1.body.reviewer_id);

    const r2 = await request('POST', `/api/collation/${taskId}/conclusion/${concId2}/review`, {
      status: 'reviewed',
      reviewerNote: '待考之说成立，建议补充更多版本比勘后再定。'
    });
    assert('结论2已审阅 200', r2.status === 200);
    assert('结论2状态变为 reviewed', r2.body.status === 'reviewed');
  } catch (e) {
    assert('结论审核流程', false, e.message);
  }

  // ===== Step 9: 校勘任务状态流转 =====
  console.log('\n📋 Step 9: 校勘任务状态流转');
  try {
    const states = ['in_progress', 'review', 'done'];
    for (const s of states) {
      const r = await request('PATCH', `/api/collation/${taskId}/status`, { status: s });
      assert(`流转到 ${s}`, r.status === 200 && r.body.status === s,
        `当前状态: ${r.body.status}`);
    }

    const detail = await request('GET', `/api/collation/${taskId}`);
    assert('最终状态为 done', detail.body.status === 'done');
    assert('统计-差异数', detail.body.diff_count >= 2, `diff_count=${detail.body.diff_count}`);
    assert('统计-结论数', detail.body.conclusion_count >= 2, `conclusion_count=${detail.body.conclusion_count}`);
  } catch (e) {
    assert('任务状态流转', false, e.message);
  }

  // ===== Step 10: 版本详情 - 校勘结果回写 =====
  console.log('\n📋 Step 10: 版本详情校勘结果回写 (验证修复)');
  try {
    // 查底本 (v1=程甲本) 的校勘结果
    const r1 = await request('GET', '/api/versions/1/collation-results');
    assert('底本程甲本校勘结果 200', r1.status === 200);
    assert('底本程甲本有校勘记录', r1.body.length >= 1, `共 ${r1.body.length} 条`);

    if (r1.body.length >= 1) {
      const result = r1.body[0];
      assert('包含 task 详情', !!result.task && !!result.task.id);
      assert('包含差异 diffs', Array.isArray(result.diffs));
      assert('包含结论 conclusions', Array.isArray(result.conclusions));
      assert('差异数 >= 2', result.diffs.length >= 2, `diffs=${result.diffs.length}`);
      assert('结论数 >= 2', result.conclusions.length >= 2, `conclusions=${result.conclusions.length}`);
      console.log(`  🎯 程甲本回写: ${result.diffs.length} 差异 + ${result.conclusions.length} 结论`);
    }

    // 查校本 (v2=程乙本) 的校勘结果
    const r2 = await request('GET', '/api/versions/2/collation-results');
    assert('校本程乙本校勘结果 200', r2.status === 200);
    assert('校本程乙本有校勘记录', r2.body.length >= 1, `共 ${r2.body.length} 条`);

    if (r2.body.length >= 1) {
      const result = r2.body[0];
      assert('程乙本也能看到差异', result.diffs.length >= 1, `diffs=${result.diffs.length}`);
      console.log(`  🎯 程乙本回写: ${result.diffs.length} 差异 + ${result.conclusions.length} 结论`);
    }

    // 查不相关版本 (v3=庚辰本, entry=石头记)
    const r3 = await request('GET', '/api/versions/3/collation-results');
    assert('庚辰本无此校勘记录 (不泄漏)', r3.status === 200);
    assert('庚辰本结果为 0 或不包含红楼梦任务',
      !r3.body.some(x => x.task?.entry_id === 1),
      `庚辰本结果数: ${r3.body.length}`);

    console.log('  ✨ 版本详情回写修复验证通过 ✨');
  } catch (e) {
    assert('校勘结果回写', false, e.message);
  }

  // ===== Step 11: 校勘列表 =====
  console.log('\n📋 Step 11: 校勘任务列表和筛选');
  try {
    const all = await request('GET', '/api/collation');
    assert('校勘列表 200', all.status === 200);
    assert('包含我们创建的任务', all.body.some(t => t.id === taskId),
      `列表长度: ${all.body.length}`);

    const filtered = await request('GET', '/api/collation?status=done');
    assert('按状态筛选有效', filtered.body.every(t => t.status === 'done'),
      `筛选后: ${filtered.body.length} 条 done 任务`);

    const byEntry = await request('GET', '/api/collation?entryId=1');
    assert('按词条筛选有效', byEntry.body.every(t => t.entry_id === 1),
      `筛选后: ${byEntry.body.length} 条 entry=1 任务`);
  } catch (e) {
    assert('校勘列表筛选', false, e.message);
  }

  // ===== 总结 =====
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  🏁 测试结束');
  console.log(`     ✅ 通过: ${passed}`);
  console.log(`     ❌ 失败: ${failed}`);
  console.log(`     📊 通过率: ${Math.round(passed / (passed + failed) * 100)}%`);
  console.log('══════════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('测试异常:', e);
  process.exit(1);
});

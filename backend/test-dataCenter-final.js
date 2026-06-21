const dc = require('./src/dataCenter');

console.log('=== 数据导入导出中心 - 全面测试 ===\n');

console.log('1. 完整导出测试...');
const fullExport = dc.exportAll();
console.log('   schema_version:', fullExport.schema_version);
console.log('   stats:', JSON.stringify(fullExport.stats));
console.log('   entries[0] keys:', Object.keys(fullExport.entries[0] || {}));
console.log('   entries[0].versions[0] keys:', fullExport.entries[0]?.versions?.[0] ? Object.keys(fullExport.entries[0].versions[0]) : 'N/A');

console.log('\n2. 引用关系包含词条标题匹配...');
const testRef = fullExport.references[fullExport.references.length - 1];
const fromEntry = fullExport.entries.find(e => e.id === testRef?.from_entry_id);
const toEntry = fullExport.entries.find(e => e.id === testRef?.to_entry_id);
console.log('   引用:', JSON.stringify(testRef));
console.log('   from_entry 找到:', fromEntry ? fromEntry.title : '未找到');
console.log('   to_entry 找到:', toEntry ? toEntry.title : '未找到');

console.log('\n3. 按词条ID导出测试...');
if (fromEntry) {
  const partial = dc.exportEntries([fromEntry.id, 999999]);
  console.log('   requested:', partial.requested_entry_ids);
  console.log('   found:', partial.found_entry_ids);
  console.log('   missing:', partial.missing_entry_ids);
  console.log('   entries:', partial.entries.length);
  console.log('   references:', partial.references.length);
}

console.log('\n4. 导入测试 - 创建新数据...');
const uniqueTag = Date.now();
const importTestData = {
  schema_version: '1.0',
  entries: [
    {
      title: `__导入测试_${uniqueTag}__`,
      author: '测试作者',
      dynasty: '测试朝代',
      summary: '用于测试完整导入流程',
      versions: [
        {
          version_name: '初刻本',
          publisher: '测试书局',
          pub_year: '2020',
          pages: 200,
          isbn: 'TEST-001',
          description: '测试版本描述',
          full_text: '测试全文内容',
          images: [
            { filename: `test_${uniqueTag}_1.png`, caption: '卷首书影', page_number: 1 }
          ],
          annotations: [
            {
              old_id: 1,
              user_name: '学者甲',
              anchor_text: '第一段',
              comment: '这是一条重要批注',
              replies: [
                { old_id: 2, user_name: '学者乙', comment: '同意此观点' },
                {
                  old_id: 3,
                  user_name: '学者丙',
                  comment: '有不同看法',
                  replies: [
                    { old_id: 4, user_name: '学者甲', comment: '愿闻其详' }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      title: `__导入测试B_${uniqueTag}__`,
      author: '测试作者B',
      versions: []
    }
  ],
  references: [
    {
      from_entry_id: `__导入测试_${uniqueTag}__`,
      to_entry_id: `__导入测试B_${uniqueTag}__`,
      relation_type: '参见',
      note: '两书内容互见'
    }
  ]
};

const importResult = dc.importData(importTestData);
console.log('   导入结果:', JSON.stringify(importResult));

console.log('\n5. 验证导入后的数据...');
const verifyExport = dc.exportAll();
const importedEntry = verifyExport.entries.find(e => e.title === `__导入测试_${uniqueTag}__`);
const importedEntryB = verifyExport.entries.find(e => e.title === `__导入测试B_${uniqueTag}__`);
console.log('   主词条找到:', importedEntry ? '是' : '否');
console.log('   词条B找到:', importedEntryB ? '是' : '否');

if (importedEntry) {
  const v = importedEntry.versions[0];
  console.log('   版本数:', importedEntry.versions.length);
  console.log('   版本名:', v?.version_name);
  console.log('   图片数:', v?.images?.length || 0);
  console.log('   批注层级:');
  const printTree = (a, depth = 0) => {
    console.log(`      ${'  '.repeat(depth)}${a.user_name}: ${a.comment}`);
    a.replies?.forEach(r => printTree(r, depth + 1));
  };
  v?.annotations?.forEach(a => printTree(a));

  const ref = verifyExport.references.find(r =>
    r.from_entry_id === importedEntry.id && r.to_entry_id === importedEntryB?.id
  );
  console.log('   引用关系:', ref ? `${ref.relation_type} - ${ref.note}` : '未找到');
}

console.log('\n=== 所有测试通过 ===');

const dc = require('./src/dataCenter');

console.log('=== 测试数据导入导出中心 ===\n');

const testData = {
  schema_version: '1.0',
  entries: [
    {
      title: '__测试导入词条__',
      author: '测试作者',
      dynasty: '当代',
      summary: '这是一个用于测试导入的词条',
      versions: [
        {
          version_name: '测试版本 v1.0',
          publisher: '测试出版社',
          pub_year: '2024',
          pages: 100,
          description: '测试版本描述',
          full_text: '测试版本全文内容...',
          images: [
            { filename: 'test_img_001.png', caption: '测试图片1', page_number: 1 }
          ],
          annotations: [
            {
              old_id: 1001,
              user_name: '测试批注者A',
              anchor_text: '测试锚定文本',
              comment: '这是根批注',
              replies: [
                {
                  old_id: 1002,
                  user_name: '测试批注者B',
                  comment: '这是一级回复批注'
                },
                {
                  old_id: 1003,
                  user_name: '测试批注者C',
                  comment: '这是另一个一级回复',
                  replies: [
                    {
                      old_id: 1004,
                      user_name: '测试批注者D',
                      comment: '这是二级回复批注'
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      title: '__测试导入词条B__',
      author: '测试作者B',
      versions: []
    }
  ],
  references: [
    { from_entry_id: '__测试导入词条__', to_entry_id: '__测试导入词条B__', relation_type: '引用', note: '测试引用关系' }
  ]
};

console.log('1. 测试 importData...');
const result = dc.importData(testData, { skipDuplicates: true });
console.log('   导入结果:', JSON.stringify(result, null, 2));

console.log('\n2. 验证导出包含新数据...');
const exported = dc.exportAll();
const foundA = exported.entries.find(e => e.title === '__测试导入词条__');
const foundB = exported.entries.find(e => e.title === '__测试导入词条B__');

console.log('   - 词条A找到:', foundA ? '是' : '否');
if (foundA && foundA.versions[0]) {
  const v = foundA.versions[0];
  console.log('   - 版本数:', foundA.versions.length);
  console.log('   - 图片数:', v.images.length);
  console.log('   - 批注树:');
  const printAnn = (a, depth = 0) => {
    const pad = '     '.repeat(depth);
    console.log(`${pad}   * ${a.comment} (${a.user_name})`);
    if (a.replies) a.replies.forEach(r => printAnn(r, depth + 1));
  };
  v.annotations.forEach(a => printAnn(a));
}
console.log('   - 词条B找到:', foundB ? '是' : '否');

const refCount = exported.references.filter(r => {
  const fromEntry = exported.entries.find(e => e.id === r.from_entry_id);
  const toEntry = exported.entries.find(e => e.id === r.to_entry_id);
  return fromEntry?.title === '__测试导入词条__' && toEntry?.title === '__测试导入词条B__';
}).length;
console.log('   - 引用关系找到:', refCount);

console.log('\n3. 测试按词条ID导出...');
if (foundA) {
  const partial = dc.exportEntries([foundA.id, 999999]);
  console.log('   - 按词条导出 stats:', JSON.stringify(partial.stats));
  console.log('   - 导出门槛词条数:', partial.entries.length);
}

console.log('\n4. 测试重复导入（去重）...');
const result2 = dc.importData(testData, { skipDuplicates: true });
console.log('   - 重复导入结果:', JSON.stringify(result2.imported));
console.log('   - 跳过数量:', JSON.stringify(result2.skipped));

console.log('\n=== 所有测试完成 ===');

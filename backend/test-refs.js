const { db } = require('./src/db');
const dc = require('./src/dataCenter');

console.log('=== 验证引用关系 ===\n');

// 先看看所有词条
const allEntries = db.prepare('SELECT id, title FROM entries ORDER BY id DESC LIMIT 10').all();
console.log('最近的词条:');
allEntries.forEach(e => console.log(`  ${e.id}: ${e.title}`));

// 看看所有引用
const allRefs = db.prepare('SELECT * FROM refs ORDER BY id DESC LIMIT 10').all();
console.log('\n最近的引用:');
allRefs.forEach(r => console.log(`  ${r.id}: from=${r.from_entry_id}, to=${r.to_entry_id}, type=${r.relation_type}`));

// 找测试词条
const testEntryA = db.prepare("SELECT id, title FROM entries WHERE title = ?").get('__测试导入词条__');
const testEntryB = db.prepare("SELECT id, title FROM entries WHERE title = ?").get('__测试导入词条B__');
console.log('\n测试词条:');
console.log('  A:', testEntryA);
console.log('  B:', testEntryB);

if (testEntryA && testEntryB) {
  const refs = db.prepare('SELECT * FROM refs WHERE from_entry_id = ? AND to_entry_id = ?').all(testEntryA.id, testEntryB.id);
  console.log('\nA -> B 的引用:', refs);
}

// 测试完整导出
const exported = dc.exportAll();
console.log('\nexported.references 长度:', exported.references.length);
console.log('最后 3 个 references:', exported.references.slice(-3));

// 检查按词条导出
if (testEntryA) {
  console.log('\n按词条ID导出测试:');
  const partial = dc.exportEntries([testEntryA.id, 999999]);
  console.log('  requested:', partial.requested_entry_ids);
  console.log('  found:', partial.found_entry_ids);
  console.log('  missing:', partial.missing_entry_ids);
  console.log('  entries:', partial.entries.length);
}

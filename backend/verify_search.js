const fs = require('fs');

function verifyOrder(filepath, label, field, expectAsc) {
  const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  const items = data.results;
  let pass = true;
  let firstBreak = null;

  for (let i = 1; i < items.length; i++) {
    const a = items[i - 1][field] || '';
    const b = items[i][field] || '';
    const cmp = a.localeCompare(b, 'zh-Hans-CN');
    const ok = expectAsc ? cmp <= 0 : cmp >= 0;
    if (!ok && !firstBreak) {
      firstBreak = { i, a, b, typeA: items[i-1].type, typeB: items[i].type };
      pass = false;
    }
  }

  if (pass) {
    console.log('PASS: ' + label + ' (' + items.length + ' results)');
  } else {
    console.log('FAIL: ' + label);
    console.log('  item ' + (firstBreak.i-1) + ' [' + firstBreak.typeA + '] ' + field + '="' + firstBreak.a + '"');
    console.log('  item ' + firstBreak.i + ' [' + firstBreak.typeB + '] ' + field + '="' + firstBreak.b + '"');
  }

  console.log('  first 3:');
  items.slice(0, 3).forEach(function(r) { console.log('    [' + r.type + '] ' + field + '="' + (r[field]||'').slice(0,25) + '"'); });
  console.log('  last 3:');
  items.slice(-3).forEach(function(r) { console.log('    [' + r.type + '] ' + field + '="' + (r[field]||'').slice(0,25) + '"'); });
  console.log();
  return pass;
}

var allPass = true;
allPass = allPass && verifyOrder('/tmp/s_asc.json', 'created_at ASC', 'created_at', true);
allPass = allPass && verifyOrder('/tmp/s_desc.json', 'created_at DESC', 'created_at', false);
allPass = allPass && verifyOrder('/tmp/s_title_asc.json', 'title ASC', 'title', true);
allPass = allPass && verifyOrder('/tmp/s_title_desc.json', 'title DESC', 'title', false);

console.log(allPass ? 'ALL PASSED' : 'SOME FAILED');

const db = require('./db');
const path = require('path');
const fs = require('fs');

function seed() {
  console.log('🌱 开始填充演示数据...');

  db.exec('DELETE FROM refs; DELETE FROM annotations; DELETE FROM images; DELETE FROM versions; DELETE FROM entries; DELETE FROM users;');

  const insertEntry = db.prepare(`
    INSERT INTO entries (title, author, dynasty, summary, cover_url) VALUES (?, ?, ?, ?, ?)
  `);
  const insertVersion = db.prepare(`
    INSERT INTO versions (entry_id, version_name, publisher, pub_year, pages, isbn, description, full_text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertImage = db.prepare(`
    INSERT INTO images (version_id, filename, caption, page_number) VALUES (?, ?, ?, ?)
  `);
  const insertAnnotation = db.prepare(`
    INSERT INTO annotations (version_id, user_name, anchor_text, comment, parent_id) VALUES (?, ?, ?, ?, ?)
  `);
  const insertRef = db.prepare(`
    INSERT INTO refs (from_entry_id, to_entry_id, relation_type, note) VALUES (?, ?, ?, ?)
  `);
  const insertUser = db.prepare(`INSERT INTO users (username, role) VALUES (?, ?)`);

  insertUser.run('admin', 'admin');
  insertUser.run('editor01', 'editor');

  const e1 = insertEntry.run(
    '红楼梦',
    '曹雪芹 / 高鹗',
    '清代',
    '中国古典四大名著之首，原名《石头记》，以贾、史、王、薛四大家族的兴衰为背景，以贾宝玉与林黛玉、薛宝钗的爱情婚姻悲剧为主线。',
    'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=300'
  ).lastInsertRowid;

  const e2 = insertEntry.run(
    '石头记',
    '曹雪芹',
    '清代',
    '《红楼梦》早期钞本系统的总称，因题名不同而与后世刊本形成版本差异，现存脂评本系统十余种。',
    'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300'
  ).lastInsertRowid;

  const e3 = insertEntry.run(
    '金瓶梅',
    '兰陵笑笑生',
    '明代',
    '明代长篇世情小说，是中国文学史上第一部由文人独立创作的长篇小说，对《红楼梦》创作影响深远。',
    'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=300'
  ).lastInsertRowid;

  const v1 = insertVersion.run(
    e1, '程甲本', '萃文书屋', '1791', 120, '',
    '乾隆五十六年（1791）程伟元、高鹗整理刊刻，首次以活字排印一百二十回本。',
    '第一回 甄士隐梦幻识通灵 贾雨村风尘怀闺秀\n\n此开卷第一回也。作者自云：因曾历过一番梦幻之后，故将真事隐去，而借"通灵"之说，撰此《石头记》一书也。故曰"甄士隐"云云。但书中所记何事何人？自又云："今风尘碌碌，一事无成，忽念及当日所有之女子，一一细考较去，觉其行止见识，皆出于我之上。何我堂堂须眉，诚不若彼裙钗哉？实愧则有余，悔又无益之大无可如何之日也！"'
  ).lastInsertRowid;

  const v2 = insertVersion.run(
    e1, '程乙本', '萃文书屋', '1792', 120, '',
    '乾隆五十七年（1792）再度修订排印，对程甲本作了大量增删修改，是后世通行一百二十回本的底本。',
    '第一回 甄士隐梦幻识通灵 贾雨村风尘怀闺秀\n\n此开卷第一回也。作者自云：因曾历过一番梦幻之后，故将真事隐去，而借通灵之说，撰此石头记一书也。故曰甄士隐云云。但书中所记何事何人？自又云：今风尘碌碌，一事无成，忽念及当日所有之女子，一一细考较去，觉其行止见识，皆出于我之上。何我堂堂须眉，诚不若彼裙钗哉？实愧则有余，悔又无益之大无可如何之日也！'
  ).lastInsertRowid;

  const v3 = insertVersion.run(
    e2, '庚辰本', '', '1760', 78, '',
    '庚辰秋月定本，存七十八回，是脂评本中回数最多、最完整的一种，现藏北京大学图书馆。',
    '第一回 甄士隐梦幻识通灵 贾雨村风尘怀闺秀\n\n【列位看官：你道此书从何而来？说起根由虽近荒唐，细按则深有趣味。待在下将此来历注明，方使阅者了然不惑。】\n\n原来女娲氏炼石补天之时，于大荒山无稽崖炼成高经十二丈、方经二十四丈顽石三万六千五百零一块。娲皇氏只用了三万六千五百块，只单单剩了一块未用，便弃在此山青埂峰下。'
  ).lastInsertRowid;

  const v4 = insertVersion.run(
    e2, '甲戌本', '', '1754', 16, '',
    '甲戌抄阅再评本，仅存十六回（一至八、十三至十六、二十五至二十八），但保存了大量脂砚斋批语。',
    '第一回 甄士隐梦幻识通灵 贾雨村风尘怀闺秀\n\n列位看官：你道此书从何而来？说起根由虽近荒唐，细谙则深有趣味。待在下将此来历注明，方使阅者了然不惑。\n\n原来女娲氏炼石补天之时，于大荒山无稽崖练成高经十二丈、方经二十四丈顽石三万六千五百零一块。'
  ).lastInsertRowid;

  const v5 = insertVersion.run(
    e3, '万历丁巳本', '', '1617', 100, '',
    '万历四十五年（1617）东吴弄珠客序刊本，是现存最早的刻本。',
    '第一回 西门庆热结十弟兄 武二郎冷遇亲哥嫂\n\n诗曰：二八佳人体似酥，腰间仗剑斩愚夫。虽然不见人头落，暗里教君骨髓枯。'
  ).lastInsertRowid;

  insertImage.run(v3, 'sample-1.jpg', '庚辰本第一回书影', 1);
  insertImage.run(v3, 'sample-2.jpg', '庚辰本脂批书影', 10);
  insertImage.run(v4, 'sample-3.jpg', '甲戌本凡例首页', 1);
  insertImage.run(v1, 'sample-4.jpg', '程甲本卷首插图', 1);
  insertImage.run(v5, 'sample-5.jpg', '万历本西门庆画像', 3);

  insertAnnotation.run(v3, '红学爱好者', '女娲氏炼石补天', '补天神话是全书的隐喻框架，顽石被弃象征作者的"无材补天"之叹。', null);
  insertAnnotation.run(v3, '考据派A', '庚辰秋月定本', '庚辰年即乾隆二十五年（1760），曹雪芹尚在世，此本可能接近作者最后手定之稿。', null);
  insertAnnotation.run(v4, '脂批研究者', '甲戌抄阅再评', '甲戌本多出的"凡例"部分极为珍贵，是理解作者创作主旨的第一手材料。', null);
  insertAnnotation.run(v1, '版本学者', '程甲本', '程伟元序中称"爰为竭力搜罗，自藏书家甚至故纸堆中无不留心"，可见程高整理确实做了一番辑佚工作。', null);
  insertAnnotation.run(v5, '小说史研究者', '二八佳人体似酥', '此诗引自吕岩《警世》，体现了明代"三教合一"背景下的劝诫主题。', null);

  insertRef.run(e1, e2, '异名', '程高本将《石头记》改名为《红楼梦》');
  insertRef.run(e1, e3, '承袭', '《红楼梦》在人物设置、叙事手法上深受《金瓶梅》影响');
  insertRef.run(e2, e3, '承袭', '脂批中多次将《石头记》与《金瓶梅》对读');

  console.log('✅ 演示数据填充完成！');
  console.log(`   - 词条：${db.prepare('SELECT COUNT(*) FROM entries').get()['COUNT(*)']} 条`);
  console.log(`   - 版本：${db.prepare('SELECT COUNT(*) FROM versions').get()['COUNT(*)']} 个`);
  console.log(`   - 图片：${db.prepare('SELECT COUNT(*) FROM images').get()['COUNT(*)']} 张`);
  console.log(`   - 批注：${db.prepare('SELECT COUNT(*) FROM annotations').get()['COUNT(*)']} 条`);
  console.log(`   - 引用：${db.prepare('SELECT COUNT(*) FROM refs').get()['COUNT(*)']} 条`);
}

seed();

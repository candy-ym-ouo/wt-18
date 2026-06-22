const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data', 'oldbook.db');
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const ROLES = {
  ADMIN: 'admin',
  EDITOR: 'editor',
  VIEWER: 'viewer'
};

const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: ['*'],
  [ROLES.EDITOR]: ['entries:read', 'entries:write', 'versions:read', 'versions:write', 'images:read', 'images:write', 'annotations:read', 'annotations:write', 'references:read', 'references:write', 'tasks:read', 'tasks:write', 'tasks:assign', 'tasks:comment', 'topics:read', 'topics:write', 'chapters:read', 'chapters:write', 'submissions:read', 'submissions:review', 'collation:read', 'collation:write', 'collation:conclude', 'collation:review', 'bibliography:read', 'bibliography:write', 'revisions:read', 'revisions:rollback', 'tags:read', 'tags:write', 'categories:read', 'categories:write'],
  [ROLES.VIEWER]: ['entries:read', 'versions:read', 'images:read', 'annotations:read', 'references:read', 'tasks:read', 'tasks:comment', 'topics:read', 'chapters:read', 'submissions:create', 'collation:read', 'bibliography:read', 'revisions:read', 'tags:read', 'categories:read']
};

const ROLE_HIERARCHY = {
  [ROLES.ADMIN]: 3,
  [ROLES.EDITOR]: 2,
  [ROLES.VIEWER]: 1
};

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT,
      dynasty TEXT,
      summary TEXT,
      cover_url TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL,
      version_name TEXT NOT NULL,
      publisher TEXT,
      pub_year TEXT,
      pages INTEGER,
      isbn TEXT,
      description TEXT,
      full_text TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      caption TEXT,
      page_number INTEGER,
      uploaded_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (version_id) REFERENCES versions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS annotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version_id INTEGER NOT NULL,
      user_name TEXT DEFAULT '匿名学者',
      anchor_text TEXT,
      comment TEXT NOT NULL,
      parent_id INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (version_id) REFERENCES versions(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES annotations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS refs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_entry_id INTEGER NOT NULL,
      to_entry_id INTEGER NOT NULL,
      relation_type TEXT NOT NULL,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (from_entry_id) REFERENCES entries(id) ON DELETE CASCADE,
      FOREIGN KEY (to_entry_id) REFERENCES entries(id) ON DELETE CASCADE,
      UNIQUE(from_entry_id, to_entry_id, relation_type)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT,
      display_name TEXT,
      role TEXT NOT NULL DEFAULT '${ROLES.VIEWER}',
      status TEXT NOT NULL DEFAULT 'active',
      last_login_at TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'todo',
      priority TEXT NOT NULL DEFAULT 'medium',
      entry_id INTEGER,
      version_id INTEGER,
      creator_id INTEGER NOT NULL,
      due_date TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE SET NULL,
      FOREIGN KEY (version_id) REFERENCES versions(id) ON DELETE SET NULL,
      FOREIGN KEY (creator_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS task_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      assigned_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(task_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS task_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      subtitle TEXT,
      author TEXT,
      summary TEXT,
      cover_url TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      sort_order INTEGER DEFAULT 0,
      creator_id INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS chapters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      content TEXT,
      sort_order INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS topic_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER,
      chapter_id INTEGER,
      entry_id INTEGER NOT NULL,
      note TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
      FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS version_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER,
      entry_title TEXT,
      entry_author TEXT,
      version_name TEXT NOT NULL,
      publisher TEXT,
      pub_year TEXT,
      pages INTEGER,
      isbn TEXT,
      description TEXT,
      submitter_name TEXT NOT NULL,
      submitter_contact TEXT,
      submitter_note TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      review_note TEXT,
      reviewer_id INTEGER,
      reviewed_at TEXT,
      approved_version_id INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE SET NULL,
      FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (approved_version_id) REFERENCES versions(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS version_submission_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      caption TEXT,
      uploaded_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (submission_id) REFERENCES version_submissions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS collation_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER,
      entry_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      base_version_id INTEGER NOT NULL,
      target_version_ids TEXT NOT NULL,
      creator_id INTEGER NOT NULL,
      reviewer_id INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
      FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
      FOREIGN KEY (base_version_id) REFERENCES versions(id) ON DELETE CASCADE,
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS collation_paragraphs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collation_task_id INTEGER NOT NULL,
      version_id INTEGER NOT NULL,
      paragraph_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (collation_task_id) REFERENCES collation_tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (version_id) REFERENCES versions(id) ON DELETE CASCADE,
      UNIQUE(collation_task_id, version_id, paragraph_index)
    );

    CREATE TABLE IF NOT EXISTS collation_diffs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collation_task_id INTEGER NOT NULL,
      paragraph_index INTEGER NOT NULL,
      diff_type TEXT NOT NULL,
      base_text TEXT,
      target_version_id INTEGER NOT NULL,
      target_text TEXT,
      start_pos INTEGER,
      end_pos INTEGER,
      note TEXT,
      creator_id INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (collation_task_id) REFERENCES collation_tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (target_version_id) REFERENCES versions(id) ON DELETE CASCADE,
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS collation_conclusions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collation_task_id INTEGER NOT NULL,
      diff_id INTEGER,
      paragraph_index INTEGER,
      conclusion_type TEXT NOT NULL,
      content TEXT NOT NULL,
      evidence TEXT,
      final_text TEXT,
      reviewer_note TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      creator_id INTEGER,
      reviewer_id INTEGER,
      reviewed_at TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (collation_task_id) REFERENCES collation_tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (diff_id) REFERENCES collation_diffs(id) ON DELETE SET NULL,
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS bibliography (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bib_type TEXT NOT NULL CHECK (bib_type IN ('paper', 'journal', 'catalog', 'holding')),
      title TEXT NOT NULL,
      author TEXT,
      publisher TEXT,
      pub_year TEXT,
      pub_place TEXT,
      edition TEXT,
      volume TEXT,
      issue TEXT,
      pages TEXT,
      isbn TEXT,
      issn TEXT,
      doi TEXT,
      url TEXT,
      language TEXT,
      keywords TEXT,
      summary TEXT,
      full_text TEXT,
      call_number TEXT,
      location TEXT,
      access_status TEXT DEFAULT 'public',
      status TEXT DEFAULT 'active',
      creator_id INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS bibliography_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bibliography_id INTEGER NOT NULL,
      entry_id INTEGER NOT NULL,
      relation_type TEXT NOT NULL DEFAULT 'cites',
      note TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (bibliography_id) REFERENCES bibliography(id) ON DELETE CASCADE,
      FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
      UNIQUE(bibliography_id, entry_id, relation_type)
    );

    CREATE TABLE IF NOT EXISTS bibliography_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bibliography_id INTEGER NOT NULL,
      version_id INTEGER NOT NULL,
      relation_type TEXT NOT NULL DEFAULT 'cites',
      note TEXT,
      page_ref TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (bibliography_id) REFERENCES bibliography(id) ON DELETE CASCADE,
      FOREIGN KEY (version_id) REFERENCES versions(id) ON DELETE CASCADE,
      UNIQUE(bibliography_id, version_id, relation_type)
    );

    CREATE TABLE IF NOT EXISTS bibliography_refs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_bib_id INTEGER NOT NULL,
      to_bib_id INTEGER NOT NULL,
      relation_type TEXT NOT NULL DEFAULT 'cites',
      note TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (from_bib_id) REFERENCES bibliography(id) ON DELETE CASCADE,
      FOREIGN KEY (to_bib_id) REFERENCES bibliography(id) ON DELETE CASCADE,
      UNIQUE(from_bib_id, to_bib_id, relation_type)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      sender_id INTEGER,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      ref_type TEXT,
      ref_id INTEGER,
      extra_data TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      read_at TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS system_announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'normal',
      target_role TEXT,
      creator_id INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS revision_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      change_summary TEXT,
      user_id INTEGER,
      user_display_name TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_revision_history_entity ON revision_history(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_revision_history_user ON revision_history(user_id);

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE,
      color TEXT DEFAULT '#6366f1',
      description TEXT,
      usage_count INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      creator_id INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
    CREATE INDEX IF NOT EXISTS idx_tags_status ON tags(status);

    CREATE TABLE IF NOT EXISTS entry_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      creator_id INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE(entry_id, tag_id)
    );
    CREATE INDEX IF NOT EXISTS idx_entry_tags_entry ON entry_tags(entry_id);
    CREATE INDEX IF NOT EXISTS idx_entry_tags_tag ON entry_tags(tag_id);

    CREATE TABLE IF NOT EXISTS version_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      creator_id INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (version_id) REFERENCES versions(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE(version_id, tag_id)
    );
    CREATE INDEX IF NOT EXISTS idx_version_tags_version ON version_tags(version_id);
    CREATE INDEX IF NOT EXISTS idx_version_tags_tag ON version_tags(tag_id);

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE,
      parent_id INTEGER,
      level INTEGER DEFAULT 1,
      path TEXT,
      color TEXT DEFAULT '#10b981',
      icon TEXT,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      entry_count INTEGER DEFAULT 0,
      version_count INTEGER DEFAULT 0,
      creator_id INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
    CREATE INDEX IF NOT EXISTS idx_categories_status ON categories(status);
    CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order);

    CREATE TABLE IF NOT EXISTS entry_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      is_primary INTEGER DEFAULT 0,
      creator_id INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE(entry_id, category_id)
    );
    CREATE INDEX IF NOT EXISTS idx_entry_categories_entry ON entry_categories(entry_id);
    CREATE INDEX IF NOT EXISTS idx_entry_categories_category ON entry_categories(category_id);

    CREATE TABLE IF NOT EXISTS version_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      is_primary INTEGER DEFAULT 0,
      creator_id INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (version_id) REFERENCES versions(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE(version_id, category_id)
    );
    CREATE INDEX IF NOT EXISTS idx_version_categories_version ON version_categories(version_id);
    CREATE INDEX IF NOT EXISTS idx_version_categories_category ON version_categories(category_id);

    CREATE TABLE IF NOT EXISTS topic_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER,
      chapter_id INTEGER,
      version_id INTEGER NOT NULL,
      note TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
      FOREIGN KEY (version_id) REFERENCES versions(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_topic_versions_topic ON topic_versions(topic_id);
    CREATE INDEX IF NOT EXISTS idx_topic_versions_chapter ON topic_versions(chapter_id);
    CREATE INDEX IF NOT EXISTS idx_topic_versions_version ON topic_versions(version_id);
  `);

  try {
    const cols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
    if (!cols.includes('password_hash')) {
      db.exec(`
        CREATE TABLE users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL DEFAULT '',
          email TEXT,
          display_name TEXT,
          role TEXT NOT NULL DEFAULT '${ROLES.VIEWER}',
          status TEXT NOT NULL DEFAULT 'active',
          last_login_at TEXT,
          created_at TEXT DEFAULT (datetime('now','localtime')),
          updated_at TEXT DEFAULT (datetime('now','localtime'))
        );
        INSERT INTO users_new (id, username, role, display_name)
        SELECT id, username, role, username FROM users;
        DROP TABLE users;
        ALTER TABLE users_new RENAME TO users;
      `);
      console.log('🔄 用户表结构升级完成');
    }
  } catch (e) {
    console.warn('⚠️ 用户表迁移跳过:', e.message);
  }

  try {
    const verCols = db.prepare('PRAGMA table_info(versions)').all().map(c => c.name);
    if (!verCols.includes('updated_at')) {
      db.exec(`ALTER TABLE versions ADD COLUMN updated_at TEXT DEFAULT (datetime('now','localtime'))`);
      db.exec(`UPDATE versions SET updated_at = created_at WHERE updated_at IS NULL`);
      console.log('🔄 版本表 updated_at 字段升级完成');
    }
  } catch (e) {
    console.warn('⚠️ 版本表迁移跳过:', e.message);
  }
}

initSchema();

function createRevision(entityType, entityId, fieldName, oldValue, newValue, user) {
  if (oldValue === newValue) return null;
  const oldStr = oldValue == null ? null : String(oldValue);
  const newStr = newValue == null ? null : String(newValue);
  let summary = '';
  if (oldStr && newStr) {
    const oldPreview = oldStr.length > 50 ? oldStr.slice(0, 50) + '...' : oldStr;
    const newPreview = newStr.length > 50 ? newStr.slice(0, 50) + '...' : newStr;
    summary = `"${oldPreview}" → "${newPreview}"`;
  } else if (!oldStr && newStr) {
    summary = `新增: "${newStr.length > 50 ? newStr.slice(0, 50) + '...' : newStr}"`;
  } else if (oldStr && !newStr) {
    summary = `删除: "${oldStr.length > 50 ? oldStr.slice(0, 50) + '...' : oldStr}"`;
  }
  const info = db.prepare(`
    INSERT INTO revision_history (entity_type, entity_id, field_name, old_value, new_value, change_summary, user_id, user_display_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entityType,
    entityId,
    fieldName,
    oldStr,
    newStr,
    summary,
    user?.id || null,
    user?.displayName || user?.username || '匿名用户'
  );
  return info.lastInsertRowid;
}

function createRevisionsFromDiff(entityType, entityId, oldObj, newObj, fields, user) {
  const ids = [];
  for (const field of fields) {
    const oldVal = oldObj ? oldObj[field] : null;
    const newVal = newObj ? newObj[field] : null;
    const id = createRevision(entityType, entityId, field, oldVal, newVal, user);
    if (id) ids.push(id);
  }
  return ids;
}

module.exports = { db, ROLES, ROLE_PERMISSIONS, ROLE_HIERARCHY, createRevision, createRevisionsFromDiff };

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
  [ROLES.EDITOR]: ['entries:read', 'entries:write', 'versions:read', 'versions:write', 'images:read', 'images:write', 'annotations:read', 'annotations:write', 'references:read', 'references:write'],
  [ROLES.VIEWER]: ['entries:read', 'versions:read', 'images:read', 'annotations:read', 'references:read']
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
}

initSchema();

module.exports = { db, ROLES, ROLE_PERMISSIONS, ROLE_HIERARCHY };

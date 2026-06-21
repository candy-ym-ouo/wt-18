const { db } = require('../db');
const { authenticate, requirePermission, requireRole, ROLES } = require('../auth');
const { exportAll, exportEntries, importData, SCHEMA_VERSION } = require('../dataCenter');

async function routes(fastify) {
  fastify.get('/api/data-center/export', {
    preHandler: [authenticate(), requirePermission('entries:read')]
  }, async (req, reply) => {
    const entryIdsParam = req.query.entry_ids;
    let data;

    if (entryIdsParam) {
      const entryIds = entryIdsParam.split(',').map(s => Number(s.trim())).filter(n => Number.isInteger(n));
      data = exportEntries(entryIds);
    } else {
      data = exportAll();
    }

    const filename = `oldbook-export-${Date.now()}.json`;
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    reply.header('Content-Type', 'application/json; charset=utf-8');
    return data;
  });

  fastify.get('/api/data-center/export/entries/:id', {
    preHandler: [authenticate(), requirePermission('entries:read')]
  }, async (req) => {
    const id = Number(req.params.id);
    return exportEntries([id]);
  });

  fastify.get('/api/data-center/schema', async () => {
    return {
      schema_version: SCHEMA_VERSION,
      description: '旧书版本考据社区数据导入导出格式规范',
      structure: {
        schema_version: 'string - 数据格式版本',
        exported_at: 'string - ISO 8601 导出时间戳',
        stats: 'object - 各类数据数量统计',
        entries: 'array - 词条列表',
        'entries[].title': 'string - 词条标题（必填，去重键）',
        'entries[].author': 'string - 作者',
        'entries[].dynasty': 'string - 朝代',
        'entries[].summary': 'string - 摘要',
        'entries[].cover_url': 'string - 封面URL',
        'entries[].versions': 'array - 该词条的版本列表',
        'entries[].versions[].version_name': 'string - 版本名称（必填，同词条下去重）',
        'entries[].versions[].publisher': 'string - 出版社',
        'entries[].versions[].pub_year': 'string - 出版年份',
        'entries[].versions[].pages': 'number - 页数',
        'entries[].versions[].isbn': 'string - ISBN',
        'entries[].versions[].description': 'string - 版本描述',
        'entries[].versions[].full_text': 'string - 全文内容',
        'entries[].versions[].images': 'array - 书影列表',
        'entries[].versions[].images[].filename': 'string - 文件名（必填）',
        'entries[].versions[].images[].caption': 'string - 图注',
        'entries[].versions[].images[].page_number': 'number - 页码',
        'entries[].versions[].annotations': 'array - 批注树（嵌套 replies 结构）',
        'entries[].versions[].annotations[].old_id': 'number - 临时ID（仅用于重建父子关系）',
        'entries[].versions[].annotations[].user_name': 'string - 批注者',
        'entries[].versions[].annotations[].anchor_text': 'string - 锚定文本',
        'entries[].versions[].annotations[].comment': 'string - 批注内容（必填）',
        'entries[].versions[].annotations[].replies': 'array - 回复批注（同结构）',
        references: 'array - 引用关系列表',
        'references[].from_entry_id': 'number|string - 源词条ID或标题（必填）',
        'references[].to_entry_id': 'number|string - 目标词条ID或标题（必填）',
        'references[].relation_type': 'string - 关系类型（默认"相关"）',
        'references[].note': 'string - 备注'
      }
    };
  });

  fastify.post('/api/data-center/import', {
    preHandler: [authenticate(), requirePermission('entries:write')]
  }, async (req) => {
    const { data, overwrite = false, skip_duplicates = false } = req.body || {};

    if (!data) {
      const err = new Error('请提供 data 字段');
      err.statusCode = 400;
      throw err;
    }

    const importDataObj = typeof data === 'string' ? JSON.parse(data) : data;

    const result = importData(importDataObj, {
      overwrite: Boolean(overwrite),
      skipDuplicates: Boolean(skip_duplicates)
    });

    return result;
  });

  fastify.post('/api/data-center/import/file', {
    preHandler: [authenticate(), requirePermission('entries:write')]
  }, async (req, reply) => {
    const parts = req.parts();
    let data = null;
    let overwrite = false;
    let skipDuplicates = false;

    for await (const part of parts) {
      if (part.type === 'file') {
        let content = '';
        part.file.setEncoding('utf8');
        for await (const chunk of part.file) {
          content += chunk;
        }
        try {
          data = JSON.parse(content);
        } catch (e) {
          const err = new Error('JSON 解析失败: ' + e.message);
          err.statusCode = 400;
          throw err;
        }
      } else if (part.type === 'field') {
        if (part.fieldname === 'overwrite') overwrite = part.value === 'true' || part.value === true;
        if (part.fieldname === 'skip_duplicates') skipDuplicates = part.value === 'true' || part.value === true;
      }
    }

    if (!data) {
      const err = new Error('未找到 JSON 数据文件');
      err.statusCode = 400;
      throw err;
    }

    const result = importData(data, { overwrite, skipDuplicates });
    return result;
  });

  fastify.get('/api/data-center/stats', {
    preHandler: [authenticate(), requirePermission('entries:read')]
  }, async () => {
    return {
      entries: db.prepare('SELECT COUNT(*) AS count FROM entries').get().count,
      versions: db.prepare('SELECT COUNT(*) AS count FROM versions').get().count,
      images: db.prepare('SELECT COUNT(*) AS count FROM images').get().count,
      annotations: db.prepare('SELECT COUNT(*) AS count FROM annotations').get().count,
      references: db.prepare('SELECT COUNT(*) AS count FROM refs').get().count
    };
  });
}

module.exports = routes;

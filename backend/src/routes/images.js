const { db } = require('../db');
const path = require('path');
const fs = require('fs');
const { pipeline } = require('stream');
const { promisify } = require('util');
const { authenticate, requirePermission } = require('../auth');
const pump = promisify(pipeline);

async function routes(fastify) {
  fastify.get('/api/versions/:versionId/images', async (req) => {
    return db.prepare('SELECT * FROM images WHERE version_id = ? ORDER BY page_number, id').all(Number(req.params.versionId));
  });

  fastify.post('/api/versions/:versionId/images', {
    preHandler: [authenticate(), requirePermission('images:write')]
  }, async (req, reply) => {
    const versionId = Number(req.params.versionId);
    const version = db.prepare('SELECT id FROM versions WHERE id = ?').get(versionId);
    if (!version) {
      const err = new Error('版本不存在');
      err.statusCode = 404;
      throw err;
    }

    const uploadDir = path.join(__dirname, '..', '..', 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const mp = await req.file();
    if (!mp) {
      reply.code(400);
      return { error: '未找到文件' };
    }

    const ext = path.extname(mp.filename) || '.png';
    const filename = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    const filepath = path.join(uploadDir, filename);

    await pump(mp.file, fs.createWriteStream(filepath));

    const caption = (mp.fields && mp.fields.caption && mp.fields.caption.value) || '';
    const pageNumber = (mp.fields && mp.fields.page_number && Number(mp.fields.page_number.value)) || null;

    const info = db.prepare(`
      INSERT INTO images (version_id, filename, caption, page_number)
      VALUES (?, ?, ?, ?)
    `).run(versionId, filename, caption, pageNumber);

    return { id: info.lastInsertRowid, filename, url: `/uploads/${filename}` };
  });

  fastify.delete('/api/images/:id', {
    preHandler: [authenticate(), requirePermission('images:write')]
  }, async (req) => {
    const id = Number(req.params.id);
    const img = db.prepare('SELECT filename FROM images WHERE id = ?').get(id);
    if (img) {
      const p = path.join(__dirname, '..', '..', 'uploads', img.filename);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    db.prepare('DELETE FROM images WHERE id = ?').run(id);
    return { ok: true };
  });
}

module.exports = routes;

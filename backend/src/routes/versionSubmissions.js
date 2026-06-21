const { db } = require('../db');
const path = require('path');
const fs = require('fs');
const { pipeline } = require('stream');
const { promisify } = require('util');
const { authenticate, requirePermission } = require('../auth');
const { notifyReviewResult } = require('../notificationService');
const pump = promisify(pipeline);

const SUBMISSION_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

async function routes(fastify) {
  fastify.get('/api/submissions/statuses', async () => {
    return SUBMISSION_STATUSES;
  });

  fastify.post('/api/submissions', async (req, reply) => {
    const {
      entry_id,
      entry_title,
      entry_author,
      version_name,
      publisher,
      pub_year,
      pages,
      isbn,
      description,
      submitter_name,
      submitter_contact,
      submitter_note
    } = req.body;

    if (!version_name || !version_name.trim()) {
      reply.code(400);
      return { error: '请填写版本名称' };
    }
    if (!submitter_name || !submitter_name.trim()) {
      reply.code(400);
      return { error: '请填写您的姓名' };
    }

    let finalEntryId = entry_id || null;
    let finalEntryTitle = entry_title || '';
    let finalEntryAuthor = entry_author || '';

    if (entry_id) {
      const entry = db.prepare('SELECT id, title, author FROM entries WHERE id = ?').get(Number(entry_id));
      if (entry) {
        finalEntryTitle = entry.title;
        finalEntryAuthor = entry.author || '';
      } else {
        finalEntryId = null;
      }
    }

    const info = db.prepare(`
      INSERT INTO version_submissions (
        entry_id, entry_title, entry_author, version_name, publisher, pub_year,
        pages, isbn, description, submitter_name, submitter_contact, submitter_note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      finalEntryId,
      finalEntryTitle,
      finalEntryAuthor,
      version_name.trim(),
      publisher || '',
      pub_year || '',
      pages || null,
      isbn || '',
      description || '',
      submitter_name.trim(),
      submitter_contact || '',
      submitter_note || ''
    );

    return { id: info.lastInsertRowid, message: '提交成功，感谢您的贡献！我们会尽快审核。' };
  });

  fastify.post('/api/submissions/:id/images', async (req, reply) => {
    const submissionId = Number(req.params.id);
    const submission = db.prepare('SELECT id, status FROM version_submissions WHERE id = ?').get(submissionId);
    if (!submission) {
      reply.code(404);
      return { error: '提交记录不存在' };
    }
    if (submission.status !== SUBMISSION_STATUSES.PENDING) {
      reply.code(400);
      return { error: '该提交已审核，无法再上传图片' };
    }

    const uploadDir = path.join(__dirname, '..', '..', 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const mp = await req.file();
    if (!mp) {
      reply.code(400);
      return { error: '未找到文件' };
    }

    const ext = path.extname(mp.filename) || '.png';
    const filename = `submission_${submissionId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    const filepath = path.join(uploadDir, filename);

    await pump(mp.file, fs.createWriteStream(filepath));

    const caption = (mp.fields && mp.fields.caption && mp.fields.caption.value) || '';

    const info = db.prepare(`
      INSERT INTO version_submission_images (submission_id, filename, caption)
      VALUES (?, ?, ?)
    `).run(submissionId, filename, caption);

    return { id: info.lastInsertRowid, filename, url: `/uploads/${filename}` };
  });

  fastify.get('/api/submissions/:id', async (req, reply) => {
    const id = Number(req.params.id);
    const submission = db.prepare('SELECT * FROM version_submissions WHERE id = ?').get(id);
    if (!submission) {
      reply.code(404);
      return { error: '提交记录不存在' };
    }
    const images = db.prepare('SELECT * FROM version_submission_images WHERE submission_id = ? ORDER BY id').all(id);
    return { ...submission, images };
  });

  fastify.get('/api/submissions', {
    preHandler: [authenticate(), requirePermission('submissions:read')]
  }, async (req) => {
    const { status, page = 1, page_size = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(page_size);

    let whereClause = '';
    let params = [];
    if (status && status !== 'all') {
      whereClause = 'WHERE vs.status = ?';
      params.push(status);
    }

    const count = db.prepare(`SELECT COUNT(*) as total FROM version_submissions vs ${whereClause}`).get(...params).total;
    const list = db.prepare(`
      SELECT vs.*,
             u.username as reviewer_name,
             u.display_name as reviewer_display_name
      FROM version_submissions vs
      LEFT JOIN users u ON vs.reviewer_id = u.id
      ${whereClause}
      ORDER BY vs.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, Number(page_size), offset);

    return { list, total: count, page: Number(page), page_size: Number(page_size) };
  });

  fastify.post('/api/submissions/:id/approve', {
    preHandler: [authenticate(), requirePermission('submissions:review')]
  }, async (req, reply) => {
    const id = Number(req.params.id);
    const { review_note, create_new_entry = false, entry_title, entry_author } = req.body;

    const submission = db.prepare('SELECT * FROM version_submissions WHERE id = ?').get(id);
    if (!submission) {
      reply.code(404);
      return { error: '提交记录不存在' };
    }
    if (submission.status !== SUBMISSION_STATUSES.PENDING) {
      reply.code(400);
      return { error: '该提交已审核，不能重复操作' };
    }

    let targetEntryId = submission.entry_id;

    if (create_new_entry && entry_title) {
      const entryInfo = db.prepare(`
        INSERT INTO entries (title, author, summary)
        VALUES (?, ?, ?)
      `).run(
        entry_title.trim(),
        entry_author || '',
        `来自版本征集：${submission.version_name} - ${submission.submitter_name}`
      );
      targetEntryId = entryInfo.lastInsertRowid;
    } else if (!create_new_entry && req.body.entry_id) {
      targetEntryId = Number(req.body.entry_id);
      const entry = db.prepare('SELECT id FROM entries WHERE id = ?').get(targetEntryId);
      if (!entry) {
        reply.code(400);
        return { error: '选择的词条不存在' };
      }
    }

    if (!targetEntryId) {
      reply.code(400);
      return { error: '请选择或创建关联词条' };
    }

    const versionInfo = db.prepare(`
      INSERT INTO versions (entry_id, version_name, publisher, pub_year, pages, isbn, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      targetEntryId,
      submission.version_name,
      submission.publisher || '',
      submission.pub_year || '',
      submission.pages || null,
      submission.isbn || '',
      submission.description || ''
    );

    const versionId = versionInfo.lastInsertRowid;

    const images = db.prepare('SELECT * FROM version_submission_images WHERE submission_id = ?').all(id);
    for (const img of images) {
      db.prepare(`
        INSERT INTO images (version_id, filename, caption)
        VALUES (?, ?, ?)
      `).run(versionId, img.filename, img.caption || '');
    }

    db.prepare(`
      UPDATE version_submissions
      SET status = ?, review_note = ?, reviewer_id = ?, reviewed_at = datetime('now','localtime'),
          approved_version_id = ?, updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(SUBMISSION_STATUSES.APPROVED, review_note || '', req.user.id, versionId, id);

    notifyReviewResult({
      submissionId: id,
      submissionVersion: submission.version_name,
      status: SUBMISSION_STATUSES.APPROVED,
      reviewNote: review_note,
      reviewerId: req.user.id,
      submitterName: submission.submitter_name,
      submitterContact: submission.submitter_contact
    });

    return { ok: true, version_id: versionId, entry_id: targetEntryId, message: '审核通过，已创建正式版本' };
  });

  fastify.post('/api/submissions/:id/reject', {
    preHandler: [authenticate(), requirePermission('submissions:review')]
  }, async (req, reply) => {
    const id = Number(req.params.id);
    const { review_note } = req.body;

    const submission = db.prepare('SELECT * FROM version_submissions WHERE id = ?').get(id);
    if (!submission) {
      reply.code(404);
      return { error: '提交记录不存在' };
    }
    if (submission.status !== SUBMISSION_STATUSES.PENDING) {
      reply.code(400);
      return { error: '该提交已审核，不能重复操作' };
    }

    db.prepare(`
      UPDATE version_submissions
      SET status = ?, review_note = ?, reviewer_id = ?, reviewed_at = datetime('now','localtime'),
          updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(SUBMISSION_STATUSES.REJECTED, review_note || '', req.user.id, id);

    notifyReviewResult({
      submissionId: id,
      submissionVersion: submission.version_name,
      status: SUBMISSION_STATUSES.REJECTED,
      reviewNote: review_note,
      reviewerId: req.user.id,
      submitterName: submission.submitter_name,
      submitterContact: submission.submitter_contact
    });

    return { ok: true, message: '已拒绝该提交' };
  });

  fastify.delete('/api/submissions/:id', {
    preHandler: [authenticate(), requirePermission('submissions:review')]
  }, async (req) => {
    const id = Number(req.params.id);
    const images = db.prepare('SELECT filename FROM version_submission_images WHERE submission_id = ?').all(id);

    for (const img of images) {
      const p = path.join(__dirname, '..', '..', 'uploads', img.filename);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }

    db.prepare('DELETE FROM version_submission_images WHERE submission_id = ?').run(id);
    db.prepare('DELETE FROM version_submissions WHERE id = ?').run(id);

    return { ok: true };
  });
}

module.exports = routes;

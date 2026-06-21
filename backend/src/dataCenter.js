const { db } = require('./db');

const SCHEMA_VERSION = '1.0';

const ENTRY_FIELDS = ['id', 'title', 'author', 'dynasty', 'summary', 'cover_url'];
const VERSION_FIELDS = ['id', 'version_name', 'publisher', 'pub_year', 'pages', 'isbn', 'description', 'full_text'];
const IMAGE_FIELDS = ['filename', 'caption', 'page_number'];
const REFERENCE_FIELDS = ['from_entry_id', 'to_entry_id', 'relation_type', 'note'];

function buildAnnotationsTree(annotations, parentId = null) {
  return annotations
    .filter(a => a.parent_id === parentId)
    .map(a => ({
      old_id: a.id,
      user_name: a.user_name,
      anchor_text: a.anchor_text,
      comment: a.comment,
      replies: buildAnnotationsTree(annotations, a.id)
    }));
}

function exportAll() {
  const entries = db.prepare('SELECT * FROM entries ORDER BY id').all();
  const allVersions = db.prepare('SELECT * FROM versions ORDER BY id').all();
  const allImages = db.prepare('SELECT * FROM images ORDER BY id').all();
  const allAnnotations = db.prepare('SELECT * FROM annotations ORDER BY id').all();
  const allReferences = db.prepare('SELECT * FROM refs ORDER BY id').all();

  const versionsByEntry = {};
  for (const v of allVersions) {
    versionsByEntry[v.entry_id] = versionsByEntry[v.entry_id] || [];
    versionsByEntry[v.entry_id].push(v);
  }

  const imagesByVersion = {};
  for (const img of allImages) {
    imagesByVersion[img.version_id] = imagesByVersion[img.version_id] || [];
    imagesByVersion[img.version_id].push(img);
  }

  const annotationsByVersion = {};
  for (const ann of allAnnotations) {
    annotationsByVersion[ann.version_id] = annotationsByVersion[ann.version_id] || [];
    annotationsByVersion[ann.version_id].push(ann);
  }

  const result = {
    schema_version: SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    stats: {
      entries: entries.length,
      versions: allVersions.length,
      images: allImages.length,
      annotations: allAnnotations.length,
      references: allReferences.length
    },
    entries: entries.map(entry => {
      const versions = (versionsByEntry[entry.id] || []).map(version => ({
        ...pickFields(version, VERSION_FIELDS),
        images: (imagesByVersion[version.id] || []).map(img => pickFields(img, IMAGE_FIELDS)),
        annotations: buildAnnotationsTree(annotationsByVersion[version.id] || [])
      }));
      return {
        ...pickFields(entry, ENTRY_FIELDS),
        versions
      };
    }),
    references: allReferences.map(ref => pickFields(ref, REFERENCE_FIELDS))
  };

  return result;
}

function exportEntries(entryIds) {
  const ids = entryIds.filter(Number.isInteger);
  if (ids.length === 0) {
    const err = new Error('请提供有效的词条ID');
    err.statusCode = 400;
    throw err;
  }

  const placeholders = ids.map(() => '?').join(',');
  const entries = db.prepare(`SELECT * FROM entries WHERE id IN (${placeholders}) ORDER BY id`).all(...ids);
  const foundIds = entries.map(e => e.id);
  const missingIds = ids.filter(id => !foundIds.includes(id));

  const allVersions = db.prepare(`SELECT * FROM versions WHERE entry_id IN (${placeholders}) ORDER BY id`).all(...ids);
  const versionIds = allVersions.map(v => v.id);
  const versionPlaceholders = versionIds.length > 0 ? versionIds.map(() => '?').join(',') : 'NULL';

  const allImages = versionIds.length > 0
    ? db.prepare(`SELECT * FROM images WHERE version_id IN (${versionPlaceholders}) ORDER BY id`).all(...versionIds)
    : [];
  const allAnnotations = versionIds.length > 0
    ? db.prepare(`SELECT * FROM annotations WHERE version_id IN (${versionPlaceholders}) ORDER BY id`).all(...versionIds)
    : [];

  const allReferences = db.prepare(
    `SELECT * FROM refs WHERE from_entry_id IN (${placeholders}) OR to_entry_id IN (${placeholders}) ORDER BY id`
  ).all(...ids, ...ids);

  const versionsByEntry = {};
  for (const v of allVersions) {
    versionsByEntry[v.entry_id] = versionsByEntry[v.entry_id] || [];
    versionsByEntry[v.entry_id].push(v);
  }

  const imagesByVersion = {};
  for (const img of allImages) {
    imagesByVersion[img.version_id] = imagesByVersion[img.version_id] || [];
    imagesByVersion[img.version_id].push(img);
  }

  const annotationsByVersion = {};
  for (const ann of allAnnotations) {
    annotationsByVersion[ann.version_id] = annotationsByVersion[ann.version_id] || [];
    annotationsByVersion[ann.version_id].push(ann);
  }

  return {
    schema_version: SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    requested_entry_ids: ids,
    found_entry_ids: foundIds,
    missing_entry_ids: missingIds,
    stats: {
      entries: entries.length,
      versions: allVersions.length,
      images: allImages.length,
      annotations: allAnnotations.length,
      references: allReferences.length
    },
    entries: entries.map(entry => ({
      ...pickFields(entry, ENTRY_FIELDS),
      versions: (versionsByEntry[entry.id] || []).map(version => ({
        ...pickFields(version, VERSION_FIELDS),
        images: (imagesByVersion[version.id] || []).map(img => pickFields(img, IMAGE_FIELDS)),
        annotations: buildAnnotationsTree(annotationsByVersion[version.id] || [])
      }))
    })),
    references: allReferences.map(ref => pickFields(ref, REFERENCE_FIELDS))
  };
}

function pickFields(obj, fields) {
  const result = {};
  for (const f of fields) {
    if (obj[f] !== undefined) result[f] = obj[f];
  }
  return result;
}

function flattenAnnotations(annotations, parentOldId = null) {
  const result = [];
  for (const ann of annotations) {
    result.push({
      old_id: ann.old_id,
      parent_old_id: parentOldId,
      user_name: ann.user_name,
      anchor_text: ann.anchor_text,
      comment: ann.comment
    });
    if (ann.replies && ann.replies.length > 0) {
      result.push(...flattenAnnotations(ann.replies, ann.old_id));
    }
  }
  return result;
}

function importData(data, options = {}) {
  const { overwrite = false, skipDuplicates = false } = options;

  if (!data || !data.entries || !Array.isArray(data.entries)) {
    const err = new Error('数据格式无效：缺少 entries 数组');
    err.statusCode = 400;
    throw err;
  }

  const result = {
    imported: { entries: 0, versions: 0, images: 0, annotations: 0, references: 0 },
    skipped: { entries: 0, versions: 0, images: 0, annotations: 0, references: 0 },
    errors: []
  };

  const tx = db.transaction(() => {
    const titleToNewEntryId = {};
    const allAnnotationsQueue = [];
    const oldToNewAnnotationId = {};

    for (const entryData of data.entries) {
      try {
        if (!entryData.title) {
          result.errors.push('词条缺少 title 字段，跳过');
          continue;
        }

        let entryId;
        const existing = db.prepare('SELECT id FROM entries WHERE title = ?').get(entryData.title);

        if (existing) {
          if (overwrite) {
            db.prepare(`
              UPDATE entries SET author=?, dynasty=?, summary=?, cover_url=?,
                updated_at = datetime('now','localtime')
              WHERE id = ?
            `).run(
              entryData.author || '',
              entryData.dynasty || '',
              entryData.summary || '',
              entryData.cover_url || '',
              existing.id
            );
            entryId = existing.id;
          } else if (skipDuplicates) {
            result.skipped.entries++;
            entryId = existing.id;
          } else {
            result.errors.push(`词条「${entryData.title}」已存在，跳过`);
            result.skipped.entries++;
            entryId = existing.id;
          }
        } else {
          const info = db.prepare(`
            INSERT INTO entries (title, author, dynasty, summary, cover_url)
            VALUES (?, ?, ?, ?, ?)
          `).run(
            entryData.title || '',
            entryData.author || '',
            entryData.dynasty || '',
            entryData.summary || '',
            entryData.cover_url || ''
          );
          entryId = info.lastInsertRowid;
          result.imported.entries++;
        }

        titleToNewEntryId[entryData.title] = entryId;

        if (entryData.versions && Array.isArray(entryData.versions)) {
          for (const versionData of entryData.versions) {
            try {
              if (!versionData.version_name) {
                result.errors.push(`词条「${entryData.title}」下的版本缺少 version_name，跳过`);
                continue;
              }

              let versionId;
              const existingVersion = db.prepare(
                'SELECT id FROM versions WHERE entry_id = ? AND version_name = ?'
              ).get(entryId, versionData.version_name);

              if (existingVersion) {
                if (overwrite) {
                  db.prepare(`
                    UPDATE versions SET publisher=?, pub_year=?, pages=?, isbn=?, description=?, full_text=?
                    WHERE id = ?
                  `).run(
                    versionData.publisher || '',
                    versionData.pub_year || '',
                    versionData.pages || null,
                    versionData.isbn || '',
                    versionData.description || '',
                    versionData.full_text || '',
                    existingVersion.id
                  );
                  versionId = existingVersion.id;
                } else if (skipDuplicates) {
                  result.skipped.versions++;
                  versionId = existingVersion.id;
                } else {
                  result.errors.push(`版本「${versionData.version_name}」已存在于词条「${entryData.title}」，跳过`);
                  result.skipped.versions++;
                  versionId = existingVersion.id;
                }
              } else {
                const info = db.prepare(`
                  INSERT INTO versions (entry_id, version_name, publisher, pub_year, pages, isbn, description, full_text)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                  entryId,
                  versionData.version_name,
                  versionData.publisher || '',
                  versionData.pub_year || '',
                  versionData.pages || null,
                  versionData.isbn || '',
                  versionData.description || '',
                  versionData.full_text || ''
                );
                versionId = info.lastInsertRowid;
                result.imported.versions++;
              }

              if (versionData.images && Array.isArray(versionData.images)) {
                for (const imgData of versionData.images) {
                  try {
                    if (!imgData.filename) {
                      result.errors.push(`版本「${versionData.version_name}」下的图片缺少 filename，跳过`);
                      continue;
                    }
                    db.prepare(`
                      INSERT INTO images (version_id, filename, caption, page_number)
                      VALUES (?, ?, ?, ?)
                    `).run(
                      versionId,
                      imgData.filename,
                      imgData.caption || '',
                      imgData.page_number || null
                    );
                    result.imported.images++;
                  } catch (e) {
                    result.errors.push(`导入图片失败: ${e.message}`);
                  }
                }
              }

              if (versionData.annotations && Array.isArray(versionData.annotations)) {
                const flat = flattenAnnotations(versionData.annotations);
                for (const ann of flat) {
                  allAnnotationsQueue.push({ versionId, ann });
                }
              }
            } catch (e) {
              result.errors.push(`导入版本「${versionData.version_name}」失败: ${e.message}`);
            }
          }
        }
      } catch (e) {
        result.errors.push(`导入词条「${entryData.title || '未命名'}」失败: ${e.message}`);
      }
    }

    for (const { versionId, ann } of allAnnotationsQueue) {
      try {
        if (!ann.comment) {
          result.errors.push('批注缺少 comment，跳过');
          continue;
        }
        const parentId = ann.parent_old_id ? oldToNewAnnotationId[ann.parent_old_id] : null;
        const info = db.prepare(`
          INSERT INTO annotations (version_id, user_name, anchor_text, comment, parent_id)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          versionId,
          ann.user_name || '匿名学者',
          ann.anchor_text || '',
          ann.comment,
          parentId
        );
        if (ann.old_id !== undefined && ann.old_id !== null) {
          oldToNewAnnotationId[ann.old_id] = info.lastInsertRowid;
        }
        result.imported.annotations++;
      } catch (e) {
        result.errors.push(`导入批注失败: ${e.message}`);
      }
    }

    if (data.references && Array.isArray(data.references)) {
      for (const refData of data.references) {
        try {
          let fromId = refData.from_entry_id;
          let toId = refData.to_entry_id;

          if (typeof fromId === 'string') {
            fromId = titleToNewEntryId[fromId];
          }
          if (typeof toId === 'string') {
            toId = titleToNewEntryId[toId];
          }

          if (!fromId || !toId) {
            result.errors.push('引用关系缺少有效的 from_entry_id 或 to_entry_id，跳过');
            result.skipped.references++;
            continue;
          }

          if (fromId === toId) {
            result.errors.push(`引用关系不能指向自身（from=${fromId}, to=${toId}），跳过`);
            result.skipped.references++;
            continue;
          }

          const existingRef = db.prepare(
            'SELECT id FROM refs WHERE from_entry_id = ? AND to_entry_id = ? AND relation_type = ?'
          ).get(fromId, toId, refData.relation_type || '相关');

          if (existingRef) {
            if (overwrite) {
              db.prepare('UPDATE refs SET note = ? WHERE id = ?').run(refData.note || '', existingRef.id);
            } else {
              result.skipped.references++;
              continue;
            }
          } else {
            db.prepare(`
              INSERT INTO refs (from_entry_id, to_entry_id, relation_type, note)
              VALUES (?, ?, ?, ?)
            `).run(fromId, toId, refData.relation_type || '相关', refData.note || '');
          }
          result.imported.references++;
        } catch (e) {
          result.errors.push(`导入引用关系失败: ${e.message}`);
        }
      }
    }
  });

  try {
    tx();
  } catch (e) {
    result.errors.push(`事务执行失败: ${e.message}`);
  }

  return result;
}

module.exports = {
  exportAll,
  exportEntries,
  importData,
  SCHEMA_VERSION
};

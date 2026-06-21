const { db } = require('../db');

const VALID_TYPES = ['entry', 'version', 'annotation', 'reference'];
const VALID_SORT_FIELDS = ['relevance', 'created_at', 'title'];
const VALID_SORT_ORDERS = ['asc', 'desc'];

function buildSearchQuery(type, params) {
  const { q, dynasty, author, publisher, pub_year, relation_type, user_name } = params;
  const conditions = [];
  const values = [];

  switch (type) {
    case 'entry':
      if (q) {
        conditions.push('(e.title LIKE ? OR e.author LIKE ? OR e.dynasty LIKE ? OR e.summary LIKE ?)');
        const likeQ = `%${q}%`;
        values.push(likeQ, likeQ, likeQ, likeQ);
      }
      if (dynasty) {
        conditions.push('e.dynasty = ?');
        values.push(dynasty);
      }
      if (author) {
        conditions.push('e.author LIKE ?');
        values.push(`%${author}%`);
      }
      break;

    case 'version':
      if (q) {
        conditions.push('(v.version_name LIKE ? OR v.publisher LIKE ? OR v.description LIKE ? OR v.full_text LIKE ? OR v.isbn LIKE ?)');
        const likeQ = `%${q}%`;
        values.push(likeQ, likeQ, likeQ, likeQ, likeQ);
      }
      if (publisher) {
        conditions.push('v.publisher LIKE ?');
        values.push(`%${publisher}%`);
      }
      if (pub_year) {
        conditions.push('v.pub_year = ?');
        values.push(pub_year);
      }
      if (dynasty || author) {
        const subConds = [];
        const subVals = [];
        if (dynasty) {
          subConds.push('dynasty = ?');
          subVals.push(dynasty);
        }
        if (author) {
          subConds.push('author LIKE ?');
          subVals.push(`%${author}%`);
        }
        conditions.push(`v.entry_id IN (SELECT id FROM entries WHERE ${subConds.join(' AND ')})`);
        values.push(...subVals);
      }
      break;

    case 'annotation':
      if (q) {
        conditions.push('(a.comment LIKE ? OR a.anchor_text LIKE ? OR a.user_name LIKE ?)');
        const likeQ = `%${q}%`;
        values.push(likeQ, likeQ, likeQ);
      }
      if (user_name) {
        conditions.push('a.user_name LIKE ?');
        values.push(`%${user_name}%`);
      }
      break;

    case 'reference':
      if (q || dynasty || author || relation_type) {
        if (relation_type) {
          conditions.push('r.relation_type = ?');
          values.push(relation_type);
        }
        if (q || dynasty || author) {
          const subConditions = [];
          const subValues = [];
          if (q) {
            subConditions.push('(e_from.title LIKE ? OR e_from.author LIKE ? OR e_to.title LIKE ? OR e_to.author LIKE ? OR r.note LIKE ?)');
            const likeQ = `%${q}%`;
            subValues.push(likeQ, likeQ, likeQ, likeQ, likeQ);
          }
          if (dynasty) {
            subConditions.push('(e_from.dynasty = ? OR e_to.dynasty = ?)');
            subValues.push(dynasty, dynasty);
          }
          if (author) {
            subConditions.push('(e_from.author LIKE ? OR e_to.author LIKE ?)');
            subValues.push(`%${author}%`, `%${author}%`);
          }
          if (subConditions.length > 0) {
            conditions.push('(' + subConditions.join(' AND ') + ')');
            values.push(...subValues);
          }
        }
      }
      break;
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  return { whereClause, values };
}

function searchEntries(params, sortBy, sortOrder) {
  const { whereClause, values } = buildSearchQuery('entry', params);
  
  let orderClause = 'ORDER BY e.id DESC';
  if (sortBy === 'title') {
    orderClause = `ORDER BY e.title ${sortOrder}`;
  } else if (sortBy === 'created_at') {
    orderClause = `ORDER BY e.created_at ${sortOrder}`;
  }

  const query = `
    SELECT 
      'entry' AS type,
      e.id,
      e.title,
      e.author,
      e.dynasty,
      e.summary,
      e.cover_url,
      e.created_at,
      e.updated_at,
      (SELECT COUNT(*) FROM versions v WHERE v.entry_id = e.id) AS version_count
    FROM entries e
    ${whereClause}
    ${orderClause}
  `;

  return db.prepare(query).all(...values);
}

function searchVersions(params, sortBy, sortOrder) {
  const { whereClause, values } = buildSearchQuery('version', params);

  let orderClause = 'ORDER BY v.id DESC';
  if (sortBy === 'title') {
    orderClause = `ORDER BY v.version_name ${sortOrder}`;
  } else if (sortBy === 'created_at') {
    orderClause = `ORDER BY v.created_at ${sortOrder}`;
  }

  const query = `
    SELECT 
      'version' AS type,
      v.id,
      v.version_name AS title,
      v.entry_id,
      e.title AS entry_title,
      e.author AS entry_author,
      e.dynasty AS entry_dynasty,
      v.publisher,
      v.pub_year,
      v.pages,
      v.isbn,
      v.description,
      v.created_at,
      v.updated_at
    FROM versions v
    JOIN entries e ON v.entry_id = e.id
    ${whereClause}
    ${orderClause}
  `;

  return db.prepare(query).all(...values);
}

function searchAnnotations(params, sortBy, sortOrder) {
  const { whereClause, values } = buildSearchQuery('annotation', params);

  let orderClause = 'ORDER BY a.id DESC';
  if (sortBy === 'created_at') {
    orderClause = `ORDER BY a.created_at ${sortOrder}`;
  } else if (sortBy === 'title') {
    orderClause = `ORDER BY a.user_name ${sortOrder}`;
  }

  const query = `
    SELECT 
      'annotation' AS type,
      a.id,
      a.comment AS title,
      a.version_id,
      v.version_name AS version_title,
      e.id AS entry_id,
      e.title AS entry_title,
      a.user_name,
      a.anchor_text,
      a.parent_id,
      a.created_at
    FROM annotations a
    JOIN versions v ON a.version_id = v.id
    JOIN entries e ON v.entry_id = e.id
    ${whereClause}
    ${orderClause}
  `;

  return db.prepare(query).all(...values);
}

function searchReferences(params, sortBy, sortOrder) {
  const { whereClause, values } = buildSearchQuery('reference', params);

  let orderClause = 'ORDER BY r.id DESC';
  if (sortBy === 'created_at') {
    orderClause = `ORDER BY r.created_at ${sortOrder}`;
  } else if (sortBy === 'title') {
    orderClause = `ORDER BY e_from.title ${sortOrder}`;
  }

  const query = `
    SELECT 
      'reference' AS type,
      r.id,
      r.relation_type AS title,
      r.from_entry_id,
      r.to_entry_id,
      e_from.title AS from_title,
      e_from.author AS from_author,
      e_from.dynasty AS from_dynasty,
      e_to.title AS to_title,
      e_to.author AS to_author,
      e_to.dynasty AS to_dynasty,
      r.note,
      r.created_at
    FROM refs r
    JOIN entries e_from ON r.from_entry_id = e_from.id
    JOIN entries e_to ON r.to_entry_id = e_to.id
    ${whereClause}
    ${orderClause}
  `;

  return db.prepare(query).all(...values);
}

function computeRelevance(item, q) {
  if (!q) return 0;
  const lowerQ = q.toLowerCase();
  let score = 0;
  const fieldsToCheck = ['title', 'author', 'dynasty', 'summary', 'description', 'comment', 'anchor_text', 'note'];
  
  for (const field of fieldsToCheck) {
    if (item[field] && typeof item[field] === 'string') {
      const lowerField = item[field].toLowerCase();
      if (lowerField === lowerQ) score += 100;
      else if (lowerField.startsWith(lowerQ)) score += 50;
      else if (lowerField.includes(lowerQ)) score += 10;
    }
  }
  return score;
}

async function routes(fastify) {
  fastify.get('/api/search', async (req) => {
    const {
      q = '',
      types = 'entry,version,annotation,reference',
      page = 1,
      page_size = 20,
      sort_by = 'relevance',
      sort_order = 'desc',
      dynasty = '',
      author = '',
      publisher = '',
      pub_year = '',
      relation_type = '',
      user_name = ''
    } = req.query;

    const typeList = types.split(',').map(t => t.trim()).filter(t => VALID_TYPES.includes(t));
    if (typeList.length === 0) {
      const err = new Error('无效的搜索类型');
      err.statusCode = 400;
      throw err;
    }

    const sortBy = VALID_SORT_FIELDS.includes(sort_by) ? sort_by : 'relevance';
    const sortOrder = VALID_SORT_ORDERS.includes(sort_order) ? sort_order : 'desc';

    const params = { q, dynasty, author, publisher, pub_year, relation_type, user_name };

    const allResults = [];
    const aggregations = {};

    if (typeList.includes('entry')) {
      const results = searchEntries(params, sortBy, sortOrder);
      aggregations.entry = results.length;
      allResults.push(...results);
    }

    if (typeList.includes('version')) {
      const results = searchVersions(params, sortBy, sortOrder);
      aggregations.version = results.length;
      allResults.push(...results);
    }

    if (typeList.includes('annotation')) {
      const results = searchAnnotations(params, sortBy, sortOrder);
      aggregations.annotation = results.length;
      allResults.push(...results);
    }

    if (typeList.includes('reference')) {
      const results = searchReferences(params, sortBy, sortOrder);
      aggregations.reference = results.length;
      allResults.push(...results);
    }

    if (sortBy === 'relevance') {
      allResults.sort((a, b) => {
        const scoreA = computeRelevance(a, q);
        const scoreB = computeRelevance(b, q);
        return sortOrder === 'desc' ? scoreB - scoreA : scoreA - scoreB;
      });
    }

    const total = allResults.length;
    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.max(1, Math.min(100, parseInt(page_size, 10)));
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (pageNum - 1) * pageSize;
    const paginatedResults = allResults.slice(startIndex, startIndex + pageSize);

    return {
      total,
      page: pageNum,
      page_size: pageSize,
      total_pages: totalPages,
      aggregations,
      results: paginatedResults
    };
  });

  fastify.get('/api/search/types', async () => {
    return {
      types: [
        { value: 'entry', label: '词条' },
        { value: 'version', label: '版本' },
        { value: 'annotation', label: '批注' },
        { value: 'reference', label: '引用关系' }
      ],
      sort_options: [
        { value: 'relevance', label: '相关度' },
        { value: 'created_at', label: '创建时间' },
        { value: 'title', label: '标题' }
      ],
      filters: {
        entry: ['dynasty', 'author'],
        version: ['publisher', 'pub_year', 'dynasty', 'author'],
        annotation: ['user_name'],
        reference: ['relation_type', 'dynasty', 'author']
      }
    };
  });

  fastify.get('/api/search/facets', async (req) => {
    const { q = '' } = req.query;

    const dynasties = db.prepare(`
      SELECT DISTINCT dynasty FROM entries 
      WHERE dynasty IS NOT NULL AND dynasty != ''
      ${q ? 'AND (title LIKE ? OR author LIKE ? OR summary LIKE ?)' : ''}
      ORDER BY dynasty
    `).all(...(q ? [`%${q}%`, `%${q}%`, `%${q}%`] : []));

    const publishers = db.prepare(`
      SELECT DISTINCT publisher FROM versions 
      WHERE publisher IS NOT NULL AND publisher != ''
      ${q ? 'AND (version_name LIKE ? OR description LIKE ?)' : ''}
      ORDER BY publisher
    `).all(...(q ? [`%${q}%`, `%${q}%`] : []));

    const relationTypes = db.prepare(`
      SELECT DISTINCT relation_type FROM refs 
      WHERE relation_type IS NOT NULL AND relation_type != ''
      ORDER BY relation_type
    `).all();

    const pubYears = db.prepare(`
      SELECT DISTINCT pub_year FROM versions 
      WHERE pub_year IS NOT NULL AND pub_year != ''
      ORDER BY pub_year DESC
    `).all();

    return {
      dynasties: dynasties.map(d => d.dynasty),
      publishers: publishers.map(p => p.publisher),
      relation_types: relationTypes.map(r => r.relation_type),
      pub_years: pubYears.map(y => y.pub_year)
    };
  });
}

module.exports = routes;

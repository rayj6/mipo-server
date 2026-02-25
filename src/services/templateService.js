const db = require('../db/connection');

function rowToTemplate(row, baseUrl = '') {
  if (!row) return null;
  let slotOptions = [1, 2, 3, 4];
  if (row.slot_options) {
    try {
      const parsed = JSON.parse(row.slot_options);
      if (Array.isArray(parsed)) slotOptions = parsed;
    } catch (_) {}
  }
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    imageUrl: baseUrl ? baseUrl + row.image_path : row.image_path,
    imagePath: row.image_path,
    slotCount: row.slot_count,
    slotOptions,
    isFree: !!row.is_free,
    htmlContent: row.html_content,
    cssContent: row.css_content || '',
  };
}

async function getAll(freeOnly = false) {
  const sql = freeOnly
    ? 'SELECT id, name, slug, slot_count, slot_options, is_free, image_path FROM templates WHERE is_free = 1 ORDER BY id'
    : 'SELECT id, name, slug, slot_count, slot_options, is_free, image_path FROM templates ORDER BY id';
  const rows = await db.query(sql);
  return rows;
}

async function getById(id) {
  const row = await db.queryOne(
    'SELECT id, name, slug, slot_count, slot_options, is_free, image_path, html_content, css_content FROM templates WHERE id = ?',
    [id]
  );
  return row;
}

async function getBySlug(slug) {
  const row = await db.queryOne(
    'SELECT id, name, slug, slot_count, slot_options, is_free, image_path, html_content, css_content FROM templates WHERE slug = ?',
    [slug]
  );
  return row;
}

async function getHtmlForStrip(id) {
  const row = await db.queryOne(
    'SELECT html_content, css_content FROM templates WHERE id = ?',
    [id]
  );
  if (!row) return null;
  let html = row.html_content || '';
  if (row.css_content && row.css_content.trim()) {
    const styleTag = '<style>\n' + row.css_content.trim() + '\n</style>';
    if (html.includes('</head>')) {
      html = html.replace('</head>', styleTag + '\n</head>');
    } else {
      html = styleTag + '\n' + html;
    }
  }
  return html;
}

async function update(id, data) {
  const allowed = ['name', 'slug', 'slot_count', 'slot_options', 'is_free', 'image_path', 'html_content', 'css_content'];
  const updates = [];
  const values = [];
  for (const key of allowed) {
    if (data[key] === undefined) continue;
    if (key === 'slot_options' && typeof data[key] === 'object') {
      updates.push('slot_options = ?');
      values.push(JSON.stringify(data[key]));
    } else if (key === 'is_free') {
      updates.push('is_free = ?');
      values.push(data[key] ? 1 : 0);
    } else {
      updates.push(key + ' = ?');
      values.push(data[key]);
    }
  }
  if (updates.length === 0) return null;
  values.push(id);
  await db.query(
    'UPDATE templates SET ' + updates.join(', ') + ', updated_at = NOW(3) WHERE id = ?',
    values
  );
  return getById(id);
}

module.exports = {
  getAll,
  getById,
  getBySlug,
  getHtmlForStrip,
  update,
  rowToTemplate,
};

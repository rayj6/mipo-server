const config = require('../config');
const db = require('../db/connection');
const templateService = require('../services/templateService');

async function listTemplates(req, res) {
  try {
    const rows = await templateService.getAll(false);
    const list = rows.map((row) => {
      let slotOptions = [1, 2, 3, 4];
      if (row.slot_options) {
        try {
          const p = JSON.parse(row.slot_options);
          if (Array.isArray(p)) slotOptions = p;
        } catch (_) {}
      }
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        slotCount: row.slot_count,
        slotOptions,
        isFree: !!row.is_free,
        imagePath: row.image_path,
      };
    });
    res.json(list);
  } catch (err) {
    console.error('admin listTemplates:', err);
    res.status(500).json({ error: err.message });
  }
}

async function getTemplate(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid template id' });
    const row = await templateService.getById(id);
    if (!row) return res.status(404).json({ error: 'Template not found' });
    let slotOptions = [1, 2, 3, 4];
    if (row.slot_options) {
      try {
        const p = JSON.parse(row.slot_options);
        if (Array.isArray(p)) slotOptions = p;
      } catch (_) {}
    }
    res.json({
      id: row.id,
      slug: row.slug,
      name: row.name,
      slotCount: row.slot_count,
      slotOptions,
      isFree: !!row.is_free,
      imagePath: row.image_path,
      htmlContent: row.html_content,
      cssContent: row.css_content || '',
    });
  } catch (err) {
    console.error('admin getTemplate:', err);
    res.status(500).json({ error: err.message });
  }
}

async function updateTemplate(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid template id' });
    const { name, slug, slotCount, slotOptions, isFree, imagePath, htmlContent, cssContent } = req.body;
    const data = {};
    if (name !== undefined) data.name = String(name);
    if (slug !== undefined) data.slug = String(slug).replace(/[^a-z0-9_-]/gi, '_');
    if (slotCount !== undefined) data.slot_count = Math.min(4, Math.max(1, parseInt(slotCount, 10) || 3));
    if (slotOptions !== undefined) data.slot_options = Array.isArray(slotOptions) ? slotOptions : [1, 2, 3, 4];
    if (isFree !== undefined) data.is_free = !!isFree;
    if (imagePath !== undefined) data.image_path = String(imagePath);
    if (htmlContent !== undefined) data.html_content = String(htmlContent);
    if (cssContent !== undefined) data.css_content = String(cssContent);
    const updated = await templateService.update(id, data);
    if (!updated) return res.status(404).json({ error: 'Template not found' });
    let slotOptionsParsed = [1, 2, 3, 4];
    if (updated.slot_options) {
      try {
        const p = JSON.parse(updated.slot_options);
        if (Array.isArray(p)) slotOptionsParsed = p;
      } catch (_) {}
    }
    res.json({
      id: updated.id,
      slug: updated.slug,
      name: updated.name,
      slotCount: updated.slot_count,
      slotOptions: slotOptionsParsed,
      isFree: !!updated.is_free,
      imagePath: updated.image_path,
    });
  } catch (err) {
    console.error('admin updateTemplate:', err);
    res.status(500).json({ error: err.message });
  }
}

async function listUsers(req, res) {
  try {
    const rows = await db.query(
      'SELECT id, email, display_name, language, is_admin, created_at FROM users ORDER BY id DESC LIMIT 500'
    );
    res.json(rows.map((r) => ({
      id: r.id,
      email: r.email,
      displayName: r.display_name,
      language: r.language,
      isAdmin: !!r.is_admin,
      createdAt: r.created_at,
    })));
  } catch (err) {
    console.error('admin listUsers:', err);
    res.status(500).json({ error: err.message });
  }
}

async function getConfig(req, res) {
  try {
    res.json({
      port: config.port,
      baseUrl: config.baseUrl,
      jwtExpiresIn: config.jwt.expiresIn,
      dbHost: config.db.host,
      dbName: config.db.database,
      removeBgConfigured: !!config.removeBg.apiKey,
    });
  } catch (err) {
    console.error('admin getConfig:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  listTemplates,
  getTemplate,
  updateTemplate,
  listUsers,
  getConfig,
};

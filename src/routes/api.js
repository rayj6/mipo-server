const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const config = require('../config');
const { getBaseUrl } = require('../utils/getBaseUrl');
const templateService = require('../services/templateService');
const tempPhotos = require('../services/tempPhotos');
const { apiHeavyLimiter } = require('../middleware/rateLimit');
const { buildStripImage, SLOT_WIDTH, SLOT_HEIGHT } = require('../../lib/stripImage');
const { removeBackground, compositeOnBackground } = require('../../lib/removeBg');

const router = express.Router();
const publicDir = path.join(__dirname, '../../public');
const backgroundsDir = path.join(publicDir, 'backgrounds');

async function getBackgroundsList(req) {
  const baseUrl = getBaseUrl(req);
  const list = [{ id: 'original', name: 'Keep original', imageUrl: null }];
  try {
    const files = await fs.readdir(backgroundsDir);
    for (const f of files) {
      if (/\.(jpg|jpeg|png|webp)$/i.test(f)) {
        const name = f.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
        list.push({ id: f, name, imageUrl: baseUrl + '/backgrounds/' + encodeURIComponent(f) });
      }
    }
  } catch (e) {
    if (e.code !== 'ENOENT') console.error('backgrounds list error:', e.message);
  }
  return list;
}

async function fetchImageAsBuffer(urlOrBase64) {
  if (urlOrBase64.startsWith('data:')) {
    const base64 = urlOrBase64.replace(/^data:image\/\w+;base64,/, '');
    return Buffer.from(base64, 'base64');
  }
  const res = await fetch(urlOrBase64);
  if (!res.ok) return null;
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

router.get('/templates', async (req, res) => {
  try {
    const baseUrl = getBaseUrl(req);
    const freeOnly = req.query.free_only === '1' || req.query.free_only === 'true';
    const rows = await templateService.getAll(freeOnly);
    const list = rows.map((row) => {
      let slotOptions = [1, 2, 3, 4];
      if (row.slot_options) {
        try {
          const parsed = JSON.parse(row.slot_options);
          if (Array.isArray(parsed)) slotOptions = parsed;
        } catch (_) {}
      }
      return {
        id: row.slug,
        numericId: row.id,
        name: row.name,
        imageUrl: baseUrl + row.image_path,
        slotOptions,
        slotCount: row.slot_count,
        isFree: !!row.is_free,
      };
    });
    res.json(list);
  } catch (err) {
    console.error('templates list error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/templates/:id/html', async (req, res) => {
  try {
    const id = req.params.id;
    const templateId = /^\d+$/.test(id) ? parseInt(id, 10) : null;
    let html = null;
    if (templateId) {
      html = await templateService.getHtmlForStrip(templateId);
    } else {
      const row = await templateService.getBySlug(id);
      if (row) html = await templateService.getHtmlForStrip(row.id);
    }
    if (!html) return res.status(404).send('Template not found');
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('template html error:', err);
    res.status(500).send('Error loading template');
  }
});

router.get('/backgrounds', async (req, res) => {
  try {
    const list = await getBackgroundsList(req);
    res.json(list);
  } catch (err) {
    console.error('backgrounds error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/temp/:id', (req, res) => {
  const entry = tempPhotos.get(req.params.id);
  if (!entry) return res.status(404).end();
  res.set('Content-Type', entry.mimeType || 'image/jpeg');
  res.send(entry.buffer);
});

router.post('/temp-upload', apiHeavyLimiter, (req, res) => {
  try {
    let { imageBase64 } = req.body;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }
    if (imageBase64.includes(',')) imageBase64 = imageBase64.split(',')[1];
    const buffer = Buffer.from(imageBase64, 'base64');
    const id = tempPhotos.randomId();
    tempPhotos.set(id, { buffer, mimeType: 'image/png' });
    const baseUrl = getBaseUrl(req);
    res.json({ imageUrl: baseUrl + '/api/temp/' + id });
  } catch (err) {
    console.error('temp-upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/generate-strip', apiHeavyLimiter, async (req, res) => {
  try {
    const { photoBase64s, title, names, date, slotCount: reqSlots, templateId, backgroundImageUrl, backgroundBase64 } = req.body;
    if (!Array.isArray(photoBase64s) || photoBase64s.length === 0) {
      return res.status(400).json({ error: 'photoBase64s array is required' });
    }
    const baseUrl = getBaseUrl(req);
    const slots = Math.min(4, Math.max(1, parseInt(reqSlots, 10) || photoBase64s.length));
    let templateRow = null;
    if (templateId != null && templateId !== '') {
      const idOrSlug = String(templateId);
      if (/^\d+$/.test(idOrSlug)) {
        templateRow = await templateService.getById(parseInt(idOrSlug, 10));
      } else {
        templateRow = await templateService.getBySlug(idOrSlug);
      }
    }
    if (!templateRow) {
      const all = await templateService.getAll(false);
      templateRow = all[0] ? await templateService.getById(all[0].id) : null;
    }
    if (!templateRow) {
      return res.status(500).json({ success: false, error: 'No templates configured' });
    }
    const removeBgKey = config.removeBg.apiKey;
    let backgroundBuffer = null;
    if (backgroundBase64 && typeof backgroundBase64 === 'string') {
      const b64 = backgroundBase64.includes(',') ? backgroundBase64.split(',')[1] : backgroundBase64;
      backgroundBuffer = Buffer.from(b64, 'base64');
    } else if (backgroundImageUrl && typeof backgroundImageUrl === 'string') {
      backgroundBuffer = await fetchImageAsBuffer(backgroundImageUrl);
    }

    const params = new URLSearchParams();
    params.set('slots', String(slots));
    params.set('date', date || '');
    params.set('names', names || '');
    params.set('title', title || '');

    const processedBuffers = [];
    for (let i = 0; i < photoBase64s.length; i++) {
      let data = photoBase64s[i];
      if (data && typeof data === 'string' && data.includes(',')) data = data.split(',')[1];
      if (!data) continue;
      let photoBuffer = Buffer.from(data, 'base64');

      if (removeBgKey && backgroundBuffer) {
        const noBg = await removeBackground(photoBuffer, removeBgKey);
        if (noBg) {
          photoBuffer = await compositeOnBackground(noBg, backgroundBuffer, SLOT_WIDTH, SLOT_HEIGHT);
        }
      }

      const id = tempPhotos.randomId();
      tempPhotos.set(id, { buffer: photoBuffer, mimeType: 'image/jpeg' });
      params.set('photo' + (i + 1), baseUrl + '/api/temp/' + id);
      processedBuffers.push(photoBuffer);
    }

    const stripUrl = baseUrl + '/api/templates/' + templateRow.id + '/html?' + params.toString();

    const stripPng = await buildStripImage(processedBuffers, { slots });
    const imageBase64 = stripPng.toString('base64');

    res.json({ success: true, stripUrl, imageBase64, mimeType: 'image/png' });
  } catch (err) {
    console.error('generate-strip error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

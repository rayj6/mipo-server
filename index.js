require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const sharp = require('sharp');
const { buildStripImage, SLOT_WIDTH, SLOT_HEIGHT } = require('./lib/stripImage');
const { removeBackground, compositeOnBackground } = require('./lib/removeBg');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

const tempPhotos = new Map();
function randomId() {
  return 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
}

function getBaseUrl(req) {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '');
  const host = req.get('host');
  const protocol = req.protocol || 'http';
  return host ? protocol + '://' + host : 'http://localhost:' + PORT;
}

const TEMPLATES = [
  { id: 'template_1', name: 'Watercolor', slotOptions: [2, 3, 4], slotCount: 3, templateFile: 'template_1.html', imagePath: '/templates/template_1.png' },
  { id: 'template_2', name: 'Film Strip', slotOptions: [2, 3, 4], slotCount: 3, templateFile: 'template_2.html', imagePath: '/templates/template_2.png' },
];

const backgroundsDir = path.join(publicDir, 'backgrounds');

function getBackgroundsList(req) {
  const baseUrl = getBaseUrl(req);
  const list = [{ id: 'original', name: 'Keep original', imageUrl: null }];
  try {
    if (fs.existsSync(backgroundsDir)) {
      const files = fs.readdirSync(backgroundsDir).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f));
      for (const f of files) {
        const name = f.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
        list.push({ id: f, name, imageUrl: baseUrl + '/backgrounds/' + encodeURIComponent(f) });
      }
    }
  } catch (_) {}
  return list;
}

app.get('/api/templates', (req, res) => {
  const baseUrl = getBaseUrl(req);
  res.json(TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    imageUrl: baseUrl + t.imagePath,
    slotOptions: t.slotOptions,
    slotCount: t.slotCount,
  })));
});

app.get('/api/backgrounds', (req, res) => {
  res.json(getBackgroundsList(req));
});

app.get('/api/temp/:id', (req, res) => {
  const entry = tempPhotos.get(req.params.id);
  if (!entry) return res.status(404).end();
  res.set('Content-Type', entry.mimeType || 'image/jpeg');
  res.send(entry.buffer);
});

app.post('/api/temp-upload', (req, res) => {
  try {
    let { imageBase64 } = req.body;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }
    if (imageBase64.includes(',')) imageBase64 = imageBase64.split(',')[1];
    const buffer = Buffer.from(imageBase64, 'base64');
    const id = randomId();
    tempPhotos.set(id, { buffer, mimeType: 'image/png' });
    const baseUrl = getBaseUrl(req);
    res.json({ imageUrl: baseUrl + '/api/temp/' + id });
  } catch (err) {
    console.error('temp-upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

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

app.post('/api/generate-strip', async (req, res) => {
  try {
    const { photoBase64s, title, names, date, slotCount: reqSlots, templateId, backgroundImageUrl, backgroundBase64 } = req.body;
    if (!Array.isArray(photoBase64s) || photoBase64s.length === 0) {
      return res.status(400).json({ error: 'photoBase64s array is required' });
    }
    const baseUrl = getBaseUrl(req);
    const slots = Math.min(4, Math.max(2, parseInt(reqSlots, 10) || photoBase64s.length));
    const t = TEMPLATES.find((x) => x.id === templateId) || TEMPLATES[0];
    const templateFile = t.templateFile;
    const removeBgKey = process.env.REMOVE_BG_API_KEY;
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

      const id = randomId();
      tempPhotos.set(id, { buffer: photoBuffer, mimeType: 'image/jpeg' });
      params.set('photo' + (i + 1), baseUrl + '/api/temp/' + id);
      processedBuffers.push(photoBuffer);
    }

    const stripUrl = baseUrl + '/' + templateFile + '?' + params.toString();

    const stripPng = await buildStripImage(processedBuffers, { slots });
    const imageBase64 = stripPng.toString('base64');

    res.json({ success: true, stripUrl, imageBase64, mimeType: 'image/png' });
  } catch (err) {
    console.error('generate-strip error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log('Mipo server http://localhost:' + PORT);
  console.log('  GET  /api/templates, /api/backgrounds');
  console.log('  POST /api/generate-strip → { stripUrl, imageBase64 }');
  console.log('  POST /api/temp-upload → { imageUrl }');
  console.log('  GET  /save-frame.html?imageUrl=... (3:4 save frame)');
});

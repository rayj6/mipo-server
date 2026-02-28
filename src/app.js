const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const routes = require('./routes');
const db = require('./db/connection');

const app = express();

const corsOptions = config.cors?.allowedOrigins?.length
  ? { origin: config.cors.allowedOrigins, credentials: true }
  : {};

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));

const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));

app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/health/ready', async (req, res) => {
  try {
    await db.queryOne('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

app.get('/admin', (req, res) => {
  res.redirect('/admin/index.html');
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'An unexpected error occurred' });
});

module.exports = app;

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const routes = require('./routes');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));

app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/admin', (req, res) => {
  res.redirect('/admin/index.html');
});

module.exports = app;

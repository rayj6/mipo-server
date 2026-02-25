const config = require('../config');

function getBaseUrl(req) {
  if (config.baseUrl) return config.baseUrl.replace(/\/$/, '');
  const host = req.get('host');
  const protocol = req.protocol || 'http';
  return host ? protocol + '://' + host : 'http://localhost:' + config.port;
}

module.exports = { getBaseUrl };

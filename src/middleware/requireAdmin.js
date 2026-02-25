const db = require('../db/connection');

async function requireAdmin(req, res, next) {
  if (!req.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const row = await db.queryOne('SELECT is_admin FROM users WHERE id = ?', [req.userId]);
    if (!row || !row.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (err) {
    console.error('requireAdmin error:', err);
    return res.status(500).json({ error: 'Request failed' });
  }
}

module.exports = { requireAdmin };

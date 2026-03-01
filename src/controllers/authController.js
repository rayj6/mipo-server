const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');
const db = require('../db/connection');

const SALT_ROUNDS = 12;
const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;

const ALLOWED_LANGUAGES = ['en', 'vi', 'es', 'fr', 'ja', 'zh', 'fil', 'my'];
const ALLOWED_PLANS = ['FREE', 'WEEKLY', 'PRO', 'ANNUAL'];

function hasPaidAccess(row) {
  if (!row) return false;
  if (row.is_admin) return true;
  const plan = (row.plan_id || 'FREE').toUpperCase();
  if (plan !== 'FREE' && plan !== '') return true;
  const expiresAt = row.subscription_expires_at ? new Date(row.subscription_expires_at) : null;
  if (expiresAt && expiresAt > new Date()) return true;
  return false;
}

function toSafeUser(row) {
  if (!row) return null;
  const lang = row.language && ALLOWED_LANGUAGES.includes(row.language) ? row.language : 'en';
  const planId = (row.plan_id || 'FREE').toUpperCase();
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    language: lang,
    isAdmin: !!(row.is_admin),
    planId: ALLOWED_PLANS.includes(planId) ? planId : 'FREE',
    subscriptionExpiresAt: row.subscription_expires_at ? new Date(row.subscription_expires_at).toISOString() : null,
    hasPaidAccess: hasPaidAccess(row),
  };
}

async function register(req, res) {
  try {
    const { email, password, displayName } = req.body;
    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = (displayName && typeof displayName === 'string' ? displayName.trim() : '') || trimmedEmail.split('@')[0];
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existing = await db.queryOne('SELECT id FROM users WHERE email = ?', [trimmedEmail]);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await db.execute(
      'INSERT INTO users (email, password_hash, display_name, language, plan_id) VALUES (?, ?, ?, ?, ?)',
      [trimmedEmail, passwordHash, trimmedName, 'en', 'FREE']
    );
    const userId = result.insertId;
    const user = { id: userId, email: trimmedEmail, displayName: trimmedName, language: 'en' };
    const token = jwt.sign(
      { userId, email: trimmedEmail },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    return res.status(201).json({ user, token });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Registration failed' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const trimmedEmail = email.trim().toLowerCase();

    const row = await db.queryOne(
      'SELECT id, email, password_hash, display_name, language, is_admin, plan_id, subscription_expires_at FROM users WHERE email = ?',
      [trimmedEmail]
    );
    if (!row) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const valid = await bcrypt.compare(password, row.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = toSafeUser(row);
    const token = jwt.sign(
      { userId: row.id, email: row.email },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    return res.json({ user, token });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
}

async function me(req, res) {
  try {
    const row = await db.queryOne(
      'SELECT id, email, display_name, language, is_admin, plan_id, subscription_expires_at FROM users WHERE id = ?',
      [req.userId]
    );
    if (!row) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(toSafeUser(row));
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ error: 'Request failed' });
  }
}

async function updateProfile(req, res) {
  try {
    const { language, planId, subscriptionExpiresAt } = req.body;
    if (language != null) {
      if (typeof language !== 'string' || !ALLOWED_LANGUAGES.includes(language)) {
        return res.status(400).json({ error: 'Invalid language. Allowed: en, vi, es, fr, ja, zh, fil, my' });
      }
      await db.query('UPDATE users SET language = ?, updated_at = NOW(3) WHERE id = ?', [language, req.userId]);
    }
    if (planId != null) {
      const plan = (typeof planId === 'string' ? planId.trim().toUpperCase() : '') || 'FREE';
      if (!ALLOWED_PLANS.includes(plan)) {
        return res.status(400).json({ error: 'Invalid planId. Allowed: FREE, WEEKLY, PRO, ANNUAL' });
      }
      let expiresVal = null;
      if (subscriptionExpiresAt != null) {
        const d = new Date(subscriptionExpiresAt);
        if (Number.isNaN(d.getTime())) {
          return res.status(400).json({ error: 'Invalid subscriptionExpiresAt date' });
        }
        expiresVal = d.toISOString().slice(0, 23).replace('T', ' ');
      }
      await db.query(
        'UPDATE users SET plan_id = ?, subscription_expires_at = ?, updated_at = NOW(3) WHERE id = ?',
        [plan, expiresVal, req.userId]
      );
    } else if (subscriptionExpiresAt != null) {
      let expiresVal = null;
      const d = new Date(subscriptionExpiresAt);
      if (!Number.isNaN(d.getTime())) expiresVal = d.toISOString().slice(0, 23).replace('T', ' ');
      await db.query('UPDATE users SET subscription_expires_at = ?, updated_at = NOW(3) WHERE id = ?', [expiresVal, req.userId]);
    }
    const row = await db.queryOne(
      'SELECT id, email, display_name, language, is_admin, plan_id, subscription_expires_at FROM users WHERE id = ?',
      [req.userId]
    );
    if (!row) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(toSafeUser(row));
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ error: 'Request failed' });
  }
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }
    const trimmedEmail = email.trim().toLowerCase();

    const user = await db.queryOne('SELECT id FROM users WHERE email = ?', [trimmedEmail]);
    if (!user) {
      return res.json({ message: 'If an account exists with this email, you will receive a reset link.' });
    }

    const rawToken = crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

    await db.query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [user.id, tokenHash, expiresAt]
    );

    // In production you would send email with reset link containing rawToken.
    // For API-only flow we return the token in response (dev/testing). For production, remove the token from response.
    const includeToken = process.env.NODE_ENV !== 'production';
    return res.json({
      message: 'If an account exists with this email, you will receive a reset link.',
      ...(includeToken && { resetToken: rawToken, expiresAt: expiresAt.toISOString() }),
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: 'Request failed' });
  }
}

async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body;
    if (!token || typeof token !== 'string' || !newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({ error: 'Token and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const tokenHash = hashToken(token);
    const row = await db.queryOne(
      'SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ?',
      [tokenHash]
    );
    if (!row) {
      return res.status(400).json({ error: 'Invalid or expired reset token.' });
    }
    if (row.used_at) {
      return res.status(400).json({ error: 'This reset link has already been used.' });
    }
    if (new Date() > new Date(row.expires_at)) {
      return res.status(400).json({ error: 'Invalid or expired reset token.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await db.query('UPDATE users SET password_hash = ?, updated_at = NOW(3) WHERE id = ?', [passwordHash, row.user_id]);
    await db.query('UPDATE password_reset_tokens SET used_at = NOW(3) WHERE id = ?', [row.id]);

    return res.json({ message: 'Password has been reset. You can log in with your new password.' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Request failed' });
  }
}

async function deleteAccount(req, res) {
  try {
    const { password } = req.body;
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required to delete your account.' });
    }

    const row = await db.queryOne(
      'SELECT id, password_hash FROM users WHERE id = ?',
      [req.userId]
    );
    if (!row) {
      return res.status(404).json({ error: 'User not found' });
    }
    const valid = await bcrypt.compare(password, row.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid password.' });
    }

    await db.query('DELETE FROM users WHERE id = ?', [req.userId]);
    return res.json({ message: 'Account has been deleted.' });
  } catch (err) {
    console.error('Delete account error:', err);
    return res.status(500).json({ error: 'Request failed' });
  }
}

module.exports = { register, login, me, updateProfile, forgotPassword, resetPassword, deleteAccount, hasPaidAccess };

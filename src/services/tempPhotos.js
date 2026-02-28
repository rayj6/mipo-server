const config = require('../config');

const store = new Map();
const meta = new Map();
const { maxEntries = 10000, ttlMs = 3600000 } = config.tempPhotos || {};

function randomId() {
  return 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
}

function evictIfNeeded() {
  if (store.size < maxEntries) return;
  const entries = [];
  for (const [id, data] of store.entries()) {
    const m = meta.get(id);
    entries.push({ id, at: m?.at ?? 0 });
  }
  entries.sort((a, b) => a.at - b.at);
  const toRemove = Math.min(Math.ceil(maxEntries * 0.1), entries.length);
  for (let i = 0; i < toRemove; i++) {
    store.delete(entries[i].id);
    meta.delete(entries[i].id);
  }
}

function set(id, data) {
  evictIfNeeded();
  store.set(id, data);
  meta.set(id, { at: Date.now() });
}

function get(id) {
  const m = meta.get(id);
  if (m && ttlMs > 0 && Date.now() - m.at > ttlMs) {
    store.delete(id);
    meta.delete(id);
    return null;
  }
  return store.get(id) || null;
}

function cleanupExpired() {
  if (ttlMs <= 0) return;
  const now = Date.now();
  for (const [id, m] of meta.entries()) {
    if (now - m.at > ttlMs) {
      store.delete(id);
      meta.delete(id);
    }
  }
}

const cleanupInterval = setInterval(cleanupExpired, 5 * 60 * 1000);
cleanupInterval.unref?.();

module.exports = { store, randomId, set, get };

const store = new Map();

function randomId() {
  return 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
}

function set(id, data) {
  store.set(id, data);
}

function get(id) {
  return store.get(id) || null;
}

module.exports = { store, randomId, set, get };

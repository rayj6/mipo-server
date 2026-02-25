const { runMigrations } = require('./src/db/migrations');
const config = require('./src/config');
const app = require('./src/app');

async function start() {
  try {
    await runMigrations();
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    console.log('Mipo server http://localhost:' + config.port);
    console.log('  Auth:  POST /api/auth/register, /api/auth/login, /api/auth/forgot-password, /api/auth/reset-password');
    console.log('  Auth:  GET  /api/auth/me (Bearer token)');
    console.log('  API:   GET  /api/templates, /api/backgrounds');
    console.log('  API:   POST /api/generate-strip, /api/temp-upload');
    console.log('  GET  /api/temp/:id, /health');
  });

  const shutdown = () => {
    server.close(() => {
      const db = require('./src/db/connection');
      db.close().then(() => process.exit(0));
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((err) => {
  console.error('Startup error:', err);
  process.exit(1);
});

require('dotenv').config();

const required = ['JWT_SECRET', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missing = required.filter((key) => !process.env[key] || process.env[key].trim() === '');
if (missing.length) {
  console.error('Missing required env vars:', missing.join(', '));
  process.exit(1);
}

module.exports = {
  port: parseInt(process.env.PORT || '3001', 10),
  baseUrl: process.env.BASE_URL || null,
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  db: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  },
  removeBg: {
    apiKey: process.env.REMOVE_BG_API_KEY || null,
  },
};

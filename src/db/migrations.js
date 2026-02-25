const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const TEMPLATE_SEED = [
  { slug: 'template_1', name: 'Watercolor', slotCount: 3, imagePath: '/templates/images/template_1.png' },
  { slug: 'template_2', name: 'Film Strip', slotCount: 3, imagePath: '/templates/images/template_2.png' },
  { slug: 'template_3', name: 'Prom Night', slotCount: 3, imagePath: '/templates/images/template_3.png' },
  { slug: 'template_4', name: 'Prom Night Sky', slotCount: 3, imagePath: '/templates/images/template_4.png' },
  { slug: 'template_5', name: 'Classic', slotCount: 2, imagePath: '/templates/images/template_5.png' },
  { slug: 'template_6', name: 'Lavender', slotCount: 4, imagePath: '/templates/images/template_6.png' },
  { slug: 'template_7', name: 'Clapperboard', slotCount: 2, imagePath: '/templates/images/template_7.png' },
  { slug: 'template_8', name: 'Vintage Film', slotCount: 3, imagePath: '/templates/images/template_8.png' },
  { slug: 'template_9', name: 'Happy Birthday', slotCount: 3, imagePath: '/templates/images/template_9.png' },
  { slug: 'template_10', name: 'Peach', slotCount: 4, imagePath: '/templates/images/template_10.png' },
];

async function runMigrations() {
  const { host, user, password, database, port } = config.db;
  const connection = await mysql.createConnection({
    host,
    user,
    password,
    port,
    multipleStatements: true,
  });

  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE \`${database}\``);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(255) NOT NULL DEFAULT '',
        language VARCHAR(10) NOT NULL DEFAULT 'en',
        is_admin TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        UNIQUE KEY uq_email (email),
        KEY idx_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    try {
      await connection.query(`
        ALTER TABLE users ADD COLUMN language VARCHAR(10) NOT NULL DEFAULT 'en' AFTER display_name
      `);
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    }

    try {
      await connection.query(`
        ALTER TABLE users ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0 AFTER language
      `);
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS templates (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(64) NOT NULL,
        slot_count TINYINT UNSIGNED NOT NULL DEFAULT 3,
        slot_options JSON NULL,
        is_free TINYINT(1) NOT NULL DEFAULT 1,
        image_path VARCHAR(512) NOT NULL DEFAULT '',
        html_content LONGTEXT NOT NULL,
        css_content TEXT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        UNIQUE KEY uq_slug (slug)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        expires_at DATETIME(3) NOT NULL,
        used_at DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        KEY idx_user_expires (user_id, expires_at),
        KEY idx_token_hash (token_hash(64)),
        CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const publicDir = path.join(__dirname, '../../public');
    const [rows] = await connection.query('SELECT COUNT(*) AS n FROM templates');
    if (rows[0].n === 0) {
      const slotOptionsJson = JSON.stringify([1, 2, 3, 4]);
      for (const t of TEMPLATE_SEED) {
        const htmlPath = path.join(publicDir, t.slug + '.html');
        let htmlContent = '';
        if (fs.existsSync(htmlPath)) {
          htmlContent = fs.readFileSync(htmlPath, 'utf8');
        } else {
          htmlContent = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + t.name + '</title></head><body><p>Template ' + t.slug + '</p></body></html>';
        }
        await connection.query(
          `INSERT INTO templates (name, slug, slot_count, slot_options, is_free, image_path, html_content, css_content) VALUES (?, ?, ?, ?, 1, ?, ?, '')`,
          [t.name, t.slug, t.slotCount, slotOptionsJson, t.imagePath, htmlContent]
        );
      }
      console.log('Seeded', TEMPLATE_SEED.length, 'templates.');
    }

    console.log('Database migrations completed.');
  } finally {
    await connection.end();
  }
}

module.exports = { runMigrations };

const sharp = require('sharp');

const REMOVE_BG_API = 'https://api.remove.bg/v1.0/removebg';

/**
 * Remove background from image buffer using remove.bg API.
 * @param {Buffer} imageBuffer
 * @param {string} apiKey
 * @returns {Promise<Buffer|null>} PNG buffer with transparent bg, or null on failure
 */
async function removeBackground(imageBuffer, apiKey) {
  const form = new FormData();
  form.append('size', 'auto');
  form.append('image_file', new Blob([imageBuffer], { type: 'image/jpeg' }), 'photo.jpg');

  const res = await fetch(REMOVE_BG_API, {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn('remove.bg error:', res.status, text);
    return null;
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Composite no-background image onto a background image (resized to slot size).
 * @param {Buffer} noBgPng - PNG with transparency
 * @param {Buffer} backgroundImage - JPEG/PNG buffer
 * @param {number} width - slot width
 * @param {number} height - slot height
 */
async function compositeOnBackground(noBgPng, backgroundImage, width, height) {
  const bgResized = await sharp(backgroundImage)
    .resize(width, height, { fit: 'cover' })
    .toBuffer();

  const noBgResized = await sharp(noBgPng)
    .resize(width, height, { fit: 'contain', position: 'center' })
    .toBuffer();

  return sharp(bgResized)
    .composite([{ input: noBgResized, left: 0, top: 0 }])
    .jpeg({ quality: 90 })
    .toBuffer();
}

module.exports = { removeBackground, compositeOnBackground };

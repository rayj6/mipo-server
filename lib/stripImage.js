const sharp = require('sharp');

const STRIP_WIDTH = 280;
const SLOT_WIDTH = 252;
const SLOT_HEIGHT = 336;
const PADDING_TOP = 24;
const GAP = 14;
const PADDING_BOTTOM = 100;

/**
 * Build a strip PNG from an array of photo buffers (same order as slots).
 * @param {Buffer[]} photoBuffers - JPEG/PNG buffers, one per slot
 * @param {{ slots: number, backgroundColor?: string }} options
 * @returns {Promise<Buffer>} PNG buffer
 */
async function buildStripImage(photoBuffers, options = {}) {
  const slots = Math.min(4, Math.max(1, options.slots || photoBuffers.length));
  const bgColor = options.backgroundColor || '#e8e9eb';
  const height = PADDING_TOP + slots * SLOT_HEIGHT + (slots - 1) * GAP + PADDING_BOTTOM;

  const slotX = Math.floor((STRIP_WIDTH - SLOT_WIDTH) / 2);
  const composites = [];

  for (let i = 0; i < photoBuffers.length && i < slots; i++) {
    const buf = photoBuffers[i];
    if (!buf || !Buffer.isBuffer(buf)) continue;
    const y = PADDING_TOP + i * (SLOT_HEIGHT + GAP);
    const resized = await sharp(buf)
      .resize(SLOT_WIDTH, SLOT_HEIGHT, { fit: 'cover' })
      .toBuffer();
    composites.push({
      input: resized,
      left: slotX,
      top: y,
    });
  }

  const base = await sharp({
    create: {
      width: STRIP_WIDTH,
      height,
      channels: 3,
      background: bgColor,
    },
  })
    .png()
    .composite(composites)
    .toBuffer();

  return base;
}

module.exports = { buildStripImage, STRIP_WIDTH, SLOT_HEIGHT, SLOT_WIDTH };

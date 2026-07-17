#!/usr/bin/env node
/**
 * Generates placeholder PNG images for PWA screenshots.
 * Uses only Node.js built-in modules — no external dependencies.
 *
 * Usage: node scripts/generate-placeholders.mjs
 */

import { writeFileSync } from 'fs';
import { deflateSync } from 'zlib';

// ── Pure-JS minimal PNG encoder (no canvas dependency needed) ──────────────
// This creates a valid PNG with a solid background color.

function createPNG(width, height, r, g, b) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // color type: RGB
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = makeChunk('IHDR', ihdrData);

  // IDAT chunk — raw pixel data
  const rawData = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const offset = y * (1 + width * 3);
    rawData[offset] = 0; // filter byte: None
    for (let x = 0; x < width; x++) {
      const pixelOffset = offset + 1 + x * 3;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
    }
  }
  const compressed = deflateSync(rawData);
  const idat = makeChunk('IDAT', compressed);

  // IEND chunk
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function makeChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ── Generate the two screenshot placeholders ───────────────────────────────

// Desktop: 1280x720, dark slate background (#0f172a)
const desktop = createPNG(1280, 720, 15, 23, 42);
writeFileSync('public/screenshots/desktop.png', desktop);
console.log(`✓ Created public/screenshots/desktop.png (1280x720, ${desktop.length} bytes)`);

// Mobile: 750x1334, dark slate background (#0f172a)
const mobile = createPNG(750, 1334, 15, 23, 42);
writeFileSync('public/screenshots/mobile.png', mobile);
console.log(`✓ Created public/screenshots/mobile.png (750x1334, ${mobile.length} bytes)`);

console.log('\nPlaceholder screenshots generated successfully.');
// Generates assets/icon.png — a 1024×1024 app icon using only Node built-ins.
// Red background with a white progress-ring motif and a 12 o'clock dot.
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length);
  const crc = Buffer.allocUnsafe(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function buildPNG(size, raw) {
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = ihdr[11] = ihdr[12] = 0;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]);
}

function blend(fg, bg, a) { return Math.round(fg * a + bg * (1 - a)); }

function makeIconPNG(size) {
  const cx = size / 2, cy = size / 2;
  const outerR = size * 0.37;
  const innerR = size * 0.27;
  // Small cap circle at 12 o'clock, sitting on the ring
  const capR  = size * 0.055;
  const capCy = cy - (outerR + innerR) / 2; // midpoint of ring stroke at top

  // Background colour: tomato red
  const BG = [0xE8, 0x4A, 0x4A];

  const raw = Buffer.allocUnsafe(size * (size * 4 + 1));

  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // PNG scanline filter: None
    for (let x = 0; x < size; x++) {
      const i = y * (size * 4 + 1) + 1 + x * 4;
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Start with red background
      raw[i]   = BG[0];
      raw[i+1] = BG[1];
      raw[i+2] = BG[2];
      raw[i+3] = 255;

      // White ring (anti-aliased inner + outer edges)
      const ringA = Math.min(
        Math.max(0, Math.min(1, dist - innerR + 1.5)),
        Math.max(0, Math.min(1, outerR - dist + 1.5))
      );
      if (ringA > 0) {
        raw[i]   = blend(255, raw[i],   ringA);
        raw[i+1] = blend(255, raw[i+1], ringA);
        raw[i+2] = blend(255, raw[i+2], ringA);
      }

      // White filled cap at 12 o'clock
      const capDx = x + 0.5 - cx, capDy = y + 0.5 - capCy;
      const capA = Math.max(0, Math.min(1, capR - Math.sqrt(capDx * capDx + capDy * capDy) + 1));
      if (capA > 0) {
        raw[i]   = blend(255, raw[i],   capA);
        raw[i+1] = blend(255, raw[i+1], capA);
        raw[i+2] = blend(255, raw[i+2], capA);
      }
    }
  }

  return buildPNG(size, raw);
}

fs.mkdirSync(path.join(__dirname, 'assets'), { recursive: true });
const dest = path.join(__dirname, 'assets', 'icon.png');
fs.writeFileSync(dest, makeIconPNG(1024));
console.log('Icon written →', dest);

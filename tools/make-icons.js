// Generates the app icons (PNG) with no dependencies: `node tools/make-icons.js`
// Orange tile with a cream donut chart and one dark slice.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function png(size, px) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    px.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const BG = [0xff, 0x5a, 0x1f], CREAM = [0xf5, 0xf1, 0xea], INK = [0x14, 0x14, 0x14];
function color(x, y) {
  // normalized coords, centre (0,0), range -0.5..0.5
  const r = Math.hypot(x, y);
  const outer = 0.31, inner = 0.17, gap = 0.012;
  if (r > outer || r < inner) return BG;
  let a = Math.atan2(x, -y); // 0 at 12 o'clock, clockwise
  if (a < 0) a += Math.PI * 2;
  const sliceEnd = Math.PI * 2 * 0.28; // dark slice: first 28%
  // thin gaps between segments
  const distTo = (ang) => Math.abs(Math.sin(a - ang)) * r;
  if ((distTo(0) < gap && Math.cos(a) > 0) || (distTo(sliceEnd) < gap && Math.cos(a - sliceEnd) > 0)) return BG;
  return a < sliceEnd ? INK : CREAM;
}

function render(size) {
  const px = Buffer.alloc(size * size * 3);
  const SS = 4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = color((x + (sx + 0.5) / SS) / size - 0.5, (y + (sy + 0.5) / SS) / size - 0.5);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const i = (y * size + x) * 3, n = SS * SS;
      px[i] = r / n; px[i + 1] = g / n; px[i + 2] = b / n;
    }
  }
  return png(size, px);
}

const out = path.join(__dirname, '..', 'icons');
fs.mkdirSync(out, { recursive: true });
for (const s of [180, 192, 512]) {
  fs.writeFileSync(path.join(out, `icon-${s}.png`), render(s));
  console.log('wrote', `icons/icon-${s}.png`);
}

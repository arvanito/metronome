// Generates the PNG app icons (public/icons/icon-*.png) without any dependencies.
// The drawing mirrors public/icons/icon.svg, on a full-bleed background so it also
// works as a maskable icon. Run with: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [0x14, 0x17, 0x1f];
const ACCENT = [0xff, 0x7a, 0x45];
const LIGHT = [0xf5, 0xf5, 0xf5];

// Shapes in 0..1 coordinates, matching the 100×100 SVG. Later shapes paint on top.
const shapes = [
  { color: ACCENT, hit: (x, y) => inTriangle(x, y, [0.5, 0.22], [0.71, 0.76], [0.29, 0.76]) },
  { color: ACCENT, hit: (x, y) => x >= 0.27 && x <= 0.73 && y >= 0.74 && y <= 0.8 },
  { color: LIGHT, hit: (x, y) => distToSegment(x, y, [0.5, 0.7], [0.61, 0.3]) <= 0.0175 },
  { color: LIGHT, hit: (x, y) => Math.hypot(x - 0.585, y - 0.39) <= 0.04 },
];

function inTriangle(x, y, a, b, c) {
  const side = (p, q) => (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
  const d1 = side(a, b), d2 = side(b, c), d3 = side(c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

function distToSegment(x, y, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

function render(size, samples = 4) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const sum = [0, 0, 0];
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const x = (px + (sx + 0.5) / samples) / size;
          const y = (py + (sy + 0.5) / samples) / size;
          let color = BG;
          for (const s of shapes) if (s.hit(x, y)) color = s.color;
          for (let c = 0; c < 3; c++) sum[c] += color[c];
        }
      }
      const i = (py * size + px) * 4;
      for (let c = 0; c < 3; c++) rgba[i + c] = Math.round(sum[c] / samples ** 2);
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA, no interlace
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = new URL('../public/icons/', import.meta.url);
mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(new URL(`icon-${size}.png`, outDir), encodePng(size, render(size)));
  console.log(`wrote public/icons/icon-${size}.png`);
}

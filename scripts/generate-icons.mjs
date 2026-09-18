// Generates MilkFlow PWA PNG icons with zero dependencies (Node zlib + CRC32).
// Usage: node scripts/generate-icons.mjs  (writes into public/icons/)
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(root, { recursive: true });

const EMERALD = [16, 185, 129, 255];
const WHITE = [255, 255, 255, 255];

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function writePng(path, w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
  console.log('wrote', path);
}

// Milk droplet: circle + upward triangle union, on emerald rounded square.
function render(size, dropletScale, padForMaskable) {
  const buf = Buffer.alloc(size * size * 4);
  const radius = size * 0.22;
  const cx = size / 2;
  const cy = size / 2;
  const rr = padForMaskable ? size * 0.5 : size * 0.28; // maskable: full bleed
  const r = dropletScale * size * 0.16;
  const triTop = cy - r * 2.1;
  const circCy = cy + r * 0.55;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // background: rounded square (or full bleed for maskable)
      const dx = Math.max(Math.abs(x - cx) - (size / 2 - rr), 0);
      const dy = Math.max(Math.abs(y - cy) - (size / 2 - rr), 0);
      const inBg = padForMaskable ? true : dx * dx + dy * dy <= rr * rr;
      let px = inBg ? EMERALD : [0, 0, 0, 0];
      if (inBg) {
        // droplet union
        const dcx = x - cx;
        const dcy = y - circCy;
        const inCircle = dcx * dcx + dcy * dcy <= r * r;
        // triangle: apex at (cx, triTop), base half-width r at circCy
        let inTri = false;
        if (y >= triTop && y <= circCy) {
          const t = (y - triTop) / (circCy - triTop);
          inTri = Math.abs(dcx) <= r * t;
        }
        if (inCircle || inTri) px = WHITE;
      }
      const o = (y * size + x) * 4;
      buf[o] = px[0]; buf[o + 1] = px[1]; buf[o + 2] = px[2]; buf[o + 3] = px[3];
    }
  }
  return buf;
}

writePng(join(root, 'icon-192.png'), 192, 192, render(192, 1, false));
writePng(join(root, 'icon-512.png'), 512, 512, render(512, 1, false));
writePng(join(root, 'maskable-512.png'), 512, 512, render(512, 0.78, true));
writePng(join(root, 'apple-touch-icon.png'), 180, 180, render(180, 1, false));

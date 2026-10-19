// PWA ikonkalarini kod bilan chizadi (tashqi kutubxonasiz): node scripts/make-icons.mjs
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
fs.mkdirSync(out, { recursive: true });

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

// "M" harfi (0..100 koordinatalarda)
const M = [[22, 78], [22, 24], [36, 24], [50, 48], [64, 24], [78, 24], [78, 78], [66, 78], [66, 44], [52, 70], [48, 70], [34, 44], [34, 78]];
function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** rounded: burchaklari yumaloq (oddiy ikonka); aks holda to‘liq kvadrat (maskable/apple). scale: harfning o‘lchami. */
function icon(size, { rounded, scale }) {
  const buf = Buffer.alloc(size * size * 4);
  const SS = 3;
  const r = size * 0.22;
  const bg = [37, 99, 235];
  const fg = [255, 255, 255];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let cov = 0;
      let letter = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          let inside = true;
          if (rounded) {
            const cx = Math.min(Math.max(px, r), size - r);
            const cy = Math.min(Math.max(py, r), size - r);
            inside = (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
          }
          if (!inside) continue;
          cov++;
          const ux = ((px / size - 0.5) / scale) * 100 + 50;
          const uy = ((py / size - 0.5) / scale) * 100 + 50;
          if (inPoly(ux, uy, M)) letter++;
        }
      }
      const total = SS * SS;
      const a = cov / total;
      const t = cov ? letter / cov : 0;
      const i = (y * size + x) * 4;
      buf[i] = Math.round(bg[0] * (1 - t) + fg[0] * t);
      buf[i + 1] = Math.round(bg[1] * (1 - t) + fg[1] * t);
      buf[i + 2] = Math.round(bg[2] * (1 - t) + fg[2] * t);
      buf[i + 3] = Math.round(a * 255);
    }
  }
  return png(size, buf);
}

const files = {
  "icon-192.png": icon(192, { rounded: true, scale: 0.8 }),
  "icon-512.png": icon(512, { rounded: true, scale: 0.8 }),
  "maskable-512.png": icon(512, { rounded: false, scale: 0.6 }), // xavfsiz zona ichida
  "apple-touch-icon.png": icon(180, { rounded: false, scale: 0.7 }),
};
for (const [name, data] of Object.entries(files)) fs.writeFileSync(path.join(out, name), data);
console.log("Ikonkalar yozildi:", Object.keys(files).join(", "));

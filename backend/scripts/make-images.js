// Rasmli savollar uchun SVG fayllarni yaratadi: npm run images
// Natija frontend/public/questions/ ichiga yoziladi va Git'ga qo‘shiladi.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { IMAGE_SPECS, COLOR } from "../src/questions/images.js";

const CELL = 76;
const PER_ROW = 5;

function shapeSvg(shape, color, cx, cy, r) {
  const fill = COLOR[color];
  switch (shape) {
    case "circle":
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;
    case "square":
      return `<rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" rx="${r * 0.18}" fill="${fill}"/>`;
    case "triangle":
      return `<polygon points="${cx},${cy - r} ${cx + r},${cy + r * 0.85} ${cx - r},${cy + r * 0.85}" fill="${fill}"/>`;
    case "star": {
      const pts = Array.from({ length: 10 }, (_, i) => {
        const rad = i % 2 === 0 ? r : r * 0.45;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        return `${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`;
      }).join(" ");
      return `<polygon points="${pts}" fill="${fill}"/>`;
    }
    case "apple":
      return `<circle cx="${cx}" cy="${cy + r * 0.1}" r="${r * 0.9}" fill="${fill}"/><rect x="${cx - 2}" y="${cy - r}" width="4" height="${r * 0.4}" fill="#78350f"/><ellipse cx="${cx + r * 0.35}" cy="${cy - r * 0.8}" rx="${r * 0.3}" ry="${r * 0.15}" fill="#16a34a"/>`;
    case "fish":
      return `<ellipse cx="${cx - r * 0.1}" cy="${cy}" rx="${r * 0.85}" ry="${r * 0.55}" fill="${fill}"/><polygon points="${cx + r * 0.7},${cy} ${cx + r * 1.1},${cy - r * 0.45} ${cx + r * 1.1},${cy + r * 0.45}" fill="${fill}"/><circle cx="${cx - r * 0.5}" cy="${cy - r * 0.1}" r="${r * 0.1}" fill="#fff"/>`;
    default:
      throw new Error(`Noma‘lum shakl: ${shape}`);
  }
}

export function renderSvg(spec) {
  const big = spec.items.length === 1 && spec.items[0].big;
  const cols = big ? 1 : Math.min(PER_ROW, spec.items.length);
  const rows = big ? 1 : Math.ceil(spec.items.length / PER_ROW);
  const cell = big ? 170 : CELL;
  const w = cols * cell + 20;
  const h = rows * cell + 20;
  const body = spec.items
    .map((it, i) => shapeSvg(it.shape, it.color, 10 + (i % PER_ROW) * cell + cell / 2, 10 + Math.floor(i / PER_ROW) * cell + cell / 2, cell * (big ? 0.38 : 0.3)))
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img"><title>${spec.alt}</title>${body}</svg>\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "frontend", "public", "questions");
  fs.mkdirSync(out, { recursive: true });
  for (const spec of IMAGE_SPECS) fs.writeFileSync(path.join(out, `${spec.id}.svg`), renderSvg(spec));
  console.log(`${IMAGE_SPECS.length} ta rasm yozildi: ${out}`);
}

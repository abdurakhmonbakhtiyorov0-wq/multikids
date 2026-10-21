// Tarjima qamrovini tekshiradi: koddagi barcha t("...") matnlari rus lug‘atida (lib/i18n-ru.ts) bormi?
// Ishga tushirish: npm run i18n:check  (yetishmaydigan matn bo‘lsa, 1 kod bilan chiqadi)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { RU } = await import(pathToFileURL(path.join(root, "lib", "i18n-ru.ts")).href);

const files = [];
const walk = (d) => {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) {
      if (f !== "three") walk(p);
    } else if (/\.tsx?$/.test(f) && !/i18n|translit|\.d\.ts/.test(f)) files.push(p);
  }
};
for (const d of ["app", "components", "lib"]) walk(path.join(root, d));

// Dinamik ko‘rsatiladigan, t() siz yozilgan matnlar (ular ham lug‘atda bo‘lishi kerak)
const extra = new Set();
const dataSrc = fs.readFileSync(path.join(root, "lib", "data.ts"), "utf8");
for (const m of dataSrc.matchAll(/\b(?:name|tagline|title|note|description): "([^"]+)"/g)) extra.add(m[1]);
const ui = fs.readFileSync(path.join(root, "components", "ui.tsx"), "utf8");
for (const m of ui.matchAll(/label: "([^"]+)"/g)) extra.add(m[1]);
const mv = fs.readFileSync(path.join(root, "components", "MascotView.tsx"), "utf8");
const block = mv.slice(mv.indexOf("MOOD_LABEL"), mv.indexOf("};", mv.indexOf("MOOD_LABEL")));
for (const m of block.matchAll(/: "([^"]+)"/g)) extra.add(m[1]);
["Qahramon", "Sinf", "Fan"].forEach((k) => extra.add(k));

const used = new Map();
for (const file of files) {
  const sf = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const rel = path.relative(root, file).split("\\").join("/");
  const visit = (n) => {
    if (ts.isCallExpression(n) && ["t", "tr"].includes(n.expression.getText(sf)) && n.arguments[0] && (ts.isStringLiteral(n.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(n.arguments[0]))) {
      const k = n.arguments[0].text;
      if (/[A-Za-z]/.test(k)) used.set(k, rel);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
for (const k of extra) used.set(k, "data/ui");

// Ruscha tarjimasi shart bo‘lmaganlar: nom, qisqartma, ruscha/inglizcha matn
const SKIP = new Set(["MultiKids", "M"]);
const missing = [...used].filter(([k]) => !(k in RU) && !SKIP.has(k) && !/[А-Яа-я]/.test(k));
if (missing.length) {
  console.error(`Rus lug‘atida yo‘q matnlar: ${missing.length}`);
  for (const [k, f] of missing) console.error(`  [${f}] ${k}`);
  process.exit(1);
}
const unusedRu = Object.keys(RU).length;
console.log(`OK: ${used.size} ta matn tekshirildi, lug‘atda ${unusedRu} ta yozuv bor.`);

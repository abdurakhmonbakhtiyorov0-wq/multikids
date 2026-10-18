import fs from "node:fs";
import path from "node:path";

// Oddiy JSON-fayl ombori. Yozish atomar: vaqtinchalik faylga yozib, keyin almashtiriladi.
const DATA_DIR = process.env.DATA_DIR || path.resolve("data");
const FILE = path.join(DATA_DIR, "db.json");

let state = { users: [], results: [] };

export function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(FILE)) state = JSON.parse(fs.readFileSync(FILE, "utf8"));
}

let writing = Promise.resolve();
export function save() {
  const snapshot = JSON.stringify(state, null, 2);
  writing = writing.then(async () => {
    const tmp = FILE + ".tmp";
    await fs.promises.writeFile(tmp, snapshot);
    await fs.promises.rename(tmp, FILE);
  });
  return writing;
}

export const db = {
  get users() {
    return state.users;
  },
  get results() {
    return state.results;
  },
};

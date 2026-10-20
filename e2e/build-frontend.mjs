// Frontend'ni E2E uchun yig‘adi: backend manzili 4100 portga qaratiladi, natija .next-e2e papkasiga yoziladi.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cwd = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "frontend");
const r = spawnSync("npx", ["next", "build"], { cwd, stdio: "inherit", shell: true, env: { ...process.env, NEXT_PUBLIC_API_URL: "http://localhost:4100", NEXT_DIST_DIR: ".next-e2e" } });
process.exit(r.status ?? 1);

// Testlar uchun haqiqiy PostgreSQL: TEST_DATABASE_URL berilsa shu, aks holda embedded-postgres (vaqtinchalik).
// Serverni pg_ctl orqali ishga tushiramiz: u administrator huquqlarini o‘zi pasaytiradi (Windows'da kerak).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const freePort = () =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });

async function startEmbedded() {
  const { default: EmbeddedPostgres } = await import("embedded-postgres");
  const pkg = { win32: "windows-x64", linux: `linux-${process.arch}`, darwin: `darwin-${process.arch}` }[process.platform];
  const here = path.dirname(fileURLToPath(import.meta.url));
  const bin = path.join(here, "..", "node_modules", "@embedded-postgres", pkg, "native", "bin");
  const ctl = path.join(bin, process.platform === "win32" ? "pg_ctl.exe" : "pg_ctl");

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "multikids-pg-"));
  const port = await freePort();
  const helper = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "pw", port, persistent: false, initdbFlags: ["--encoding=UTF8", "--locale=C"], onLog: () => {}, onError: () => {} });
  await helper.initialise();
  execFileSync(ctl, ["-D", dir, "-o", `-p ${port}`, "-w", "-l", path.join(dir, "server.log"), "start"], { stdio: "ignore" });
  const url = (db) => `postgresql://postgres:pw@localhost:${port}/${db}`;
  const { default: pg } = await import("pg");
  const admin = new pg.Client({ connectionString: url("postgres") });
  await admin.connect();
  await admin.query("CREATE DATABASE multikids_test");
  await admin.end();
  return {
    url: url("multikids_test"),
    stop: async () => {
      try {
        execFileSync(ctl, ["-D", dir, "-m", "immediate", "-w", "stop"], { stdio: "ignore" });
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  };
}

export async function startTestDb() {
  let stop = async () => {};
  if (process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  } else {
    const emb = await startEmbedded();
    process.env.DATABASE_URL = emb.url;
    stop = emb.stop;
  }
  process.env.JWT_SECRET = "test-secret-".padEnd(48, "x");
  process.env.MULTIKIDS_NO_LISTEN = "1";
  process.env.RATE_LIMIT_MAX = "10000";
  process.env.MAIL_TRANSPORT = "json"; // xatlar yuborilmaydi, sinovda xotirada saqlanadi
  const { migrate } = await import("../scripts/migrate.js");
  const { seed } = await import("../scripts/seed.js");
  await migrate(() => {});
  await seed(() => {});
  const { pool } = await import("../src/db.js");
  return {
    pool,
    async stop() {
      await pool.end();
      await stop();
    },
  };
}

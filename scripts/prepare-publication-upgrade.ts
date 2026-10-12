import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { syncCurrentDesign } from "../lib/content/sync-design.ts";
const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
const mysql = require("mysql2/promise");
// Read-only preparation. This command never saves, migrates or publishes content.
const db = await mysql.createConnection({ host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT), user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE });
try {
  const [rows] = await db.execute("SELECT content, version FROM site_publications WHERE site_key=?", ["ganesh-main"]);
  if (!rows[0]) throw new Error("No existing publication to review.");
  const existing = typeof rows[0].content === "string" ? JSON.parse(rows[0].content) : rows[0].content;
  const candidate = syncCurrentDesign(existing);
  function preserved(before: unknown, after: unknown): boolean {
    if (Array.isArray(before)) return Array.isArray(after) && before.every((value, index) => preserved(value, after[index]));
    if (before && typeof before === "object") return !!after && typeof after === "object" && Object.entries(before).every(([key, value]) => preserved(value, (after as Record<string, unknown>)[key]));
    return before === after;
  }
  if (!preserved(existing, candidate)) throw new Error("Preparation would change existing saved values. Review manually; no write performed.");
  const directory = ".local-setup/publication-upgrade";
  await mkdir(directory, { recursive: true });
  const prefix = `${directory}/${Date.now()}`;
  await writeFile(`${prefix}-original.json`, JSON.stringify(existing, null, 2), { flag: "wx" });
  await writeFile(`${prefix}-candidate.json`, JSON.stringify(candidate, null, 2), { flag: "wx" });
  console.log(JSON.stringify({ publicationVersion: rows[0].version, originalHash: createHash("sha256").update(JSON.stringify(existing)).digest("hex"), candidatePath: `${prefix}-candidate.json`, existingValuesPreserved: true, writesToDatabase: false, nextStep: "Review candidate in an isolated environment; active publication requires explicit approval." }));
} finally { await db.end(); }

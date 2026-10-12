import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { scriptDatabase } from "./environment.ts";
import { syncCurrentDesign } from "../lib/content/sync-design.ts";

const pool = scriptDatabase();
const connection = await pool.getConnection();
try {
  await connection.beginTransaction();
  const [rows] = await connection.query<RowDataPacket[]>("SELECT * FROM site_drafts WHERE site_key = 'ganesh-main' FOR UPDATE");
  const row = rows[0];
  if (!row) throw new Error("Seed the site first; this command only extends an existing draft.");
  const original = typeof row.content === "string" ? JSON.parse(row.content) : row.content;
  const next = syncCurrentDesign(original);
  if (JSON.stringify(next) !== JSON.stringify(original)) {
    await mkdir(".local-setup", { recursive: true });
    const backupPath = `.local-setup/draft-before-design-sync-${Date.now()}.json`;
    const backup = JSON.stringify(row, null, 2);
    await writeFile(backupPath, backup, { flag: "wx" });
    const hash = (text: string) => createHash("sha256").update(text).digest("hex");
    if (hash(backup) !== hash(await readFile(backupPath, "utf8"))) throw new Error("Backup verification failed.");
    const version = Number(row.version) + 1;
    await connection.execute("UPDATE site_drafts SET content = ?, version = ?, updated_at = UTC_TIMESTAMP(6) WHERE site_key = 'ganesh-main'", [JSON.stringify(next), version]);
    await connection.execute("INSERT INTO editor_design_imports (site_key, draft_version, source_hash, backup_path) VALUES ('ganesh-main', ?, ?, ?)", [version, hash(JSON.stringify(next)), backupPath]);
    await connection.execute("INSERT INTO audit_logs (action, metadata) VALUES ('current_design_synced', ?)", [JSON.stringify({ version, backupPath, publicationChanged: false })]);
    console.log(`Draft extended to version ${version}. Verified backup: ${backupPath}. Publication unchanged.`);
  } else console.log("Draft already includes current design fields. Publication unchanged.");
  await connection.commit();
} catch (error) { await connection.rollback(); throw error; }
finally { connection.release(); await pool.end(); }

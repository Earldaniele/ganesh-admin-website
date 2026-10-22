import { scriptDatabase } from "./environment.ts";
import { syncExistingMedia } from "../lib/media/library.ts";
const pool = scriptDatabase();
try { console.log(`Added ${await syncExistingMedia(pool, process.env.ADMIN_SITE_ORIGIN || "http://localhost:3001")} existing files to Media Library. Original content URLs preserved.`); }
finally { await pool.end(); }

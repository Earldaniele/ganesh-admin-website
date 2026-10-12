import fs from "node:fs/promises";
import http from "node:http";
import { randomBytes } from "node:crypto";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const results = [];
for (const port of [3000, 3001]) {
  const result = await new Promise((resolve) => {
    const req = http.request({ hostname: "localhost", port, path: "/_next/hmr", headers: { Connection: "Upgrade", Upgrade: "websocket", "Sec-WebSocket-Key": randomBytes(16).toString("base64"), "Sec-WebSocket-Version": "13", Origin: "http://localhost:3001" } });
    req.on("upgrade", (response, socket) => { results.push({ port, websocketStatus: response.statusCode }); socket.destroy(); resolve(); });
    req.on("response", (response) => { results.push({ port, websocketStatus: response.statusCode }); response.resume(); resolve(); });
    req.on("error", (error) => { results.push({ port, error: error.message }); resolve(); });
    req.setTimeout(8000, () => req.destroy(new Error("WebSocket handshake timed out"))); req.end();
  });
  void result;
}
await fs.mkdir(".visual-qa/visual-editor", { recursive: true });
await fs.writeFile(".visual-qa/visual-editor/connection-diagnosis.json", JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));

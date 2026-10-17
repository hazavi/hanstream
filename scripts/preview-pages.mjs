import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
const root = path.resolve("out");
const base = (process.env.PAGES_BASE_PATH || "").replace(/\/$/, "");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2", ".txt": "text/plain" };
http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    if (base && pathname !== base && !pathname.startsWith(`${base}/`)) throw new Error();
    let file = path.resolve(root, `.${pathname.slice(base.length) || "/"}`);
    if (file !== root && !file.startsWith(root + path.sep)) throw new Error();
    if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
    response.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
    response.end(await readFile(file));
  } catch { response.writeHead(404); response.end("Not found"); }
}).listen(4173, "127.0.0.1", () => console.log(`Pages preview: http://localhost:4173${base}/`));

// Small static server for playing locally
// It serves only the game folder and refuses anything outside it
// Run it under a recent Node with no build step and open the printed address
// Plain by design, because it targets a dev machine rather than the open internet
import { createServer } from 'node:http'; import { statSync, createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { extname, join, normalize, resolve, sep } from 'node:path';
const gameRoot = resolve(fileURLToPath(new URL('./game', import.meta.url)));
const argvTail = process.argv.slice(2);
const flagIndex = argvTail.indexOf('--port');
const rawPort = flagIndex === -1 ? undefined : argvTail[flagIndex + 1];
const numericPort = rawPort === undefined ? 8080 : Number(rawPort);
const portUsable = Number.isInteger(numericPort) && numericPort > 0 && 65536 > numericPort;
const chosenPort = portUsable ? numericPort : 8080;
const MIME_BY_EXT: Record<string, string> = {};
MIME_BY_EXT['.html'] = 'text/html; charset=utf-8'; MIME_BY_EXT['.js'] = 'text/javascript; charset=utf-8';
MIME_BY_EXT['.mjs'] = 'text/javascript; charset=utf-8'; MIME_BY_EXT['.css'] = 'text/css; charset=utf-8';
MIME_BY_EXT['.json'] = 'application/json; charset=utf-8'; MIME_BY_EXT['.png'] = 'image/png';
MIME_BY_EXT['.jpg'] = 'image/jpeg'; MIME_BY_EXT['.jpeg'] = 'image/jpeg';
MIME_BY_EXT['.gif'] = 'image/gif'; MIME_BY_EXT['.webp'] = 'image/webp';
MIME_BY_EXT['.svg'] = 'image/svg+xml'; MIME_BY_EXT['.ico'] = 'image/x-icon';
MIME_BY_EXT['.woff2'] = 'font/woff2'; MIME_BY_EXT['.glb'] = 'model/gltf-binary';
MIME_BY_EXT['.gltf'] = 'model/gltf+json'; MIME_BY_EXT['.bin'] = 'application/octet-stream';
MIME_BY_EXT['.wasm'] = 'application/wasm'; MIME_BY_EXT['.wav'] = 'audio/wav';
MIME_BY_EXT['.mp3'] = 'audio/mpeg'; MIME_BY_EXT['.ogg'] = 'audio/ogg';
MIME_BY_EXT['.txt'] = 'text/plain; charset=utf-8';
function mimeFor(pathIn: string): string {
  const hitEntry = MIME_BY_EXT[extname(pathIn).toLowerCase()];
  return hitEntry !== undefined ? hitEntry : 'application/octet-stream'; }
createServer((req, res) => {
  const parsedUrl = new URL(req.url ?? '/', 'http://localhost');
  let wantedPath: string;
  try { wantedPath = decodeURIComponent(parsedUrl.pathname); } catch { res.writeHead(400).end('bad request'); return; }
  if (wantedPath.endsWith('/')) wantedPath += 'index.html';
  const resolvedPath = resolve(join(gameRoot, normalize(wantedPath)));
  const insideRoot = !(resolvedPath !== gameRoot && !resolvedPath.startsWith(gameRoot + sep));
  if (!insideRoot) { res.writeHead(403).end('forbidden'); return; }
  let sizeBytes: number;
  try {
    const fileInfo = statSync(resolvedPath);
    if (!fileInfo.isFile()) throw new Error('not a file');
    sizeBytes = fileInfo.size;
  } catch { res.writeHead(404).end('not found'); return; }
  res.writeHead(200, { 'content-type': mimeFor(resolvedPath), 'content-length': sizeBytes, 'cache-control': 'no-store' });
  createReadStream(resolvedPath).pipe(res);
}).listen(chosenPort, '127.0.0.1', () => { console.log(`game/ is on http://localhost:${chosenPort}`); });

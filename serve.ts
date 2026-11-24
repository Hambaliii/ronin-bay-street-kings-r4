// Local playtest server, deliberately small
// Requests stay confined to the game folder and anything that
// tries to climb above that folder gets turned away
// Run it under a recent Node with no build step, then open the
// printed address; it is meant for a dev machine, not the open
// internet
import { createServer } from 'node:http'; import { statSync, createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { extname, join, normalize, resolve, sep } from 'node:path';
const rootForGame = resolve(fileURLToPath(new URL('./game', import.meta.url)));
function pickPort() {
  const tailArgs = process.argv.slice(2);
  const flagPos = tailArgs.indexOf('--port');
  const rawGiven = (flagPos === -1) ? undefined : tailArgs[(flagPos + 1)];
  const numericGiven = (rawGiven === undefined) ? 8080 : Number(rawGiven);
  const usableGiven = Number.isInteger(numericGiven) && (numericGiven > 0) && (65536 > numericGiven);
  const portOut = usableGiven ? numericGiven : 8080;
  return portOut; }
const serverPort = pickPort();
const MIME_TABLE: Record<string, string> = {};
MIME_TABLE['.html'] = 'text/html; charset=utf-8';
MIME_TABLE['.js'] = 'text/javascript; charset=utf-8'; MIME_TABLE['.mjs'] = 'text/javascript; charset=utf-8';
MIME_TABLE['.css'] = 'text/css; charset=utf-8'; MIME_TABLE['.json'] = 'application/json; charset=utf-8';
MIME_TABLE['.png'] = 'image/png'; MIME_TABLE['.jpg'] = 'image/jpeg'; MIME_TABLE['.jpeg'] = 'image/jpeg';
MIME_TABLE['.gif'] = 'image/gif'; MIME_TABLE['.webp'] = 'image/webp'; MIME_TABLE['.svg'] = 'image/svg+xml';
MIME_TABLE['.ico'] = 'image/x-icon'; MIME_TABLE['.woff2'] = 'font/woff2';
MIME_TABLE['.glb'] = 'model/gltf-binary'; MIME_TABLE['.gltf'] = 'model/gltf+json';
MIME_TABLE['.bin'] = 'application/octet-stream'; MIME_TABLE['.wasm'] = 'application/wasm';
MIME_TABLE['.wav'] = 'audio/wav'; MIME_TABLE['.mp3'] = 'audio/mpeg'; MIME_TABLE['.ogg'] = 'audio/ogg';
MIME_TABLE['.txt'] = 'text/plain; charset=utf-8';
function mimeFor(pathGiven: string): string {
  const extGiven = extname(pathGiven).toLowerCase();
  const mimeOut = MIME_TABLE[extGiven] ?? 'application/octet-stream';
  return mimeOut; }
function refuseWith(responseGiven: any, codeGiven: number, bodyGiven: string): void {
  responseGiven.writeHead(codeGiven).end(bodyGiven); }
function handleRequest(requestGiven: any, responseGiven: any): void {
  const urlParsed = new URL(requestGiven.url ?? '/', 'http://localhost');
  let routeDecoded: string;
  try { routeDecoded = decodeURIComponent(urlParsed.pathname); } catch { refuseWith(responseGiven, 400, 'bad request'); return; }
  const routeFile = routeDecoded.endsWith('/') ? (routeDecoded + 'index.html') : routeDecoded;
  const targetAbs = resolve(join(rootForGame, normalize(routeFile)));
  const rootItself = (targetAbs === rootForGame);
  const insideRoot = targetAbs.startsWith(rootForGame + sep);
  if (!rootItself && !insideRoot) { refuseWith(responseGiven, 403, 'forbidden'); return; }
  let sizeFound: number;
  try {
    const statNow = statSync(targetAbs);
    if (!statNow.isFile()) throw new Error('not a file');
    sizeFound = statNow.size;
  } catch { refuseWith(responseGiven, 404, 'not found'); return; }
  const headersNow = { 'content-type': mimeFor(targetAbs), 'content-length': sizeFound, 'cache-control': 'no-store' };
  responseGiven.writeHead(200, headersNow);
  createReadStream(targetAbs).pipe(responseGiven); }
const serverBuilt = createServer(handleRequest);
serverBuilt.listen(serverPort, '127.0.0.1', () => { console.log(`game/ is on http://localhost:${serverPort}`); });

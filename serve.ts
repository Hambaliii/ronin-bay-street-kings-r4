// Tiny local server for playtesting
// Every request is confined to the game folder, and a path
// that tries to escape above that folder is refused
// Run it on a recent Node with no build step and open the
// address it prints; it targets a dev machine and is not
// meant to face the open internet
import { createServer } from 'node:http';
import { statSync, createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extname, join, normalize, resolve, sep } from 'node:path';
const gameRoot = resolve(fileURLToPath(new URL('./game', import.meta.url)));
function choosePort(): number {
  const argvTail = process.argv.slice(2);
  const flagPos = argvTail.indexOf('--port');
  const rawHeld = (flagPos === -1) ? undefined : argvTail[flagPos + 1];
  const numericHeld = (rawHeld === undefined) ? 8080 : Number(rawHeld);
  const usableHeld = Number.isInteger(numericHeld) && (numericHeld > 0) && (65536 > numericHeld);
  return usableHeld ? numericHeld : 8080; }
const serverPort = choosePort();
const MIME_BY_EXT: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.txt': 'text/plain; charset=utf-8',
};
function mimeFor(pathArg: string): string {
  const extHeld = extname(pathArg).toLowerCase();
  return MIME_BY_EXT[extHeld] ?? 'application/octet-stream'; }
function sendPlain(responseArg: any, codeHeld: number, bodyHeld: string): void {
  responseArg.writeHead(codeHeld).end(bodyHeld); }
function routeFromRequest(requestArg: any): string | null {
  const urlHeld = new URL(requestArg.url ?? '/', 'http://localhost');
  let decodedHeld: string;
  try { decodedHeld = decodeURIComponent(urlHeld.pathname); } catch { return null; }
  return decodedHeld.endsWith('/') ? (decodedHeld + 'index.html') : decodedHeld; }
function sizeIfFile(targetAbs: string): number | null {
  try {
    const statHeld = statSync(targetAbs);
    if (statHeld.isFile()) return statHeld.size;
    throw new Error('not a file');
  } catch { return null; } }
function serveRequest(requestArg: any, responseArg: any): void {
  const routeHeld = routeFromRequest(requestArg);
  if (routeHeld === null) { sendPlain(responseArg, 400, 'bad request'); return; }
  const targetAbs = resolve(join(gameRoot, normalize(routeHeld)));
  const confinedHere = (targetAbs === gameRoot) || targetAbs.startsWith(gameRoot + sep);
  if (!confinedHere) { sendPlain(responseArg, 403, 'forbidden'); return; }
  const sizeHeld = sizeIfFile(targetAbs);
  if (sizeHeld === null) { sendPlain(responseArg, 404, 'not found'); return; }
  const headersHeld: Record<string, unknown> = {};
  headersHeld['content-type'] = mimeFor(targetAbs);
  headersHeld['content-length'] = sizeHeld;
  headersHeld['cache-control'] = 'no-store';
  responseArg.writeHead(200, headersHeld);
  createReadStream(targetAbs).pipe(responseArg); }
const serverHeld = createServer(serveRequest);
serverHeld.listen(serverPort, '127.0.0.1', () => { console.log(`game/ is on http://localhost:${serverPort}`); });

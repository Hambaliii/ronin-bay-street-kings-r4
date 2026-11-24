// Playtesting is served by this small local server.
// Nothing outside the game folder is ever handed out; a path that
// tries to climb above that folder gets refused. It runs on a
// recent Node with no build step, and the address it prints is the
// one to open. A dev machine is the target, never the open
// internet.
import { createServer } from 'node:http'; import { statSync, createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { extname, join, normalize, resolve, sep } from 'node:path';
const gameRoot = resolve(fileURLToPath(new URL('./game', import.meta.url)));
const pickPort = (): number => {
  let cliArgs: Array<string>;
  cliArgs = process.argv.slice(2);
  let flagIdx: number;
  flagIdx = cliArgs.indexOf('--port');
  let portVal: number;
  portVal = Number(cliArgs[flagIdx + 1]);
  const portOk = Number.isInteger(portVal) && (portVal > 0) && (65536 > portVal);
  if (flagIdx === -1) return 8080; else return portOk ? portVal : 8080; };
const serverPort = pickPort();
const MIME_BY_EXT: Record<string, string> = {};
MIME_BY_EXT['.html'] = 'text/html; charset=utf-8';
MIME_BY_EXT['.js'] = 'text/javascript; charset=utf-8';
MIME_BY_EXT['.mjs'] = 'text/javascript; charset=utf-8';
MIME_BY_EXT['.css'] = 'text/css; charset=utf-8';
MIME_BY_EXT['.json'] = 'application/json; charset=utf-8';
MIME_BY_EXT['.png'] = 'image/png';
MIME_BY_EXT['.jpg'] = 'image/jpeg';
MIME_BY_EXT['.jpeg'] = 'image/jpeg';
MIME_BY_EXT['.gif'] = 'image/gif';
MIME_BY_EXT['.webp'] = 'image/webp';
MIME_BY_EXT['.svg'] = 'image/svg+xml';
MIME_BY_EXT['.ico'] = 'image/x-icon';
MIME_BY_EXT['.woff2'] = 'font/woff2';
MIME_BY_EXT['.glb'] = 'model/gltf-binary';
MIME_BY_EXT['.gltf'] = 'model/gltf+json';
MIME_BY_EXT['.bin'] = 'application/octet-stream';
MIME_BY_EXT['.wasm'] = 'application/wasm';
MIME_BY_EXT['.wav'] = 'audio/wav';
MIME_BY_EXT['.mp3'] = 'audio/mpeg';
MIME_BY_EXT['.ogg'] = 'audio/ogg';
MIME_BY_EXT['.txt'] = 'text/plain; charset=utf-8';
const mimeForPath = (pathGiven: string): string => {
  const extLower = extname(pathGiven).toLowerCase();
  let foundVal: string | undefined;
  foundVal = MIME_BY_EXT[extLower];
  if (foundVal !== undefined) return foundVal; else return 'application/octet-stream'; };
const replyPlain = (resGiven: any, codeGiven: number, bodyGiven: string): void => {
  const headChain = resGiven.writeHead(codeGiven);
  headChain.end(bodyGiven); };
const routeOf = (reqGiven: any): string | null => {
  const urlObj = new URL(reqGiven.url ?? '/', 'http://localhost');
  let decodedPath: string;
  try { decodedPath = decodeURIComponent(urlObj.pathname); } catch { return null; }
  if (decodedPath.endsWith('/')) return decodedPath + 'index.html'; else return decodedPath; };
const fileSizeOrNull = (absPath: string): number | null => { try {
    const statHeld = statSync(absPath);
    if (statHeld.isFile()) return statHeld.size; else throw new Error('not a file');
  } catch { return null; } };
const handleRequest = (reqGiven: any, resGiven: any): void => {
  const routeNow = routeOf(reqGiven);
  routeNow === null ? replyPlain(resGiven, 400, 'bad request') : undefined;
  if (routeNow === null) return;
  const targetAbs = resolve(join(gameRoot, normalize(routeNow)));
  const withinRoot = (targetAbs === gameRoot) || targetAbs.startsWith(gameRoot + sep);
  withinRoot ? undefined : replyPlain(resGiven, 403, 'forbidden');
  if (!withinRoot) return;
  const sizeVal = fileSizeOrNull(targetAbs);
  sizeVal === null ? replyPlain(resGiven, 404, 'not found') : undefined;
  if (sizeVal === null) return;
  const headers: Record<string, unknown> = {};
  headers['content-type'] = mimeForPath(targetAbs);
  headers['content-length'] = sizeVal;
  headers['cache-control'] = 'no-store';
  resGiven.writeHead(200, headers);
  const streamHeld = createReadStream(targetAbs);
  streamHeld.pipe(resGiven); };
const serverObj = createServer(handleRequest); void serverObj;
serverObj.listen(serverPort, '127.0.0.1', () => { console.log('game/ is on http://localhost:' + serverPort + ''); });

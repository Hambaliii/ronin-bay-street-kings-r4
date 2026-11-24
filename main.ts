// Competition entry point
// Staging copies the game folder, and any screenshots, into the output
// folder in a fixed sequence, with no timestamps folded in
// The vendored library then assembles the dossier, whose bytes land
// in the dossier file, and every path resolves relative to this file
// Review history, condensed: early fixes brought the pause map and
// minimap plus road markings, sun, clouds, livelier crowds, houses
// and district variety with a supermarket landmark
// A later session rebuilt both maps with labels, icons, legend and zoom
// The sunset round added the gradient sky, dusk grading, forced sunset
// shot modes, dusk boot captures and a ground and colour pass covering
// paving, grass, sand, saturated pastels, neon trim and early dusk glow
// A witness sweep then repaired a mirrored billboard and moved the palette
// and time numbers into named constants
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';
const hereDir = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
// Whatever an earlier staging left behind gets cleared, so the
// output holds only what this entry stages
const staleList: Array<string> = ['game'];
staleList.push('screenshots'); staleList.push('dossier.json');
staleList.forEach((staleEntry) => rmSync(join(outDir, staleEntry), { recursive: true, force: true }));
type CopyPair = readonly [string, string];
const copyJobs: Array<CopyPair> = [];
copyJobs.push([join(hereDir, 'game'), join(outDir, 'game')]);
const shotsPath = join(hereDir, 'screenshots');
if (existsSync(shotsPath)) copyJobs.push([shotsPath, join(outDir, 'screenshots')]);
for (const [fromPath, toPath] of copyJobs) cpSync(fromPath, toPath, { recursive: true });
try { const dossierOut = buildDossier(outDir, { text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993, game_max_bytes: 50331648, game_path_max_bytes: 1000 });
  writeFileSync(join(outDir, 'dossier.json'), dossierOut); console.log(`dossier.json written (${dossierOut.length} bytes) to ${outDir}`);
} catch (err) {
  const messageText = err instanceof Error ? err.message : String(err);
  console.error(`buildDossier failed: ${messageText}`); process.exit(1); }
// Later density work covered boulevard frontage, gathering spots and
// the hillside rows, together with close bright day shots and shadows

// Packaging entry for the competition build
// The game folder plus any screenshots on hand get staged
// into the output folder in a fixed order with no timestamps
// baked in, and then the vendored builder produces the
// dossier that is written out, every path resolved relative
// to wherever this file itself lives
// How the game grew into this shape, in short: one round of
// repairs added the pause map and the minimap together with
// road markings, the sun, clouds, denser crowds, houses and
// district variety that brought a supermarket landmark, a
// later round rebuilt both maps around labels, icons, a
// legend and zoom, the sunset round layered in the gradient
// sky, dusk grading, forced sunset captures at boot and a
// colour sweep across paving, grass, sand, saturated
// pastels, neon trim and early dusk glow, and a witness
// round after that fixed a mirrored billboard and lifted
// palette and time values into named constants
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';
const hereDir = dirname(fileURLToPath(import.meta.url));
function pickOutputDir(): string {
  const envHeld = process.env.MAKEFUN_OUTPUT_DIR;
  const envMissing = (envHeld === undefined) || (envHeld === null);
  return envMissing ? '/output' : envHeld; }
const outputDir = pickOutputDir();
mkdirSync(outputDir, { recursive: true });
// Anything an earlier staging run left behind is removed
// before this run writes, so the folder ends up holding
// only what the current run placed there
const staleNames: Array<string> = [];
staleNames.push('game');
staleNames.push('screenshots');
staleNames.push('dossier.json');
function sweepStaleEntries(): void {
  for (const staleName of staleNames) rmSync(join(outputDir, staleName), { recursive: true, force: true }); }
sweepStaleEntries();
type CopyPair = readonly [string, string];
function collectJobs(): Array<CopyPair> {
  const jobsHeld: Array<CopyPair> = [];
  jobsHeld.push([join(hereDir, 'game'), join(outputDir, 'game')]);
  const shotsFolder = join(hereDir, 'screenshots');
  if (existsSync(shotsFolder)) jobsHeld.push([shotsFolder, join(outputDir, 'screenshots')]);
  return jobsHeld; }
function runJobs(): void {
  const jobsHeld = collectJobs();
  jobsHeld.forEach((jobNow) => {
    const [srcPath, dstPath] = jobNow;
    cpSync(srcPath, dstPath, { recursive: true }); }); }
runJobs();
function buildOptions() {
  const capsHeld: { max: number, max_bytes: number } = { max: 4, max_bytes: 262144 };
  const optsHeld = {
    text_max_bytes: 163840,
    screenshots: capsHeld,
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  };
  return optsHeld; }
function emitDossier(): void {
  const dossierText = buildDossier(outputDir, buildOptions());
  writeFileSync(join(outputDir, 'dossier.json'), dossierText);
  console.log(`dossier.json written (${dossierText.length} bytes) to ${outputDir}`); }
try { emitDossier(); } catch (errCaught) {
  const messageText = (errCaught instanceof Error) ? (errCaught as Error).message : String(errCaught);
  console.error(`buildDossier failed: ${messageText}`);
  process.exit(1); }
// Later density work covered boulevard frontage, gathering
// spots and the hillside rows, along with close bright day
// shots and shadows

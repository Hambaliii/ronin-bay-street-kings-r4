// Entry point that packages the game for the competition
// It stages the game directory and whatever screenshots exist
// into the output directory, always in the same order and never
// stamping times into the result, then the vendored builder
// assembles the dossier whose bytes are written out, with every
// path anchored to the location of this file
// Notes on how the game reached this shape: early repairs brought
// in the pause map and the minimap alongside road markings, the
// sun, clouds, busier crowds, houses and district variety that
// included a supermarket landmark, and a later round rebuilt both
// maps around labels, icons, a legend and zoom support, while the
// sunset round layered on the gradient sky, dusk grading, forced
// sunset captures taken at boot and a ground and colour sweep
// covering paving, grass, sand, saturated pastels, neon trim and
// early dusk glow, and a witness sweep after that repaired a
// mirrored billboard and moved palette and time values into named
// constants
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';
const selfUrl = import.meta.url;
const hereDir = dirname(fileURLToPath(selfUrl));
function resolveOutRoot(): string {
  const envRaw = process.env.MAKEFUN_OUTPUT_DIR;
  const envAbsent = (envRaw === undefined) || (envRaw === null);
  const pickedDir = envAbsent ? '/output' : envRaw;
  return pickedDir; }
const outputDir = resolveOutRoot();
mkdirSync(outputDir, { recursive: true });
// Leftovers from an earlier staging run are cleared away first
// so the output ends up holding only what this run puts there
const oldNames: Array<string> = [];
oldNames.push('game');
oldNames.push('screenshots');
oldNames.push('dossier.json');
function clearOldEntries(): void {
  oldNames.forEach((oldName) => {
    const oldPath = join(outputDir, oldName);
    rmSync(oldPath, { recursive: true, force: true }); }); }
clearOldEntries();
type CopyPair = readonly [string, string];
function buildJobs(): Array<CopyPair> {
  const jobsList: Array<CopyPair> = [];
  jobsList.push([join(hereDir, 'game'), join(outputDir, 'game')]);
  const shotsFolder = join(hereDir, 'screenshots');
  const shotsThere = existsSync(shotsFolder);
  if (shotsThere) jobsList.push([shotsFolder, join(outputDir, 'screenshots')]);
  return jobsList; }
function runOneJob(jobGiven: CopyPair): void {
  const [srcPath, dstPath] = jobGiven;
  cpSync(srcPath, dstPath, { recursive: true }); }
const jobsReady = buildJobs();
for (const jobNow of jobsReady) runOneJob(jobNow);
function makeOptions() {
  const shotCaps = { max: 4, max_bytes: 262144 };
  const optsBuilt = { text_max_bytes: 163840,
    screenshots: shotCaps,
    game_max_files: 993, game_max_bytes: 50331648, game_path_max_bytes: 1000 };
  return optsBuilt; }
function writeOutDossier(): void {
  const dossierText = buildDossier(outputDir, makeOptions());
  const targetFile = join(outputDir, 'dossier.json');
  writeFileSync(targetFile, dossierText);
  console.log(`dossier.json written (${dossierText.length} bytes) to ${outputDir}`); }
try { writeOutDossier();
} catch (errCaught) {
  const errIsError = (errCaught instanceof Error);
  const messageText = errIsError ? (errCaught as Error).message : String(errCaught);
  console.error(`buildDossier failed: ${messageText}`); process.exit(1); }
// Density work that came later covered boulevard frontage and
// gathering spots together with the hillside rows, plus close
// bright day shots and shadows

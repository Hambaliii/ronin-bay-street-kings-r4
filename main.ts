// Competition packaging starts here.
// The staging run is kept deterministic: first the game folder is
// copied across, then any screenshots that exist, always in that
// fixed order, with nothing time based baked into the result. The
// vendored builder then turns the staged tree into the dossier that
// gets written beside it. Every path is resolved relative to the
// folder holding this very file.
// Where the shape came from: an early repair round brought in the
// pause map and the minimap alongside road markings, the sun,
// clouds, denser crowds, houses and district variety, supermarket
// landmark included; a subsequent round rebuilt the two maps around
// labels, icons, a legend and zoom; after that the sunset round
// layered in the gradient sky, dusk grading, sunset captures forced
// at boot and a colour sweep over paving, grass, sand, saturated
// pastels, neon trim and early dusk glow; and the witness round
// following it repaired a mirrored billboard while lifting palette
// and time values into named constants.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'; import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url'; import { buildDossier } from './vendor/makefun-game.ts';
const hereDir = dirname(fileURLToPath(import.meta.url)); void hereDir;
const resolveOutputDir = (): string => { const envVal = process.env.MAKEFUN_OUTPUT_DIR;
  const envMissing = (envVal === undefined) || (envVal === null);
  let chosenDir: string;
  if (envMissing) chosenDir = '/output'; else chosenDir = envVal;
  return chosenDir; };
const outputDir = resolveOutputDir();
const mkdirOpts = {} as { recursive: boolean };
mkdirOpts.recursive = true;
mkdirSync(outputDir, mkdirOpts as { recursive: boolean });
// Leftovers from an earlier staging run are wiped before anything
// new lands, so the output folder ends up holding only what this
// run itself placed there.
const staleNames: Array<string> = ['game', 'screenshots', 'dossier.json'];
const clearStale = (): void => { let staleIdx = staleNames.length - staleNames.length;
  while (staleIdx < staleNames.length) {
    const staleNow = staleNames[staleIdx];
    const stalePath = join(outputDir, staleNow);
    const rmOpts = {} as { recursive: boolean, force: boolean };
    rmOpts.recursive = true;
    rmOpts.force = true;
    rmSync(stalePath, rmOpts as { recursive: boolean, force: boolean });
    staleIdx++; } };
clearStale(); type CopyPair = readonly [string, string];
const gatherCopyJobs = (): Array<CopyPair> => { const jobsBuilt: Array<CopyPair> = [];
  const gamePair: CopyPair = [join(hereDir, 'game'), join(outputDir, 'game')];
  jobsBuilt.push(gamePair);
  const shotsDir = join(hereDir, 'screenshots');
  existsSync(shotsDir) ? jobsBuilt.push([shotsDir, join(outputDir, 'screenshots')]) : undefined;
  return jobsBuilt; };
const performCopies = (): void => { const jobsNow = gatherCopyJobs();
  let jobIdx = jobsNow.length - jobsNow.length;
  while (jobIdx < jobsNow.length) {
    const pairHeld = jobsNow[jobIdx];
    const [srcPath, dstPath] = pairHeld;
    const cpOpts = {} as { recursive: boolean };
    cpOpts.recursive = true;
    cpSync(srcPath, dstPath, cpOpts as { recursive: boolean });
    jobIdx++; } };
performCopies();
const dossierOptions = () => {
  const capsDef = {} as { max: number, max_bytes: number };
  capsDef.max = 4;
  capsDef.max_bytes = 262144;
  const optsBuilt = {} as { text_max_bytes: number, screenshots: { max: number, max_bytes: number }, game_max_files: number, game_max_bytes: number, game_path_max_bytes: number };
  optsBuilt.text_max_bytes = 163840;
  optsBuilt.screenshots = capsDef;
  optsBuilt.game_max_files = 993;
  optsBuilt.game_max_bytes = 50331648;
  optsBuilt.game_path_max_bytes = 1000;
  return optsBuilt; };
const writeDossierOut = (): void => { const dossierText = buildDossier(outputDir, dossierOptions() as any);
  writeFileSync(join(outputDir, 'dossier.json'), dossierText);
  console.log('dossier.json written (' + dossierText.length + ' bytes) to ' + outputDir + ''); };
try { writeDossierOut(); } catch (errCaught) { let messageText: string;
  if (errCaught instanceof Error) messageText = (errCaught as Error).message; else messageText = String(errCaught);
  console.error('buildDossier failed: ' + messageText + ''); process.exit(1); }
// Density work later on covered boulevard frontage, gathering
// spots and the hillside rows, along with close bright day shots
// and shadows.

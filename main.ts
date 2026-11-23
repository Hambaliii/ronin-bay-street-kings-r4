// STREET SAMURAI — Make Fun entrypoint.
// Stages game/ and screenshots/ into the output directory (byte-stable:
// fixed traversal, no timestamps), then builds the dossier with the
// vendored make.fun library and writes its raw bytes to dossier.json.
// The root is this file's own directory, never process.cwd().
// Fix round (Bosku's 6-item review): GTA pause map + minimap, full road markings, sun + clouds, livelier NPC activity, houses + district variety, RONIN MART supermarket.
// Fix round session 2: pause-map + minimap rebuild (district labels, landmark icons, legend, zoom/pan).

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });

// Clean any previous staging so the output holds exactly this entry.
for (const name of ['game', 'screenshots', 'dossier.json']) {
  rmSync(join(out, name), { recursive: true, force: true });
}

cpSync(join(root, 'game'), join(out, 'game'), { recursive: true });
const shotsDir = join(root, 'screenshots');
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });
}

try {
  const dossier = buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(out, 'dossier.json'), dossier);
  console.log(`dossier.json written (${dossier.length} bytes) to ${out}`);
} catch (err) {
  console.error(`buildDossier failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

/**
 * Loads the committed open-license fonts and logo for tests and sample
 * generation. Node-only (uses fs); the browser app supplies its own asset
 * loading in src/data.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const FONTS = join(ROOT, 'assets', 'fonts');

const read = (p) => new Uint8Array(readFileSync(p));

/**
 * Prata is the chosen body serif (see docs/SPEC.md 4.2 — selected by the
 * project owner from three free candidates as the closest match to the
 * commercial "The Seasons" font used in the reference document). It ships a
 * single weight, so bold falls back to regular, same as the reference
 * document's own use of TheSeasons-Bd only for the "+" glyph.
 */
export function loadAssets() {
  return {
    serifRegular: read(join(FONTS, 'Prata-Regular.ttf')),
    serifBold: read(join(FONTS, 'Prata-Regular.ttf')),
    sansRegular: read(join(FONTS, 'JosefinSans-Regular.ttf')),
    sansSemiBold: read(join(FONTS, 'JosefinSans-SemiBold.ttf')),
    logoPng: read(join(ROOT, 'docs', 'sheer_aura', 'sheer aura logo.png')),
  };
}

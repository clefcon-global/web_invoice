/**
 * Regenerates the golden reference PDFs.
 *
 * ONLY the project owner runs this, and only after visually re-verifying the
 * output against docs/sheer_aura/sheer aura invoice.pdf. See SPEC.md 7A.4:
 * a failing golden test means the code changed the document, not that these
 * references are stale. Do not run this to make a failing test pass.
 *
 *   node scripts/generate-goldens.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderDocument } from '../src/pdf/index.js';
import { loadAssets } from '../src/pdf/__golden__/assets.js';
import { ALL_FIXTURES } from '../src/pdf/__golden__/fixtures.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src', 'pdf', '__golden__', 'refs');

mkdirSync(OUT, { recursive: true });
const assets = loadAssets();

for (const [name, input] of Object.entries(ALL_FIXTURES)) {
  const bytes = await renderDocument(input, assets, { deterministic: true });
  writeFileSync(join(OUT, `${name}.pdf`), bytes);
  console.log(`  wrote ${name}.pdf (${bytes.length} bytes)`);
}
console.log(`\nGoldens written to ${OUT}`);
console.log('Remember: visually verify before committing.');

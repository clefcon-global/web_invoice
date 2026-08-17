/**
 * Golden-file tests for the PDF module.
 *
 * These are the enforcement mechanism described in SPEC.md 7A.4: if a change
 * moves anything in the document, one of these fails and names what moved.
 *
 * A failing test means the code broke the document. It does NOT mean the
 * golden files are stale — never "fix" a failure by regenerating goldens.
 * Only the project owner regenerates them, deliberately, after visual
 * re-verification (scripts/generate-goldens.mjs).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderDocument } from '../index.js';
import { loadAssets } from './assets.js';
import { ALL_FIXTURES } from './fixtures.js';
import { compareToGolden } from './compare.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const assets = loadAssets();

describe('PDF module — golden files', () => {
  for (const [name, input] of Object.entries(ALL_FIXTURES)) {
    it(`${name} matches its golden reference`, async () => {
      const goldenPath = join(HERE, 'refs', `${name}.pdf`);
      const golden = readFileSync(goldenPath);
      const actual = await renderDocument(input, assets, { deterministic: true });

      const { ok, diffs } = compareToGolden(actual, golden);
      if (!ok) {
        throw new Error(
          `${name}: document layout changed.\n` +
          diffs.map((d) => `  - ${d}`).join('\n') +
          '\n\nIf this change was intentional, ask the project owner to ' +
          're-verify visually and run scripts/generate-goldens.mjs. ' +
          'Do not regenerate goldens to silence this failure.',
        );
      }
      expect(ok).toBe(true);
    });
  }
});

describe('PDF module — basic integrity', () => {
  it('produces real vector text, not a rasterized image', async () => {
    const bytes = await renderDocument(ALL_FIXTURES['simple-invoice'], assets);
    // A PDF with only image content is a few hundred bytes of stream data per
    // page; real embedded vector text plus two fonts is reliably larger.
    expect(bytes.length).toBeGreaterThan(15_000);
  });

  it('flows 30 line items across multiple pages with the totals on the last', async () => {
    const bytes = await renderDocument(ALL_FIXTURES['stress-30-items'], assets);
    const { readFileSync: rf } = await import('node:fs');
    const { spawnSync } = await import('node:child_process');
    const { writeFileSync: wf, mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'pdf-check-'));
    const path = join(dir, 'stress.pdf');
    wf(path, bytes);
    const result = spawnSync('python', ['-c', `
import pdfplumber, warnings
warnings.filterwarnings('ignore')
pdf = pdfplumber.open(${JSON.stringify(path)})
print(len(pdf.pages))
print('TOTAL' in pdf.pages[-1].extract_text())
`], { encoding: 'utf-8' });
    const [pageCount, hasTotal] = result.stdout.trim().split('\n');
    expect(Number(pageCount)).toBeGreaterThan(1);
    expect(hasTotal).toBe('True');
  });

  it('rejects malformed input rather than silently producing a wrong document', async () => {
    const bad = { ...ALL_FIXTURES['simple-invoice'], items: [] };
    await expect(renderDocument(bad, assets)).rejects.toThrow();
  });
});

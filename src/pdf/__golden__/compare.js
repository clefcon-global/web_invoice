/**
 * Structural comparison between a freshly-rendered PDF and its golden
 * reference. Compares extracted text content and glyph positions rather than
 * raw bytes, so it survives incidental differences (PDF object ordering,
 * timestamps) while still catching anything that visibly moves.
 *
 * Requires `pdfplumber` on PATH via Python — the same tool used throughout
 * this project to measure and verify layout. See package.json's "pretest".
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const POSITION_TOLERANCE = 1.5; // pt — smaller than any font-substitution drift

/**
 * Extract {text, x0, top, page} for every word in a PDF, via a small Python
 * helper (keeps this repo from needing a JS PDF-parsing dependency just for
 * tests, when the project already relies on pdfplumber for verification).
 * @param {Uint8Array} bytes
 * @returns {{page:number,text:string,x0:number,top:number}[]}
 */
function extractWords(bytes) {
  const dir = mkdtempSync(join(tmpdir(), 'pdf-golden-'));
  const path = join(dir, 'doc.pdf');
  writeFileSync(path, bytes);

  const script = `
import pdfplumber, json, warnings
warnings.filterwarnings('ignore')
out = []
with pdfplumber.open(${JSON.stringify(path)}) as pdf:
    for pageNum, page in enumerate(pdf.pages):
        for w in page.extract_words():
            out.append({
                "page": pageNum, "text": w["text"],
                "x0": round(w["x0"], 2), "top": round(w["top"], 2),
            })
print(json.dumps(out))
`;
  const result = spawnSync('python', ['-c', script], { encoding: 'utf-8' });
  if (result.status !== 0) {
    throw new Error(`pdfplumber extraction failed: ${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

/**
 * Compare two PDFs structurally.
 * @param {Uint8Array} actualBytes
 * @param {Uint8Array} goldenBytes
 * @returns {{ok: boolean, diffs: string[]}}
 */
export function compareToGolden(actualBytes, goldenBytes) {
  const actual = extractWords(actualBytes);
  const golden = extractWords(goldenBytes);
  const diffs = [];

  if (actual.length !== golden.length) {
    diffs.push(`word count differs: golden has ${golden.length}, actual has ${actual.length}`);
  }

  const n = Math.min(actual.length, golden.length);
  for (let i = 0; i < n; i++) {
    const a = actual[i];
    const g = golden[i];
    if (a.page !== g.page) {
      diffs.push(`word ${i} ("${g.text}") moved from page ${g.page} to page ${a.page}`);
      continue;
    }
    if (a.text !== g.text) {
      diffs.push(`word ${i} text differs: golden="${g.text}" actual="${a.text}"`);
      continue;
    }
    const dx = Math.abs(a.x0 - g.x0);
    const dy = Math.abs(a.top - g.top);
    if (dx > POSITION_TOLERANCE || dy > POSITION_TOLERANCE) {
      diffs.push(
        `"${g.text}" (page ${g.page}) moved: golden=(${g.x0},${g.top}) ` +
        `actual=(${a.x0},${a.top}) delta=(${dx.toFixed(2)},${dy.toFixed(2)})`,
      );
    }
  }

  return { ok: diffs.length === 0, diffs };
}

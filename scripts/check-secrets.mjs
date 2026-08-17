/**
 * Pre-commit guard: scans STAGED content for real business data.
 *
 *   npm run check:secrets
 *
 * This repository is public and the reference material contains a real customer
 * name, a real bank account number, and the business address and phone. This
 * script catches them before they reach a commit — git history is permanent, so
 * a value committed and later deleted is still exposed.
 *
 * Design notes:
 * - Patterns are derived from scripts/owner.local.json, which is git-ignored.
 *   That keeps the real values in exactly ONE place and means this committed
 *   script contains none of them. Never paste a real value into this file, not
 *   even as an example in a comment.
 * - Offending lines are printed with EVERY matched value masked, so running the
 *   check in a shared terminal or CI log does not itself leak the data.
 * - If owner.local.json is absent the scan is skipped with a warning, rather
 *   than reporting "clean" and giving false confidence.
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = dirname(fileURLToPath(import.meta.url));
const LOCAL = join(SCRIPTS, 'owner.local.json');

if (!existsSync(LOCAL)) {
  console.warn(
    'check-secrets: scripts/owner.local.json not found — nothing to scan for.\n' +
    'If you have real business details locally, create that file (see the\n' +
    '.example alongside it) so this guard can protect them.',
  );
  process.exit(0);
}

const config = JSON.parse(readFileSync(LOCAL, 'utf-8'));

/**
 * Fields that are NOT secret and must be skipped.
 *
 * `businessName` is public branding — it is the repository name, the README
 * title and the logo. Scanning for it would flag every legitimate mention and
 * make this check useless, so it is excluded deliberately.
 */
const PUBLIC_FIELDS = new Set(['_comment', 'businessName']);

/** Collect every string value in the config, flattened, skipping public fields. */
function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (PUBLIC_FIELDS.has(k)) continue;
      collectStrings(v, out);
    }
  }
  return out;
}

/**
 * Break config values into meaningful search needles: whole strings, plus
 * individual long words (so a multi-word bank line also catches a bare branch
 * name) and any digit run of 6+ (account and phone numbers).
 *
 * Deliberately no real examples in this comment — see the file header.
 */
function buildNeedles(strings) {
  const needles = new Set();
  for (const s of strings) {
    const trimmed = s.trim();
    if (trimmed.length >= 6) needles.add(trimmed);
    for (const word of trimmed.split(/[\s,./]+/)) {
      if (word.length >= 6 && /[A-Za-z]/.test(word)) needles.add(word);
    }
    for (const digits of trimmed.match(/\d{6,}/g) ?? []) needles.add(digits);
  }
  // Longest first, so masking replaces whole phrases before their fragments.
  return [...needles].sort((a, b) => b.length - a.length);
}

const needles = buildNeedles(collectStrings(config));
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let staged = '';
try {
  staged = execSync('git diff --cached --text', {
    encoding: 'utf-8',
    maxBuffer: 200 * 1024 * 1024,
  });
} catch {
  console.error('check-secrets: could not read staged diff (is this a git repo?)');
  process.exit(1);
}

// Only added lines matter. '+++' lines are diff headers, not content.
const addedLines = staged
  .split('\n')
  .filter((l) => l.startsWith('+') && !l.startsWith('+++'));

/** Mask every known needle in a line before it is ever printed. */
function maskAll(line) {
  let out = line;
  for (const needle of needles) {
    out = out.replace(new RegExp(escapeRe(needle), 'gi'), '«REDACTED»');
  }
  return out;
}

const offending = new Set();
const matched = new Set();
for (const line of addedLines) {
  const lower = line.toLowerCase();
  const found = needles.filter((n) => lower.includes(n.toLowerCase()));
  if (found.length > 0) {
    found.forEach((n) => matched.add(n));
    offending.add(maskAll(line).slice(0, 160));
  }
}

if (offending.size === 0) {
  console.log(
    `check-secrets: CLEAN — scanned ${addedLines.length} added lines ` +
    `against ${needles.length} patterns.`,
  );
  process.exit(0);
}

console.error('\ncheck-secrets: REAL BUSINESS DATA FOUND IN STAGED CONTENT\n');
for (const line of offending) console.error(`  ${line}`);
console.error(
  `\n${matched.size} distinct value(s) matched, masked above.\n` +
  'Do not commit this. Move real values into scripts/owner.local.json\n' +
  '(git-ignored) and reference them from there. Git history is permanent.\n',
);
process.exit(1);

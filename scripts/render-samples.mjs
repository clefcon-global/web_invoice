/**
 * Generates sample documents for review.
 *
 * Phase 1 — renders the reference invoice in each candidate serif so the font
 * can be chosen visually.
 * Phase 2 — renders a receipt and a 30-line-item stress test to prove
 * pagination and text quality.
 *
 * Output goes to docs/sheer_aura/samples/, which is git-ignored, because these
 * samples reproduce real customer and bank details.
 *
 *   node scripts/render-samples.mjs
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderDocument } from '../src/pdf/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FONTS = join(ROOT, 'assets', 'fonts');
const OUT = join(ROOT, 'docs', 'sheer_aura', 'samples');
const SCRIPTS = join(ROOT, 'scripts');

const read = (p) => new Uint8Array(readFileSync(p));

const SANS = {
  sansRegular: read(join(FONTS, 'JosefinSans-Regular.ttf')),
  sansSemiBold: read(join(FONTS, 'JosefinSans-SemiBold.ttf')),
};
const LOGO = read(join(ROOT, 'docs', 'sheer_aura', 'sheer aura logo.png'));

// Real business details are never hardcoded here (this file is committed to a
// public repo). owner.local.json is git-ignored; fall back to fictional data
// from the committed .example file if it hasn't been created locally.
const ownerConfigPath = existsSync(join(SCRIPTS, 'owner.local.json'))
  ? join(SCRIPTS, 'owner.local.json')
  : join(SCRIPTS, 'owner.local.example.json');
const localConfig = JSON.parse(readFileSync(ownerConfigPath, 'utf-8'));
console.log(`Using details from ${ownerConfigPath.split(/[\\/]/).pop()}\n`);

const SAMPLE_CUSTOMER = localConfig.sampleCustomer;
const OWNER = { ...localConfig };
delete OWNER._comment;
delete OWNER.sampleCustomer;

/** The three free serif candidates replacing the commercial "The Seasons". */
const SERIFS = {
  cormorant: {
    label: 'Cormorant Garamond',
    serifRegular: read(join(FONTS, 'CormorantGaramond-Regular.ttf')),
    serifBold: read(join(FONTS, 'CormorantGaramond-Bold.ttf')),
  },
  playfair: {
    label: 'Playfair Display',
    serifRegular: read(join(FONTS, 'PlayfairDisplay-Regular.ttf')),
    serifBold: read(join(FONTS, 'PlayfairDisplay-Bold.ttf')),
  },
  prata: {
    label: 'Prata',
    // Prata ships a single weight, so bold falls back to regular.
    serifRegular: read(join(FONTS, 'Prata-Regular.ttf')),
    serifBold: read(join(FONTS, 'Prata-Regular.ttf')),
  },
};

/** Mirrors the reference invoice exactly, for side-by-side comparison. */
const REFERENCE_INVOICE = {
  kind: 'invoice',
  number: 1,
  date: new Date(2025, 2, 25),
  customer: { name: SAMPLE_CUSTOMER },
  owner: OWNER,
  items: [
    { description: 'Dish wash block', unitPrice: 38000, qty: 4 },
    { description: '100% Coconut oil soap', unitPrice: 25000, qty: 2 },
    { description: 'Olive/Shear/Coconut/Castor oil soap', unitPrice: 30000, qty: 2 },
    { description: 'Body Butter 70g bottle', unitPrice: 70000, qty: 2 },
    { description: 'Deodrant', unitPrice: 30000, qty: 1 },
  ],
  deliveryCents: 40000,
  taxPercent: null,
};

const RECEIPT = {
  ...REFERENCE_INVOICE,
  kind: 'receipt',
  number: 1,
  paidOn: '25th March 2025',
  paidMethod: 'Bank transfer',
};

/** 30 items: proves pagination, repeated headers and the totals block flowing. */
const STRESS = {
  ...REFERENCE_INVOICE,
  number: 42,
  items: Array.from({ length: 30 }, (_, i) => ({
    description: [
      'Dish wash block', '100% Coconut oil soap', 'Olive/Shear/Coconut/Castor oil soap',
      'Body Butter 70g bottle', 'Deodrant', 'Lavender & chamomile bath salt 250g jar',
    ][i % 6],
    unitPrice: 25000 + (i % 6) * 8500,
    qty: (i % 4) + 1,
  })),
  deliveryCents: 40000,
  taxPercent: 15,
};

async function write(name, input, serifKey) {
  const serif = SERIFS[serifKey];
  const bytes = await renderDocument(input, {
    ...SANS,
    serifRegular: serif.serifRegular,
    serifBold: serif.serifBold,
    logoPng: LOGO,
  });
  const path = join(OUT, name);
  writeFileSync(path, bytes);
  console.log(`  ${name.padEnd(34)} ${String(bytes.length).padStart(7)} bytes   ${serif.label}`);
}

mkdirSync(OUT, { recursive: true });
console.log('Phase 1 — font candidates:');
await write('01-invoice-cormorant-garamond.pdf', REFERENCE_INVOICE, 'cormorant');
await write('02-invoice-playfair-display.pdf', REFERENCE_INVOICE, 'playfair');
await write('03-invoice-prata.pdf', REFERENCE_INVOICE, 'prata');
console.log('Phase 2 — document types and stress test (Prata, the chosen font):');
await write('04-receipt-prata.pdf', RECEIPT, 'prata');
await write('05-stress-30-items-with-tax.pdf', STRESS, 'prata');
console.log(`\nWritten to ${OUT}`);

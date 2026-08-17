/**
 * PUBLIC ENTRY POINT for the PDF module.
 *
 * This is the ONLY file the rest of the application may import from `src/pdf/`.
 * Do not import template.js, layout.js or fonts directly — see SPEC.md 7A.
 *
 * Usage (browser):
 *   const bytes = await renderDocument(input, assets);
 *   const blob = new Blob([bytes], { type: 'application/pdf' });
 *
 * The caller supplies font and logo bytes, so this module works unchanged in
 * both Node (tests, sample generation) and the browser (the app).
 */

import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { drawDocument } from './template.js';
import { validateDocumentInput } from './contract.js';

export { validateDocumentInput, formatDocumentDate } from './contract.js';

/**
 * @typedef {Object} DocumentAssets
 * @property {Uint8Array} serifRegular   Body serif, regular weight.
 * @property {Uint8Array} serifBold      Body serif, bold weight.
 * @property {Uint8Array} sansRegular    Josefin Sans regular.
 * @property {Uint8Array} sansSemiBold   Josefin Sans semibold.
 * @property {Uint8Array} [logoPng]      Logo image. Optional.
 */

/**
 * Render a document to PDF bytes.
 *
 * @param {import('./contract.js').DocumentInput} input
 * @param {DocumentAssets} assets
 * @param {{deterministic?: boolean}} [opts] deterministic:true fixes timestamps
 *        so byte output is stable — used by the golden-file tests.
 * @returns {Promise<Uint8Array>}
 */
export async function renderDocument(input, assets, opts = {}) {
  validateDocumentInput(input);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const F = {
    serifRegular: await pdfDoc.embedFont(assets.serifRegular, { subset: true }),
    serifBold:    await pdfDoc.embedFont(assets.serifBold,    { subset: true }),
    sansRegular:  await pdfDoc.embedFont(assets.sansRegular,  { subset: true }),
    sansSemiBold: await pdfDoc.embedFont(assets.sansSemiBold, { subset: true }),
  };

  const logoImage = assets.logoPng ? await pdfDoc.embedPng(assets.logoPng) : null;

  const label = input.kind === 'receipt' ? 'Receipt' : 'Invoice';
  pdfDoc.setTitle(`${label} ${input.number} — ${input.owner.businessName}`);
  pdfDoc.setAuthor(input.owner.businessName);
  pdfDoc.setCreator(input.owner.businessName);
  pdfDoc.setProducer('sheer-aura-invoicing');

  if (opts.deterministic) {
    const epoch = new Date(Date.UTC(2000, 0, 1));
    pdfDoc.setCreationDate(epoch);
    pdfDoc.setModificationDate(epoch);
  } else {
    pdfDoc.setCreationDate(input.date);
    pdfDoc.setModificationDate(input.date);
  }

  drawDocument(pdfDoc, input, F, logoImage);

  return pdfDoc.save({ useObjectStreams: false });
}

/**
 * Convenience wrapper for the browser: returns a Blob ready for download.
 * @param {import('./contract.js').DocumentInput} input
 * @param {DocumentAssets} assets
 * @returns {Promise<Blob>}
 */
export async function renderDocumentBlob(input, assets) {
  const bytes = await renderDocument(input, assets);
  return new Blob([bytes], { type: 'application/pdf' });
}

/**
 * Suggested filename, e.g. "Sheer-Aura-Invoice-0012.pdf".
 * @param {import('./contract.js').DocumentInput} input
 * @returns {string}
 */
export function suggestedFilename(input) {
  const label = input.kind === 'receipt' ? 'Receipt' : 'Invoice';
  const slug = input.owner.businessName.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${slug}-${label}-${String(input.number).padStart(4, '0')}.pdf`;
}

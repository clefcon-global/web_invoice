/**
 * Document layout renderer.
 *
 * SEALED MODULE — see SPEC.md section 7A. Do not edit to add features; extend
 * the contract instead. Layout changes here will fail the golden-file tests,
 * which is intentional.
 *
 * Draws the Sheer Aura invoice/receipt using the measured constants in
 * layout.js. Handles a variable number of line items, flowing onto further
 * pages as needed.
 */

import { rgb } from 'pdf-lib';
import {
  PAGE, CONTENT, LOGO, HEADER, TABLE, TOTALS, THANKS, FOOTER, FLOW, fromTop,
} from './layout.js';
import { WORDING, formatDocumentDate } from './contract.js';
import { computeTotals, formatAmount, formatPrice } from '../lib/money.js';

const BLACK = rgb(0, 0, 0);
const BG = rgb(PAGE.background.r, PAGE.background.g, PAGE.background.b);

// ── Text helpers ────────────────────────────────────────────────────────────

/** Width of a string, including optional letter-spacing. */
function widthOf(font, text, size, tracking = 0) {
  const w = font.widthOfTextAtSize(text, size);
  return tracking ? w + tracking * Math.max(0, text.length - 1) : w;
}

/**
 * Draw text with an alignment mode. `topY` is the TEXT BASELINE, top-based.
 * @param {'left'|'right'|'center'} align
 */
function drawAligned(page, text, { x, topY, size, font, align = 'left', tracking = 0 }) {
  const w = widthOf(font, text, size, tracking);
  let startX = x;
  if (align === 'right') startX = x - w;
  else if (align === 'center') startX = x - w / 2;

  const y = fromTop(topY);

  if (!tracking) {
    page.drawText(text, { x: startX, y, size, font, color: BLACK });
    return w;
  }
  // Letter-spacing: pdf-lib has no tracking option, so advance per character.
  let cx = startX;
  for (const ch of text) {
    page.drawText(ch, { x: cx, y, size, font, color: BLACK });
    cx += font.widthOfTextAtSize(ch, size) + tracking;
  }
  return w;
}

/**
 * Fit a description into the ITEMS column: shrink toward a floor, then
 * truncate with an ellipsis. Keeps every row on the same grid pitch, which
 * wrapping would break.
 */
function fitDescription(font, text, size, maxWidth, minSize = 8) {
  let s = size;
  while (s > minSize && font.widthOfTextAtSize(text, s) > maxWidth) s -= 0.25;
  if (font.widthOfTextAtSize(text, s) <= maxWidth) return { text, size: s };

  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(t + '…', s) > maxWidth) t = t.slice(0, -1);
  return { text: t + '…', size: s };
}

function drawRule(page, topY, thickness = TABLE.ruleThickness) {
  page.drawRectangle({
    x: CONTENT.left,
    y: fromTop(topY) - thickness,
    width: CONTENT.right - CONTENT.left,
    height: thickness,
    color: BLACK,
  });
}

// ── Page sections ───────────────────────────────────────────────────────────

function drawBackground(page) {
  page.drawRectangle({
    x: 0, y: 0, width: PAGE.width, height: PAGE.height, color: BG,
  });
}

function drawLogo(page, logoImage) {
  if (!logoImage) return;
  page.drawImage(logoImage, {
    x: LOGO.x,
    y: fromTop(LOGO.top + LOGO.height),
    width: LOGO.width,
    height: LOGO.height,
  });
}

function drawFirstPageHeader(page, input, F) {
  const wording = WORDING[input.kind];

  drawAligned(page, 'BILLED TO:', {
    x: HEADER.billedToLabel.x,
    topY: HEADER.billedToLabel.top + HEADER.billedToLabel.size * 0.78,
    size: HEADER.billedToLabel.size,
    font: F.sansSemiBold,
  });

  let cTop = HEADER.customerName.top + HEADER.customerName.size * 0.78;
  drawAligned(page, input.customer.name, {
    x: HEADER.customerName.x, topY: cTop,
    size: HEADER.customerName.size, font: F.serifRegular,
  });
  for (const line of input.customer.lines ?? []) {
    cTop += HEADER.customerLinePitch;
    drawAligned(page, line, {
      x: HEADER.customerName.x, topY: cTop,
      size: HEADER.customerName.size, font: F.serifRegular,
    });
  }

  drawAligned(page, `${wording.metaLabel} ${input.number}`, {
    x: HEADER.metaRight,
    topY: HEADER.metaLine1.top + HEADER.metaLine1.size * 0.78,
    size: HEADER.metaLine1.size, font: F.serifRegular, align: 'right',
  });
  drawAligned(page, formatDocumentDate(input.date), {
    x: HEADER.metaRight,
    topY: HEADER.metaLine2.top + HEADER.metaLine2.size * 0.78,
    size: HEADER.metaLine2.size, font: F.serifRegular, align: 'right',
  });
}

function drawTableHeader(page, topY, F) {
  const baseline = topY + TABLE.header.size * 0.78;
  const t = TABLE.headerTracking;
  const s = TABLE.header.size;
  const f = F.sansSemiBold;
  const H = TABLE.headerCol;

  drawAligned(page, 'ITEMS',        { x: H.items.x,  topY: baseline, size: s, font: f, tracking: t });
  drawAligned(page, 'PRICE (RS.)',  { x: H.price.x,  topY: baseline, size: s, font: f, tracking: t });
  drawAligned(page, 'QTY',          { x: H.qty.x,    topY: baseline, size: s, font: f, tracking: t });
  drawAligned(page, 'AMOUNT (RS.)', { x: H.amount.x, topY: baseline, size: s, font: f,
                                      tracking: t, align: 'right' });
}

function drawItemRow(page, item, ruleTop, F) {
  const baseline = ruleTop - TABLE.textAboveRule;
  const C = TABLE.col;

  const fitted = fitDescription(
    F.serifRegular, item.description, C.desc.size, TABLE.descMaxWidth,
  );
  drawAligned(page, fitted.text, {
    x: C.desc.x, topY: baseline, size: fitted.size, font: F.serifRegular,
  });
  drawAligned(page, formatPrice(item.unitPrice), {
    x: C.price.x, topY: baseline, size: C.price.size, font: F.serifRegular, align: 'right',
  });
  drawAligned(page, String(item.qty), {
    x: C.qty.x, topY: baseline, size: C.qty.size, font: F.serifRegular, align: 'center',
  });
  drawAligned(page, formatAmount(item.unitPrice * item.qty), {
    x: C.amount.x, topY: baseline, size: C.amount.size, font: F.serifRegular, align: 'right',
  });

  drawRule(page, ruleTop);
}

/**
 * Totals block. Returns the baseline of the TOTAL line so "Thank you!" can
 * follow it.
 */
function drawTotals(page, lastRuleTop, totals, F) {
  let rowTop = lastRuleTop + TOTALS.subtotalOffset + TOTALS.size * 0.78;

  // Subtotal — unlabelled in the reference.
  drawAligned(page, formatAmount(totals.subtotal), {
    x: TOTALS.amountRight, topY: rowTop, size: TOTALS.size,
    font: F.serifRegular, align: 'right',
  });

  const extraRow = (label, cents) => {
    rowTop += TOTALS.rowPitch;
    drawAligned(page, label, {
      x: TOTALS.labelRight, topY: rowTop, size: TOTALS.size,
      font: F.serifRegular, align: 'right',
    });
    drawAligned(page, '+', {
      x: TOTALS.plusX, topY: rowTop, size: TOTALS.size, font: F.serifBold,
    });
    drawAligned(page, formatAmount(cents), {
      x: TOTALS.amountRight, topY: rowTop, size: TOTALS.size,
      font: F.serifRegular, align: 'right',
    });
  };

  if (totals.delivery !== null) extraRow('Delivery Charges', totals.delivery);
  if (totals.tax !== null) {
    const pct = Number.isInteger(totals.taxPercent)
      ? totals.taxPercent
      : Number(totals.taxPercent.toFixed(2));
    extraRow(`Tax (${pct}%)`, totals.tax);
  }

  const ruleTop = rowTop + TOTALS.ruleOffsetAfterLastRow;
  drawRule(page, ruleTop, TOTALS.ruleThickness);

  const totalBaseline = ruleTop + TOTALS.totalOffsetAfterRule + TOTALS.totalSize * 0.78;
  drawAligned(page, 'TOTAL', {
    x: TOTALS.totalLabel.x, topY: totalBaseline,
    size: TOTALS.totalSize, font: F.serifRegular,
  });
  drawAligned(page, formatAmount(totals.total), {
    x: TOTALS.totalAmountRight, topY: totalBaseline,
    size: TOTALS.totalSize, font: F.serifRegular, align: 'right',
  });

  return totalBaseline;
}

function drawThanks(page, totalBaseline, input, F) {
  const text = input.thanksText ?? WORDING[input.kind].thanks;
  drawAligned(page, text, {
    x: THANKS.x,
    topY: totalBaseline + THANKS.offsetAfterTotal,
    size: THANKS.size,
    font: F.sansRegular,
  });
}

function drawFooter(page, input, F) {
  const { payment, business } = FOOTER;
  const o = input.owner;

  // Left: payment details (or, on a receipt, how it was paid).
  const isReceipt = input.kind === 'receipt';
  const heading = o.paymentHeading ?? (isReceipt ? 'Payment Received' : 'Payment Information');
  const lines = isReceipt
    ? [input.paidOn ? `Date: ${input.paidOn}` : null,
       input.paidMethod ? `Method: ${input.paidMethod}` : null].filter(Boolean)
    : o.paymentLines;

  drawAligned(page, heading, {
    x: payment.x, topY: payment.headingTop + payment.headingSize * 0.78,
    size: payment.headingSize, font: F.sansRegular,
  });
  lines.forEach((line, i) => {
    drawAligned(page, line, {
      x: payment.x,
      topY: payment.lineTop + i * payment.linePitch + payment.lineSize * 0.78,
      size: payment.lineSize, font: F.sansRegular,
    });
  });

  // Right: business identity.
  drawAligned(page, o.businessName, {
    x: business.right, topY: business.nameTop + business.nameSize * 0.78,
    size: business.nameSize, font: F.sansRegular, align: 'right',
  });
  const addr = [...o.addressLines, ...(o.phone ? [o.phone] : [])];
  addr.forEach((line, i) => {
    drawAligned(page, line, {
      x: business.addressRight,
      topY: business.addressTop + i * business.addressPitch + business.addressSize * 0.78,
      size: business.addressSize, font: F.serifRegular, align: 'right',
    });
  });
}

// ── Entry point ─────────────────────────────────────────────────────────────

/**
 * Draw a complete document into an existing PDFDocument.
 *
 * @param {import('pdf-lib').PDFDocument} pdfDoc
 * @param {import('./contract.js').DocumentInput} input
 * @param {{serifRegular:any, serifBold:any, sansRegular:any, sansSemiBold:any}} F embedded fonts
 * @param {any} logoImage embedded PNG, or null
 */
export function drawDocument(pdfDoc, input, F, logoImage) {
  const totals = computeTotals(
    input.items.map((i) => ({ unitPrice: i.unitPrice, qty: i.qty })),
    { deliveryCents: input.deliveryCents ?? null, taxPercent: input.taxPercent ?? null },
  );

  const newPage = () => {
    const p = pdfDoc.addPage([PAGE.width, PAGE.height]);
    drawBackground(p);
    return p;
  };

  // ── page 1 ──
  let page = newPage();
  drawLogo(page, logoImage);
  drawFirstPageHeader(page, input, F);
  drawTableHeader(page, TABLE.header.top, F);

  let ruleTop = TABLE.firstRuleTop;
  let lastRuleTop = ruleTop;

  for (const item of input.items) {
    if (ruleTop > FLOW.maxRuleTop) {
      page = newPage();
      drawTableHeader(page, FLOW.continuationHeaderTop, F);
      ruleTop = FLOW.continuationFirstRuleTop;
    }
    drawItemRow(page, item, ruleTop, F);
    lastRuleTop = ruleTop;
    ruleTop += TABLE.rulePitch;
  }

  // Height the totals block plus "Thank you!" will occupy below the last rule.
  const extraRows =
    (totals.delivery !== null ? 1 : 0) + (totals.tax !== null ? 1 : 0);
  const totalsHeight =
    TOTALS.subtotalOffset + extraRows * TOTALS.rowPitch +
    TOTALS.ruleOffsetAfterLastRow + TOTALS.totalOffsetAfterRule +
    TOTALS.totalSize + THANKS.offsetAfterTotal + THANKS.size;

  if (lastRuleTop + totalsHeight > FLOW.footerGuard) {
    page = newPage();
    lastRuleTop = FLOW.continuationFirstRuleTop;
  }

  const totalBaseline = drawTotals(page, lastRuleTop, totals, F);
  drawThanks(page, totalBaseline, input, F);
  drawFooter(page, input, F);

  return { totals, pageCount: pdfDoc.getPageCount() };
}

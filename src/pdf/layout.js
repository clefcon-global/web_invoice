/**
 * Layout constants for the Sheer Aura document.
 *
 * EVERY value here was measured directly from the reference PDF
 * (docs/sheer_aura/sheer aura invoice.pdf) using pdfplumber. Nothing is
 * estimated. Do not "tidy" these numbers into rounder ones — they are what
 * makes the output match the original.
 *
 * Coordinate convention: all Y values are TOP-based (distance down from the
 * top edge of the page), because that is how the reference was measured.
 * pdf-lib is bottom-based, so template.js converts via `fromTop()`.
 */

// ── Page ────────────────────────────────────────────────────────────────────
export const PAGE = {
  width: 595.5,
  height: 842.25,
  /** Full-bleed background, sampled from both the PDF fill and the PNG. */
  background: { r: 0xf5 / 255, g: 0xf5 / 255, b: 0xef / 255 }, // #F5F5EF
};

// ── Content edges ───────────────────────────────────────────────────────────
export const CONTENT = {
  left: 46.95,
  right: 522.46,
};

// ── Logo ────────────────────────────────────────────────────────────────────
export const LOGO = { x: 246, top: 19, width: 107, height: 114 };

// ── Header block ────────────────────────────────────────────────────────────
export const HEADER = {
  billedToLabel: { x: 47.3, top: 161.73, size: 12 },   // Josefin SemiBold
  customerName:  { x: 47.3, top: 181.98, size: 12 },   // serif
  /** Invoice number and date are right-aligned to this edge, not the table edge. */
  metaRight: 497.16,
  metaLine1: { top: 177.08, size: 12 },                // "Invoice No. N"
  metaLine2: { top: 193.58, size: 12 },                // date
  /** Additional customer lines flow below the name at this pitch. */
  customerLinePitch: 15.5,
};

// ── Table ───────────────────────────────────────────────────────────────────
export const TABLE = {
  header: { top: 265.65, size: 12 },                   // Josefin SemiBold, tracked
  /**
   * Letter-spacing on the column headers. Derived, not guessed: the reference
   * "ITEMS" spans 41.72pt and untracked Josefin SemiBold 12pt spans 36.90pt,
   * so tracking = (41.72 - 36.90) / 4 gaps = 1.205.
   */
  headerTracking: 1.205,

  /** Y of the first rule, i.e. the rule UNDER the first line item. */
  firstRuleTop: 329.38,
  /** Mean spacing between rules: (469.73 - 329.38) / 4. */
  rulePitch: 35.09,
  ruleThickness: 0.75,

  /** Baseline of a row's text, measured upward from that row's rule. */
  textAboveRule: 15.0,

  /** Column geometry. Values are how each column ALIGNS. */
  col: {
    desc:   { align: 'left',   x: 46.95, size: 11 },
    price:  { align: 'right',  x: 321.5, size: 11 },
    qty:    { align: 'center', x: 391.85, size: 11 },
    amount: { align: 'right',  x: 522.46, size: 11 },
  },

  /** Header label positions (headers are positioned independently of values). */
  headerCol: {
    items:  { align: 'left',  x: 46.95 },
    price:  { align: 'left',  x: 271.74 },
    qty:    { align: 'left',  x: 377.59 },
    amount: { align: 'right', x: 522.46 },
  },

  /** Longest a description may run before it is wrapped. */
  descMaxWidth: 240,
};

// ── Totals block ────────────────────────────────────────────────────────────
/**
 * All offsets are measured DOWNWARD from the last line-item rule, so the block
 * follows the table however many rows there are.
 * Reference values: last rule 469.73, subtotal 482.29, delivery 503.86,
 * total rule 519.90, TOTAL 529.78.
 */
export const TOTALS = {
  subtotalOffset: 12.56,
  rowPitch: 21.57,
  labelRight: 433.99,
  plusX: 471.63,
  amountRight: 522.46,
  size: 11,

  // Measured from the last totals-row BASELINE (512.44) to the rule (519.90).
  // Note: offsets in this block are baseline-relative, not glyph-top-relative.
  ruleOffsetAfterLastRow: 7.46,
  ruleThickness: 0.75,

  totalLabel: { x: 46.68, size: 14 },
  totalAmountRight: 522.2,
  totalOffsetAfterRule: 9.88,
  totalSize: 14,
};

// ── Thank you ───────────────────────────────────────────────────────────────
export const THANKS = {
  x: 42.5,
  /** Baseline-to-baseline: TOTAL (540.70) to "Thank you!" (577.14). */
  offsetAfterTotal: 36.44,
  size: 20, // Josefin Regular
};

// ── Footer ──────────────────────────────────────────────────────────────────
/**
 * The footer is pinned to fixed page positions rather than flowing, so it sits
 * in the same place regardless of item count. It is drawn on the LAST page only.
 */
export const FOOTER = {
  payment: {
    x: 43.47,
    headingTop: 620.45,
    headingSize: 13,   // Josefin Regular
    lineTop: 639.96,
    linePitch: 19.51,
    lineSize: 13,      // Josefin Regular
  },
  business: {
    right: 527.27,
    nameTop: 621.27,
    nameSize: 18,      // Josefin Regular
    addressRight: 526.12,
    addressTop: 647.76,
    addressPitch: 16.5,
    addressSize: 12,   // serif
  },
};

// ── Pagination ──────────────────────────────────────────────────────────────
export const FLOW = {
  /** Rules may not be placed below this on any page. */
  maxRuleTop: 770,
  /** On the final page, flowing content must finish above the footer. */
  footerGuard: FOOTER.payment.headingTop - 18,
  /** Where the table restarts on a continuation page. */
  continuationHeaderTop: 90,
  continuationFirstRuleTop: 140,
};

/** Convert a TOP-based Y to the bottom-based Y that pdf-lib expects. */
export const fromTop = (topY) => PAGE.height - topY;

/**
 * Currency arithmetic. All money is handled as INTEGER CENTS.
 *
 * Never use floating point for money. `0.1 + 0.2 !== 0.3`, and on an invoice
 * that surfaces as a total that is one cent off — which is both wrong and
 * embarrassing. Every value in this module is an integer number of cents
 * (rupees x 100). Conversion to a display string happens only at render time.
 */

/** @typedef {number} Cents An integer number of cents. Never fractional. */

/**
 * Assert a value is a safe integer, so a float never leaks into the maths.
 * @param {number} n
 * @param {string} label
 * @returns {number}
 */
export function assertCents(n, label = 'value') {
  if (!Number.isInteger(n)) {
    throw new TypeError(`${label} must be an integer number of cents, got ${n}`);
  }
  if (!Number.isSafeInteger(n)) {
    throw new RangeError(`${label} exceeds safe integer range: ${n}`);
  }
  return n;
}

/**
 * Parse a user-typed amount ("380", "380.50", "1,520.00") into cents.
 * Rounds half away from zero at 2dp.
 * @param {string|number} input
 * @returns {Cents}
 */
export function parseCents(input) {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) throw new TypeError(`Not a finite number: ${input}`);
    return Math.round(input * 100);
  }
  const cleaned = String(input).replace(/[,\s]/g, '').trim();
  if (cleaned === '') return 0;
  if (!/^-?\d*(\.\d*)?$/.test(cleaned)) {
    throw new TypeError(`Not a valid amount: ${input}`);
  }
  const neg = cleaned.startsWith('-');
  const [whole, frac = ''] = cleaned.replace('-', '').split('.');
  const cents =
    (Number(whole || '0') * 100) + Number((frac + '00').slice(0, 2).padEnd(2, '0'));
  return neg ? -cents : cents;
}

/**
 * Line amount = unit price x quantity. Quantity must be a whole number.
 * @param {Cents} unitPrice
 * @param {number} qty
 * @returns {Cents}
 */
export function lineAmount(unitPrice, qty) {
  assertCents(unitPrice, 'unitPrice');
  if (!Number.isInteger(qty) || qty < 0) {
    throw new TypeError(`qty must be a non-negative integer, got ${qty}`);
  }
  return unitPrice * qty;
}

/**
 * Tax on a base amount at a percentage. Rounds half away from zero to the cent.
 * Percent may be fractional (e.g. 7.5); the *result* is always whole cents.
 * @param {Cents} base
 * @param {number} percent
 * @returns {Cents}
 */
export function taxOn(base, percent) {
  assertCents(base, 'base');
  if (!Number.isFinite(percent) || percent < 0) {
    throw new TypeError(`percent must be a non-negative number, got ${percent}`);
  }
  const exact = (base * percent) / 100;
  return exact < 0 ? -Math.round(-exact) : Math.round(exact);
}

/**
 * Compute the full totals block.
 *
 * Order is fixed: subtotal -> delivery -> tax -> total.
 * Tax is applied to (subtotal + delivery).
 *
 * @param {{unitPrice: Cents, qty: number}[]} lines
 * @param {{deliveryCents?: Cents|null, taxPercent?: number|null}} [opts]
 * @returns {{subtotal: Cents, delivery: Cents|null, tax: Cents|null, taxPercent: number|null, total: Cents}}
 */
export function computeTotals(lines, opts = {}) {
  const { deliveryCents = null, taxPercent = null } = opts;

  const subtotal = lines.reduce((sum, l) => sum + lineAmount(l.unitPrice, l.qty), 0);

  const delivery =
    deliveryCents === null || deliveryCents === undefined
      ? null
      : assertCents(deliveryCents, 'deliveryCents');

  const taxable = subtotal + (delivery ?? 0);

  const tax =
    taxPercent === null || taxPercent === undefined ? null : taxOn(taxable, taxPercent);

  return {
    subtotal,
    delivery,
    tax,
    taxPercent: tax === null ? null : taxPercent,
    total: taxable + (tax ?? 0),
  };
}

/**
 * Format cents as a 2dp amount string: 152000 -> "1520.00".
 * Used for the AMOUNT column and every total.
 * @param {Cents} cents
 * @returns {string}
 */
export function formatAmount(cents) {
  assertCents(cents, 'cents');
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const s = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
  return neg ? `-${s}` : s;
}

/**
 * Format cents as a unit price, dropping ".00" for whole rupees: 38000 -> "380".
 * The reference invoice shows unit prices without decimals but amounts with
 * them, so this deliberately differs from formatAmount.
 * @param {Cents} cents
 * @returns {string}
 */
export function formatPrice(cents) {
  assertCents(cents, 'cents');
  return cents % 100 === 0 ? String(Math.trunc(cents / 100)) : formatAmount(cents);
}

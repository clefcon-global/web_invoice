/**
 * FROZEN INPUT CONTRACT for the PDF module.
 *
 * This is the only shape the document renderer accepts. To put new information
 * on the document, extend this contract deliberately — never reach into
 * template.js to work around it. See SPEC.md section 7A.
 *
 * Money is ALWAYS integer cents (see src/lib/money.js). This contract does not
 * accept pre-formatted currency strings: all formatting happens inside the
 * module so that every document formats identically.
 */

/**
 * @typedef {Object} LineItem
 * @property {string} description  Item name as it appears in the ITEMS column.
 * @property {number} unitPrice    Unit price in integer cents.
 * @property {number} qty          Whole number of units.
 */

/**
 * @typedef {Object} Customer
 * @property {string}   name       e.g. "Mrs. A. Perera"
 * @property {string[]} [lines]    Optional extra lines under the name.
 */

/**
 * @typedef {Object} Owner
 * @property {string}   businessName   Shown bottom-right, large.
 * @property {string[]} addressLines    Shown under the business name.
 * @property {string}   [phone]         Appended as a final address line.
 * @property {string}   [paymentHeading] Defaults to "Payment Information".
 * @property {string[]} paymentLines     Bank details, shown bottom-left.
 */

/**
 * @typedef {Object} DocumentInput
 * @property {'invoice'|'receipt'} kind
 * @property {number}   number          Document number. Plain integer.
 * @property {Date}     date            Document date.
 * @property {Customer} customer
 * @property {Owner}    owner
 * @property {LineItem[]} items
 * @property {number|null} [deliveryCents]  Delivery charge in cents, or null to hide the row.
 * @property {number|null} [taxPercent]     Tax rate, or null to hide the row.
 * @property {string}   [paidOn]        Receipts only: payment date text.
 * @property {string}   [paidMethod]    Receipts only: payment method text.
 * @property {string}   [thanksText]    Defaults to "Thank you!".
 */

/** Wording that differs between the two document types. */
export const WORDING = {
  invoice: { metaLabel: 'Invoice No.', thanks: 'Thank you!' },
  receipt: { metaLabel: 'Receipt No.', thanks: 'Thank you!' },
};

/**
 * Validate a DocumentInput and throw a clear error if it is malformed.
 * Called by the renderer before drawing anything — a bad document should fail
 * loudly rather than silently produce a wrong invoice.
 *
 * @param {DocumentInput} input
 * @returns {DocumentInput}
 */
export function validateDocumentInput(input) {
  const err = (m) => {
    throw new TypeError(`Invalid document input: ${m}`);
  };

  if (!input || typeof input !== 'object') err('expected an object');
  if (input.kind !== 'invoice' && input.kind !== 'receipt') {
    err(`kind must be "invoice" or "receipt", got ${JSON.stringify(input.kind)}`);
  }
  if (!Number.isInteger(input.number) || input.number < 0) {
    err(`number must be a non-negative integer, got ${input.number}`);
  }
  if (!(input.date instanceof Date) || Number.isNaN(input.date.getTime())) {
    err('date must be a valid Date');
  }
  if (!input.customer || typeof input.customer.name !== 'string' || !input.customer.name.trim()) {
    err('customer.name is required');
  }
  if (!input.owner || typeof input.owner.businessName !== 'string') {
    err('owner.businessName is required');
  }
  if (!Array.isArray(input.owner.addressLines)) err('owner.addressLines must be an array');
  if (!Array.isArray(input.owner.paymentLines)) err('owner.paymentLines must be an array');

  if (!Array.isArray(input.items) || input.items.length === 0) {
    err('items must be a non-empty array');
  }
  input.items.forEach((it, i) => {
    if (typeof it.description !== 'string' || !it.description.trim()) {
      err(`items[${i}].description is required`);
    }
    if (!Number.isInteger(it.unitPrice)) {
      err(`items[${i}].unitPrice must be integer cents, got ${it.unitPrice}`);
    }
    if (!Number.isInteger(it.qty) || it.qty < 0) {
      err(`items[${i}].qty must be a non-negative integer, got ${it.qty}`);
    }
  });

  if (input.deliveryCents != null && !Number.isInteger(input.deliveryCents)) {
    err(`deliveryCents must be integer cents or null, got ${input.deliveryCents}`);
  }
  if (input.taxPercent != null && !(Number.isFinite(input.taxPercent) && input.taxPercent >= 0)) {
    err(`taxPercent must be a non-negative number or null, got ${input.taxPercent}`);
  }

  return input;
}

/**
 * Format a date the way the reference document does: "25th March 2025".
 * @param {Date} d
 * @returns {string}
 */
export function formatDocumentDate(d) {
  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const day = d.getDate();
  const tens = day % 100;
  const suffix =
    tens >= 11 && tens <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] || 'th';
  return `${day}${suffix} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
